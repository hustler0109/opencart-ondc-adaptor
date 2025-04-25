const logger = require("../utils/logger");
const verifyHeader = require("../utils/verifyHeader");
const validateSchema = require("../utils/schemaValidator");
const updateSchema = require("../utils/schemas/updateSchema.json"); // Update with correct relative path

const updateMiddleware = async (req, res, next) => {
  try {
    const action = "update";

    // 1. Verify the request header and extract the BPP ID
    const { headerSignature, bppId } = await verifyHeader(req, action);
    req.verified_header_signature = headerSignature;
    req.verified_bpp_id = bppId;

    // 2. Validate the body schema
    const schemaValidationResult = validateSchema(req.body, updateSchema);

    if (!schemaValidationResult.valid) {
      logger.warn({
        message: "Schema validation failed for /update",
        errors: schemaValidationResult.errors,
      });

      return res.status(400).json({
        error: "Invalid request schema for /update",
        details: schemaValidationResult.errors,
      });
    }

    logger.info({
      message: "Incoming /update request passed all middleware checks",
      bppId,
      transactionId: req.body?.context?.transaction_id,
      messageId: req.body?.context?.message_id,
    });

    next(); // Proceed to the actual handler

  } catch (error) {
    logger.error({
      message: "Error in updateMiddleware",
      error: error.message,
      stack: error.stack,
    });

    res.status(401).json({
      error: "Unauthorized or malformed request in /update",
    });
  }
};

module.exports = updateMiddleware;
