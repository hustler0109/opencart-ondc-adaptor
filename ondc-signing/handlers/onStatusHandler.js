// /handlers/onStatusHandler.js

import _ from "lodash";
import logger from "../utils/logger.js";
import { sendAck } from "../utils/sendResponse.js";
import { getValue, setValue } from "../shared/cache.js";

/**
 * Handles incoming /on_status from BPP to BAP.
 * Updates internal state (if applicable) and logs for audit.
 */
const onStatusHandler = async (req, res) => {
  const { body } = req;
  const transactionId = _.get(body, "context.transaction_id");
  const messageId = _.get(body, "context.message_id");
  const orderId = _.get(body, "message.order.id");
  const orderState = _.get(body, "message.order.state");
  const fulfillments = _.get(body, "message.order.fulfillments");

  const ackResponse = sendAck();

  const cacheKey = `on_status_ack:${transactionId}:${messageId}`;
  try {
    const cachedAck = await getValue(cacheKey);
    if (cachedAck) {
      logger.warn({ message: "Duplicate /on_status received", transactionId, messageId });
      return res.status(200).json(cachedAck);
    }
  } catch (err) {
    logger.error({ message: "Cache check failed", error: err.message, transactionId });
  }

  res.status(200).json(ackResponse);

  setImmediate(async () => {
    try {
      logger.info({
        message: "Processing /on_status update",
        transactionId,
        messageId,
        orderId,
        orderState,
        fulfillments,
      });

      // 🔁 TODO: Save order status to your database here if needed
      // await updateOrderStatusInDb(orderId, orderState, fulfillments);

      try {
        await setValue(cacheKey, ackResponse, { ttl: 300 });
        logger.info({ message: "ACK cached successfully for /on_status", transactionId, messageId });
      } catch (cacheErr) {
        logger.error({ message: "Failed to cache ACK", error: cacheErr.message });
      }
    } catch (error) {
      logger.error({
        message: "Error during /on_status internal processing",
        error: error.message,
        transactionId,
        messageId,
        stack: error.stack,
      });
    }
  });
};

export default onStatusHandler;
