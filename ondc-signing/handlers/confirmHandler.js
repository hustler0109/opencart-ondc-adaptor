import _ from 'lodash';
import axios from 'axios';
import logger from '../utils/logger.js'; // Assuming you have a loggerimport { getValue, setValue } from '../utils/cache.js'; // Assuming this is ESM
import { sendAck, sendNack } from '../utils/sendResponse.js'; // Assuming this is ESM
import registry from '../utils/registryLookup.js'; // <-- Import here
import { forwardRequest } from '../utils/lookupUtils.js'; // Assuming this is ESM
import Signer from '../utils/signature.js'; // Assuming this is ESM

const confirmHandler = async (req, res) => {
  const { body } = req;
  const messageId = _.get(body, 'context.message_id');
  const transactionId = _.get(body, 'context.transaction_id');
  const action = 'on_confirm';
  const bapId = _.get(body, 'context.bap_id');

  logger.info({ message: 'Confirm API called', transactionId, messageId });

  try {
    const cacheKey = `${transactionId}_${messageId}_CONFIRM`;
    const cachedResponse = await getValue(cacheKey);
    if (cachedResponse) {
      logger.info({ message: 'Duplicate confirm request, returning cached ACK', transactionId, messageId });
      return res.status(200).json(cachedResponse);
    }

    const schemaValidation = validateSchema(body, 'confirm');
    if (!schemaValidation.valid) {
      logger.error({ message: 'Schema validation failed', errors: schemaValidation.errors });
      return res.status(400).json(sendNack('Schema validation failed'));
    }

     // Registry lookup for BAP details
     const bapSubscriber = await registry.lookupGatewaySubscriber(bapId, 'BAP'); // <-- Use lookupGatewaySubscriber
     const bapCallbackUri = registry.lookupRegistryCallbackUri(bapSubscriber); // <-- Use lookupRegistryCallbackUri
     if (!bapCallbackUri) {
       logger.error({ message: 'BAP callback URI not found', transactionId, messageId });
       return res.status(500).json(sendNack('BAP callback URI not found'));
     }

    // -------------------------
    // STEP 1: Login to OpenCart
    // -------------------------
    const loginResponse = await axios.post('http://localhost/opencart/index.php?route=api/login', {
      username: 'your_api_user',
      key: 'your_api_key',
    });
    const apiToken = loginResponse.data.api_token;
    if (!apiToken) {
      logger.error({ message: 'OpenCart login failed', data: loginResponse.data });
      return res.status(500).json(sendNack('OpenCart login failed'));
    }

    // ------------------------------------
    // STEP 2: Map ONDC Order → OpenCart
    // ------------------------------------
    const order = _.get(body, 'message.order');
    const openCartPayload = {
      api_token: apiToken,
      customer_id: order.customer?.id || '',
      payment_method: order.billing?.payment?.type || '',
      shipping_address: order.fulfillments?.[0]?.end?.location?.address || {},
      products: (order.items || []).map(item => ({
        product_id: item.id,
        quantity: item.quantity?.count || 1,
      })),
      total_amount: order.quote?.price?.value || '',
    };

    // -------------------------------
    // STEP 3: Confirm Order in OC API
    // -------------------------------
    const orderResponse = await axios.post(
      'http://localhost/opencart/index.php?route=api/order/add',
      openCartPayload,
      { timeout: 5000 }
    );

    if (!orderResponse || orderResponse.data.status !== 'success') {
      logger.error({ message: 'OpenCart order creation failed', data: orderResponse.data });
      return res.status(500).json(sendNack('Order creation in OpenCart failed'));
    }

    // -------------------------------
    // STEP 4: Build and Send /on_confirm
    // -------------------------------
    const onConfirmPayload = ondcUtils.createOnConfirmPayload(body);
    const signature = Signer.signPayload(onConfirmPayload);

    const onConfirmUrl = `${bapCallbackUri?.replace(/\/$/, '')}/on_confirm`;
    logger.info({ message: 'Sending /on_confirm to BAP', url: onConfirmUrl });

    try {
      const bppResponse = await axios.post(onConfirmUrl, onConfirmPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Signature keyId="your-key-id",algorithm="rsa-sha256",headers="(created) (expires) digest",signature="${signature}"`,
        },
        timeout: 5000,
      });

      if (bppResponse?.data?.message?.ack?.status === 'ACK') {
        const ackResponse = sendAck();
        await setValue(cacheKey, ackResponse, 60);        logger.info({ message: '/on_confirm ACK received from BAP', transactionId, messageId });
        return res.status(200).json(ackResponse);
      } else {
        logger.error({ message: 'Received NACK or unexpected response from BAP', data: bppResponse.data });
        return res.status(500).json(sendNack('BAP returned NACK or unknown error'));
      }
    } catch (bppError) {
      logger.error({ message: 'Error sending /on_confirm to BAP', error: bppError.isAxiosError ? bppError.toJSON?.() : bppError.message, url: onConfirmUrl });
      return res.status(500).json(sendNack('Error sending /on_confirm to BAP'));
    }

  } catch (error) {
    logger.error({
      message: 'Unhandled error in confirm handler',
      error: error.isAxiosError ? error.toJSON?.() : error.message
    });
    return res.status(500).json(sendNack('Unhandled exception occurred'));
  }
};

export default confirmHandler;