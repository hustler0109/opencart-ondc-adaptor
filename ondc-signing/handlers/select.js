// /handlers/statusHandler.js

import axios from "axios";
import _ from "lodash";
import logger from "../utils/logger.js";
import { sendAck } from "../utils/sendResponse.js";
import { getValue, setValue } from "../utils/cache.js";
import { lookupRegistryCallbackUri } from "../utils/registryLookup.js";
import { signPayload } from "../utils/ondcUtils.js";

// --- Configuration ---
const BASE_URL = process.env.OPENCART_BASE_URL || "http://localhost/opencart/index.php";
const API_USERNAME = process.env.OPENCART_API_USERNAME;
const API_KEY = process.env.OPENCART_API_KEY;
const ORDER_HISTORY_ROUTE = "api/order/history";
const STATUS_CACHE_TTL = 300; // 5 mins
const TOKEN_CACHE_KEY = "opencart_api_token";

/**
 * Authenticates and caches the OpenCart API token.
 */
const loginToOpenCart = async () => {
  try {
    const cachedToken = await getValue(TOKEN_CACHE_KEY);
    if (cachedToken) {
      logger.debug({ message: "Using cached OpenCart API token" });
      return cachedToken;
    }

    const response = await axios.post(`${BASE_URL}?route=api/login`, {
      username: API_USERNAME,
      key: API_KEY,
    });

    const token = response?.data?.api_token || response?.data?.token;
    if (token) {
      await setValue(TOKEN_CACHE_KEY, token, { ttl: STATUS_CACHE_TTL });
      logger.info({ message: "Logged into OpenCart, token cached." });
      return token;
    } else {
      logger.error({ message: "Login to OpenCart failed", responseData: response.data });
      return null;
    }
  } catch (err) {
    logger.error({
      message: "OpenCart login failed",
      error: err.isAxiosError ? err.toJSON?.() : err.message,
    });
    return null;
  }
};

/**
 * Fetches the latest order status from OpenCart.
 */
const getOrderStatus = async (orderId, apiToken, transactionId) => {
  try {
    const res = await axios.post(
      `${BASE_URL}?route=${ORDER_HISTORY_ROUTE}&api_token=${apiToken}`,
      { order_id: orderId },
      { timeout: 5000 }
    );

    const histories = res?.data?.histories;
    if (!Array.isArray(histories)) {
      throw new Error("Unexpected OpenCart response format (histories missing)");
    }

    const lastStatus = _.last(histories)?.status || "Pending";
    logger.info({ message: "Fetched order status from OpenCart", orderId, lastStatus, transactionId });

    return lastStatus;
  } catch (err) {
    logger.error({
      message: "Failed to fetch order status from OpenCart",
      orderId,
      transactionId,
      error: err.message,
    });
    return null;
  }
};

/**
 * Maps OpenCart status text to ONDC order states.
 */
const mapToOndcStatus = (status) => {
  const map = {
    "Pending": "Created",
    "Processing": "Accepted",
    "Shipped": "In-Transit",
    "Delivered": "Delivered",
    "Cancelled": "Cancelled",
    "Completed": "Completed",
  };
  return map[status] || "Created";
};

/**
 * Main /status handler.
 */
const statusHandler = async (req, res) => {
  const { body } = req;
  const transactionId = _.get(body, "context.transaction_id");
  const messageId = _.get(body, "context.message_id");
  const bapId = _.get(body, "context.bap_id");
  const orderId = _.get(body, "message.order_id");

  res.status(200).json(sendAck()); // Send ACK immediately

  setImmediate(async () => {
    try {
      logger.info({ message: "Handling ONDC /status callback", transactionId, messageId, orderId });

      const token = await loginToOpenCart();
      if (!token) return;

      const currentStatus = await getOrderStatus(orderId, token, transactionId);
      if (!currentStatus) return;

      const mappedState = mapToOndcStatus(currentStatus);

      const bapCallbackUri = await getCallbackUri(bapId);
      if (!bapCallbackUri) {
        logger.error({ message: "Failed to resolve BAP callback URI", bapId, transactionId });
        return;
      }

      const onStatusPayload = {
        context: {
          ...body.context,
          action: "on_status",
          timestamp: new Date().toISOString(),
        },
        message: {
          order: {
            id: orderId,
            state: mappedState,
            fulfillments: [],
          },
        },
      };

      const signature = await signPayload(onStatusPayload);

      await axios.post(`${bapCallbackUri}/on_status`, onStatusPayload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: signature,
        },
        timeout: 8000,
      });

      logger.info({ message: "/on_status successfully sent to BAP", transactionId, state: mappedState });

    } catch (err) {
      logger.error({
        message: "Failed during post-ACK processing for /status",
        error: err.message,
        stack: err.stack,
        transactionId,
        messageId,
      });
    }
  });
};

export default statusHandler;
