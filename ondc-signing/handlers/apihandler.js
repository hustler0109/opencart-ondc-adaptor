// const apiHandler = (req, res, next) => {
//     console.log("API reached");
//     //login verification 
    
//     next();
//   };
  
//   export default apiHandler;
  
import { verifySignature } from '../auth/signatureVerifier.js';
import config from '../utils/config.js';
import logger from '../utils/logger.js';
// Assume a function that gets the public key by ukId
import { lookupPublicKeyByUkId } from '../utils/lookupPublicKeyByUkId.js'; 

const apiHandler = async (req, res, next) => {
  try {
     // 🛠 Bypass auth in dev mode
     const isDevMode = req.headers['x-dev-mode'] === 'true';
     if (isDevMode) {
       logger.info('🛠 Developer mode enabled – skipping signature verification');
       return next();
     }
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Parse Authorization header
    const authParams = {};
    authHeader
      .replace(/^Signature\s+/i, '')
      .split(',')
      .forEach(part => {
        const [key, value] = part.split('=');
        authParams[key.trim()] = value.trim().replace(/(^"|"$)/g, '');
      });

    const {
      signature,
      digest: providedDigest,
      keyId,
      created,
      expires
    } = authParams;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (Number(expires) < now) {
      return res.status(401).json({ error: 'Signature expired' });
    }

    // Extract ukId from keyId
    const [, ukId] = keyId.split('|');
    if (!ukId) {
      return res.status(401).json({ error: 'Invalid keyId format' });
    }

    // Lookup public key from registry
    const publicKey = await lookupPublicKeyByUkId(ukId);
    if (!publicKey) {
      return res.status(401).json({ error: 'Public key not found for ukId' });
    }

    // Raw request body (string or Buffer)
    const rawBody = req.rawBody || JSON.stringify(req.body); // make sure req.rawBody is populated by body-parser middleware

    // Verify signature
    const isVerified = await verifySignature(rawBody, signature, providedDigest, publicKey);
    if (!isVerified) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    logger.info('Signature verified successfully');
    next();
  } catch (error) {
    logger.error('Error in auth middleware', { error: error.message });
    res.status(401).json({ error: 'Signature verification failed' });
  }
};

export default apiHandler;
