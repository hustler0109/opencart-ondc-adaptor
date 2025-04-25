// middlewares/confirmMiddleware.js
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const logger = require('../utils/logger');
const {
  parseAuthorizationHeader,
  validateTimestamps,
  parseKeyId,
  lookupRegistryPublicKey,
  verifySignature,
  createNackResponse,
} = require('../utils/ondcUtils');

const confirmSchema = {
  type: 'object',
  properties: {
    context: {
      type: 'object',
      required: ['domain', 'action', 'country', 'city', 'core_version', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'],
      properties: {
        action: { const: 'confirm' }
      }
    },
    message: {
      type: 'object',
      required: ['order'],
    },
  },
  required: ['context', 'message'],
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateConfirm = ajv.compile(confirmSchema);

const confirmMiddleware = async (req, res, next) => {
  try {
    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));

    // Step 1: Validate request schema
    const isValid = validateConfirm(req.body);
    if (!isValid) {
      logger.warn({ message: "Schema validation failed", errors: validateConfirm.errors });
      return res.status(400).json(
        createNackResponse({
          type: 'DOMAIN-ERROR',
          code: '30001',
          message: 'Invalid confirm payload',
        })
      );
    }

    // Step 2: Parse and validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40101',
          message: 'Missing Authorization header',
        })
      );
    }

    const parsedHeader = parseAuthorizationHeader(authHeader);
    if (!parsedHeader || parsedHeader.algorithm !== 'ed25519' || parsedHeader.headers !== '(created) (expires) digest') {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40102',
          message: 'Invalid or malformed Authorization header',
        })
      );
    }

    const { created, expires, signature, keyId } = parsedHeader;
    if (!validateTimestamps(created, expires)) {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40103',
          message: 'Authorization timestamp invalid or expired',
        })
      );
    }

    // Step 3: Extract subscriberId and uniqueKeyId
    const { subscriberId, uniqueKeyId } = parseKeyId(keyId);
    if (!subscriberId || !uniqueKeyId) {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40104',
          message: 'Invalid keyId format',
        })
      );
    }

    // Step 4: Lookup public key from registry
    const publicKey = await lookupRegistryPublicKey(subscriberId, uniqueKeyId);
    if (!publicKey) {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40105',
          message: 'Public key not found for given subscriber ID',
        })
      );
    }

    // Step 5: Verify the signature
    const isVerified = await verifySignature(signature, created, expires, rawBodyBuffer, publicKey);
    if (!isVerified) {
      return res.status(401).json(
        createNackResponse({
          type: 'PROTOCOL-ERROR',
          code: '40106',
          message: 'Signature verification failed',
        })
      );
    }

    // Step 6: Set verified BAP ID
    req.verified_bap_id = subscriberId;

    logger.info({ message: 'Confirm payload verified successfully', bap_id: subscriberId });
    next();

  } catch (error) {
    logger.error({ message: 'Unexpected error in confirmMiddleware', error: error.message });
    return res.status(500).json(
      createNackResponse({
        type: 'INTERNAL-ERROR',
        code: '50000',
        message: 'Internal server error',
      })
    );
  }
};

module.exports = confirmMiddleware;