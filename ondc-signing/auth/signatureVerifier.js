import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Verify the signature of a request
 * @param {Buffer|string} body - Raw request body
 * @param {string} signature - Signature from the authorization header (Base64)
 * @param {string} providedDigest - Digest from the authorization header (Base64)
 * @param {string} publicKey - Public key from registry (Base64)
 * @returns {Promise<boolean>} - Verification result
 */
const verifySignature = async (body, signature, providedDigest, publicKey) => {
  try {
    const hashBuffer = generateBlake2bHash(body);
    const calculatedDigest = hashBuffer.toString('base64');

    if (providedDigest && providedDigest !== calculatedDigest) {
      logger.warn('Digest mismatch', {
        providedDigest,
        calculatedDigestPreview: `${calculatedDigest.slice(0, 20)}...`
      });
      return false;
    }

    const publicKeyBuffer = Buffer.from(publicKey, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');

    return verifyEd25519Signature(hashBuffer, signatureBuffer, publicKeyBuffer);
  } catch (error) {
    logger.error('Error during signature verification', {
      message: error.message,
      stack: error.stack
    });
    return false;
  }
};

/**
 * Generate Blake2b hash of the given data
 * @param {Buffer|string} data - Input data
 * @returns {Buffer} - Hash output
 */
const generateBlake2bHash = (data) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return crypto.createHash('blake2b512').update(buffer).digest();
};

/**
 * Verify ED25519 signature
 * @param {Buffer} message - Message hash to verify
 * @param {Buffer} signature - Signature to verify
 * @param {Buffer} publicKey - ED25519 public key
 * @returns {boolean} - Result of verification
 */
const verifyEd25519Signature = (message, signature, publicKey) => {
  try {
    return crypto.verify(null, message, { key: publicKey, format: 'raw' }, signature);
  } catch (error) {
    logger.error('ED25519 signature verification failed', {
      message: error.message
    });
    return false;
  }
};

export {
  verifySignature,
  generateBlake2bHash
};
