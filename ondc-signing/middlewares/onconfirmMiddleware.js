import Ajv from "ajv";
import addFormats from "ajv-formats";
import logger from "../utils/logger.js";
import { createNackResponse } from "../utils/ondcUtils.js";
import onConfirmSchema from "../utils/schemas/on_confirm_schema.json" assert { type: "json" }; // ✅ Correct static JSON import

// Setup AJV
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Compile schema immediately
let validateSchema;
try {
  validateSchema = ajv.compile(onConfirmSchema);
  logger.info({ message: "ONDC /on_confirm schema compiled successfully." });
} catch (err) {
  logger.error({ message: "Failed to compile /on_confirm schema.", error: err.message });
  validateSchema = null;
}

// --- Middleware: Authentication Stub (replace with real signature verification later)
const authenticateSnpRequest = (req, res, next) => {
  next();
};

// --- Middleware: Validate /on_confirm Schema
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

// --- Exports
export default authenticateSnpRequest;
export { validateOnConfirmSchema };
