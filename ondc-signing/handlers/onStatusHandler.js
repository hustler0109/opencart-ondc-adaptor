const _ = require("lodash");
const logger = require("../utils/logger");
const { sendAck } = require("../utils/sendResponse");
const { getValue, setValue } = require("../shared/cache");

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

  // Respond immediately with ACK
  const ackResponse = sendAck();

  // Idempotency check
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

  // After ACK, process the status update internally
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

      // 🔁 TODO: Save order status to your database
      // await updateOrderStatusInDb(orderId, orderState, fulfillments);

      // Cache ACK to avoid reprocessing
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

module.exports = onStatusHandler;
