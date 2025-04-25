const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const ondcUtils = require("../utils/ondcUtils");
const logger = require("../utils/logger");
const { createNackResponse } = require("../utils/ondcUtils");

// --- Load and Compile ONDC /status Schema ---
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

let validateStatusSchema;
try {
  const schema = require("../schema/status.json"); // <-- Replace with your actual schema path
  validateStatusSchema = ajv.compile(schema);
  logger.info({ message: "Loaded and compiled /status schema successfully" });
} catch (err) {
  logger.error({ message: "Failed to load ONDC /status schema", error: err.message });
  validateStatusSchema = null;
}

/**
 * Middleware: Validates schema and signature for /status.
 */
const processStatusRequest = async (req, res, next) => {
  const context = req.body?.context || {};
  const transactionId = context.transaction_id;
  const messageId = context.message_id;
  const action = context.action;

  logger.info({ message: "Received request on /status endpoint", transactionId, messageId });

  // --- Schema Validation ---
  if (!validateStatusSchema) {
    logger.error({ message: "Schema not available at runtime", transactionId });
    return res.status(500).json(createNackResponse({
      type: "CORE_ERROR",
      code: "SCHEMA_MISSING",
      message: "Schema validation not configured",
    }));
  }

  const valid = validateStatusSchema(req.body);
  if (!valid) {
    const firstError = validateStatusSchema.errors?.[0] || {};
    logger.warn({ message: "Schema validation failed", errors: validateStatusSchema.errors, transactionId });
    return res.status(400).json(createNackResponse({
      type: "DOMAIN_ERROR",
      code: "SCHEMA_VALIDATION_FAILED",
      message: `Schema error: ${firstError.instancePath} ${firstError.message}`,
    }));
  }

  // --- Signature Validation ---
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    logger.warn({ message: "Missing authorization header", transactionId });
    return res.status(401).json(createNackResponse({
      type: "AUTH_ERROR",
      code: "AUTH_HEADER_MISSING",
      message: "Authorization header is missing",
    }));
  }

  try {
    const parsed = ondcUtils.parseAuthorizationHeader(authHeader);
    if (!parsed) {
      return res.status(401).json(createNackResponse({
        type: "AUTH_ERROR",
        code: "AUTH_HEADER_INVALID",
        message: "Authorization header format is invalid",
      }));
    }

    const { subscriberId, uniqueKeyId } = ondcUtils.parseKeyId(parsed.keyId);
    if (!subscriberId || !uniqueKeyId) {
      return res.status(401).json(createNackResponse({
        type: "AUTH_ERROR",
        code: "KEY_ID_PARSE_FAIL",
        message: "Failed to parse keyId",
      }));
    }

    const isTimestampValid = ondcUtils.validateTimestamps(parsed.created, parsed.expires);
    if (!isTimestampValid) {
      return res.status(401).json(createNackResponse({
        type: "AUTH_ERROR",
        code: "TIMESTAMP_INVALID",
        message: "Signature timestamps invalid or expired",
      }));
    }

    const publicKey = await ondcUtils.lookupRegistryPublicKey(subscriberId, uniqueKeyId);
    if (!publicKey) {
      return res.status(401).json(createNackResponse({
        type: "AUTH_ERROR",
        code: "PUBLIC_KEY_NOT_FOUND",
        message: "Public key not found in registry",
      }));
    }

    const signatureValid = await ondcUtils.verifySignature(
      parsed.signature,
      parsed.created,
      parsed.expires,
      req.rawBodyBuffer, // Ensure raw buffer is set in app.js middleware
      publicKey
    );

    if (!signatureValid) {
      return res.status(401).json(createNackResponse({
        type: "AUTH_ERROR",
        code: "SIGNATURE_INVALID",
        message: "Signature verification failed",
      }));
    }

    // Set BAP ID for downstream use
    req.verified_bap_id = subscriberId;
    logger.info({ message: "Signature verified successfully", subscriberId, transactionId });

  } catch (err) {
    logger.error({ message: "Exception during signature verification", error: err.message, transactionId });
    return res.status(500).json(createNackResponse({
      type: "CORE_ERROR",
      code: "SIGNATURE_VERIFICATION_FAILED",
      message: "Internal error during signature verification",
    }));
  }

  next(); // All checks passed, proceed to handler
};

module.exports = { processStatusRequest };
