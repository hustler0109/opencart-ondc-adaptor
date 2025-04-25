const express = require('express');
const signatureVerifier = require('./signatureVerifier');
const registryService = require('./registryService');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errorHandler');

const app = express();

// Middleware to parse raw body
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

/**
 * Authentication middleware to verify ONDC signature
 */
const verifyAuthentication = async (req, res, next) => {
  try {
    // Allow unauthenticated access for health check and internal routes
    if (['/health'].includes(req.path) || req.path.startsWith('/internal/')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logAndThrow('Missing authorization header', req.path);
    }

    const authComponents = parseAuthHeader(authHeader);
    if (!authComponents) {
      logAndThrow('Invalid authorization header format', req.path);
    }

    const { subscriberId, ukId, algorithm, signature, digest } = authComponents;

    const subscriber = await registryService.lookupSubscriber(subscriberId, ukId);
    if (!subscriber) {
      logAndThrow('Subscriber not found', req.path, { subscriberId, ukId });
    }

    const isValid = await signatureVerifier.verifySignature(
      req.rawBody,
      signature,
      digest,
      subscriber.signing_public_key
    );

    if (!isValid) {
      logAndThrow('Signature verification failed', req.path, { subscriberId, ukId });
    }

    req.subscriber = subscriber;
    next();
  } catch (error) {
    handleAuthError(res, error);
  }
};

/**
 * Helper to parse Authorization header into structured components
 */
const parseAuthHeader = (authHeader) => {
  try {
    if (!authHeader.startsWith('Signature ')) return null;

    const signaturePart = authHeader.slice(10); // Remove "Signature "
    const regex = /([a-zA-Z0-9_]+)="([^"]*)"/g;
    const components = {};

    let match;
    while ((match = regex.exec(signaturePart)) !== null) {
      components[match[1]] = match[2];
    }

    if (!components.keyId || !components.signature || !components.algorithm) return null;

    const [subscriberId, ukId, keyAlgorithm] = components.keyId.split('|');
    if (!subscriberId || !ukId || !keyAlgorithm) return null;

    return {
      subscriberId,
      ukId,
      algorithm: components.algorithm,
      signature: components.signature,
      digest: components.digest || null,
      created: components.created,
      expires: components.expires
    };
  } catch (error) {
    logger.error('Error parsing auth header', { error: error.message });
    return null;
  }
};

/**
 * Helper to handle and format errors
 */
const handleAuthError = (res, error) => {
  const status = error instanceof ApiError ? error.status : 401;
  const message = error instanceof ApiError ? error.message : 'Authentication failed';

  logger.error('Authentication error', { error: error.message, stack: error.stack });

  return res.status(status).json({
    message: { ack: { status: 'NACK' } },
    error: { code: String(status), message }
  });
};

/**
 * Helper to log warning and throw custom error
 */
const logAndThrow = (msg, path, meta = {}) => {
  logger.warn(msg, { path, ...meta });
  throw new ApiError(msg, 401);
};

module.exports = { verifyAuthentication };
