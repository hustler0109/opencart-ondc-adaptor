// middleware/onConfirmMiddleware.js

const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const logger = require("../utils/logger");
const { createNackResponse } = require("../utils/ondcUtils");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let validateSchema;
try {
  const schema = require("../schema/on_confirm_schema.json"); // ✅ Replace with correct path
  validateSchema = ajv.compile(schema);
  logger.info({ message: "ONDC /on_confirm schema compiled successfully." });
} catch (err) {
  logger.error({ message: "Failed to load /on_confirm schema.", error: err.message });
  validateSchema = null;
}

const validateOnConfirmSchema = (req, res, next) => {
  const transactionId = req.body?.context?.transaction_id;
  const messageId = req.body?.context?.message_id;

  if (!validateSchema) {
    logger.error({ message: "Schema validator unavailable.", transactionId, messageId });
    return res.status(500).json(createNackResponse({
      type: "CORE_ERROR",
      code: "50001",
      message: "Schema validation is not available."
    }));
  }

  const isValid = validateSchema(req.body);

  if (!isValid) {
    const error = validateSchema.errors?.[0];
    logger.warn({
      message: "Schema validation failed for /on_confirm.",
      errors: validateSchema.errors,
      transactionId,
      messageId
    });
    return res.status(400).json(createNackResponse({
      type: "DOMAIN_ERROR",
      code: "40001",
      message: `Schema validation failed: ${error?.instancePath || 'body'} ${error?.message || ''}`
    }));
  }

  logger.info({ message: "Schema validation passed for /on_confirm", transactionId, messageId });
  next();
};

module.exports = validateOnConfirmSchema;
