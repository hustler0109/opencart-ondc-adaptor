// handlers/onConfirmHandler.js

import axios from "axios";
import _ from "lodash";
import logger from "../utils/logger.js";
import { sendAck } from "../utils/sendResponse.js";
import { getValue, setValue } from "../utils/cache.js";
import axiosRetry from "axios-retry";
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkError(error) || (error.response && error.response.status >= 500);
  }
});

// --- OpenCart Configuration ---
const OPENCART_BASE_URL = process.env.OPENCART_BASE_URL || "http://localhost/opencart/index.php";
const OPENCART_API_USER = process.env.OPENCART_API_USERNAME;
const OPENCART_API_KEY = process.env.OPENCART_API_KEY;
const DEFAULT_ORDER_STATUS_ID = parseInt(process.env.OPENCART_CONFIRMED_STATUS_ID || '2');
const API_TOKEN_CACHE_KEY = 'opencart_api_token';
const API_TOKEN_TTL = 600; // 10 minutes

const loginToOpenCart = async () => {
  if (!OPENCART_API_USER || !OPENCART_API_KEY) {
    logger.error({ message: "OpenCart API credentials are not configured." });
    return null;
  }

  const cachedToken = await getValue(API_TOKEN_CACHE_KEY);
  if (cachedToken) {
    logger.debug({ message: "Using cached OpenCart API token" });
    return cachedToken;
  }

  try {
    const response = await axios.post(`${OPENCART_BASE_URL}?route=api/login`, {
      username: OPENCART_API_USER,
      key: OPENCART_API_KEY
    }, { timeout: 5000 });

    if (response.data?.api_token) {
      await setValue(API_TOKEN_CACHE_KEY, response.data.api_token, API_TOKEN_TTL);
      return response.data.api_token;
    } else {
      logger.error({ message: "OpenCart login failed", responseData: response.data });
      return null;
    }
  } catch (error) {
    logger.error({ message: "OpenCart login error", error: error.message });
    return null;
  }
};

const mapOrderStateToStatusId = (orderState) => {
  const mapping = {
    "Accepted": parseInt(process.env.OPENCART_CONFIRMED_STATUS_ID || '2'),
    "Cancelled": parseInt(process.env.OPENCART_CANCELLED_STATUS_ID || '7'),
    "Processing": parseInt(process.env.OPENCART_PROCESSING_STATUS_ID || '1')
  };
  return mapping[orderState] || DEFAULT_ORDER_STATUS_ID;
};

const updateOpenCartOrderStatus = async (apiToken, orderId, orderState, transactionId) => {
  if (!orderId) {
    logger.error({ message: "Missing order ID for status update", transactionId });
    return false;
  }

  const statusId = mapOrderStateToStatusId(orderState);
  try {
    const response = await axios.post(
      `${OPENCART_BASE_URL}?route=api/order/history&api_token=${apiToken}`,
      {
        order_id: orderId,
        order_status_id: statusId,
        notify: 0,
        comment: `ONDC status update: ${orderState} (Txn ID: ${transactionId})`
      },
      { timeout: 5000 }
    );

    if (response.data?.success) {
      logger.info({ message: "OpenCart order status updated", orderId, statusId, transactionId });
      return true;
    } else {
      logger.error({ message: "Failed to update OpenCart order", orderId, transactionId, response: response.data });
      return false;
    }
  } catch (error) {
    logger.error({ message: "OpenCart update failed", orderId, transactionId, error: error.message });
    return false;
  }
};

const onConfirmHandler = async (req, res) => {
  const { body } = req;
  const transactionId = _.get(body, "context.transaction_id");
  const messageId = _.get(body, "context.message_id");
  const orderId = _.get(body, "message.order.id");
  const orderState = _.get(body, "message.order.state", "Accepted");
  const ackResponse = sendAck({ transaction_id: transactionId, message_id: messageId }); // Include context

  const cacheKey = `on_confirm_ack:${transactionId}:${messageId}`;
  try {
    const cachedAck = await getValue(cacheKey);
    if (cachedAck) {
      logger.warn({ message: "Duplicate /on_confirm ACK", transactionId, messageId });
      return res.status(200).json(ackResponse);
    }
  } catch (err) {
    logger.error({ message: "Idempotency cache error", transactionId, messageId, error: err.message });
  }

  res.status(200).json(ackResponse);

  setImmediate(async () => {
    const apiToken = await loginToOpenCart();
    if (!apiToken) return;

    const success = await updateOpenCartOrderStatus(apiToken, orderId, orderState, transactionId);
    if (success) {
      try {
        await setValue(cacheKey, ackResponse, 60); // Cache for 60 seconds
        logger.info({ message: "Cached ACK after successful processing", transactionId });
      } catch (err) {
        logger.error({ message: "Failed to cache ACK", transactionId, error: err.message });
      }
    }
  });
};

export default onConfirmHandler;