const { validateSchema } = require("../utils/schemaValidator");
const { verifyOndcSignature } = require("../utils/ondcUtils");
const logger = require("../utils/logger");

/**
 * Middleware to authenticate and validate /on_status requests.
 */
const processOnStatusRequest = async (req, res, next) => {
  const { body } = req;
  const transactionId = body?.context?.transaction_id;
  const messageId = body?.context?.message_id;

  logger.info({ message: "Received /on_status request", transactionId, messageId });

  // Schema validation
  const schemaResult = validateSchema(body, "on_status");
  if (!schemaResult.valid) {
    logger.error({ message: "Schema validation failed", errors: schemaResult.errors });
    return res.status(400).json({
      message: { ack: { status: "NACK" } },
      error: {
        type: "JSON-SCHEMA-ERROR",
        code: "50009",
        message: "Payload failed schema validation",
      },
    });
  }

  // Signature verification
  const verified = await verifyOndcSignature(req);
  if (!verified) {
    logger.warn({ message: "Signature verification failed", transactionId, messageId });
    return res.status(401).json({
      message: { ack: { status: "NACK" } },
      error: {
        type: "CONTEXT-ERROR",
        code: "10001",
        message: "Signature verification failed",
      },
    });
  }

  next();
};

module.exports = { processOnStatusRequest };
