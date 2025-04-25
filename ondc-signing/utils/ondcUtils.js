const Ajv = require('ajv');
const crypto = require('crypto');
const { getSubscriberPublicKey } = require('../services/registryService'); // You need to implement this service

const ajv = new Ajv();

// Basic schema for context validation (expand as needed)
const confirmSchema = {
  type: 'object',
  properties: {
    context: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        country: { type: 'string' },
        city: { type: 'string' },
        action: { type: 'string' },
        core_version: { type: 'string' },
        bap_id: { type: 'string' },
        transaction_id: { type: 'string' }
      },
      required: ['domain', 'action', 'core_version', 'bap_id', 'transaction_id']
    },
    message: { type: 'object' }
  },
  required: ['context', 'message']
};

const validateConfirmBody = ajv.compile(confirmSchema);

function parseAuthorizationHeader(authHeader) {
  if (!authHeader.startsWith('Signature ')) return null;

  const params = {};
  const parts = authHeader.slice(9).split(',');

  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    params[key] = value.replace(/(^"|"$)/g, '');
  }

  return params;
}

function isTimestampValid(created, expires, skew = 300) {
  const now = Math.floor(Date.now() / 1000);
  return (created <= now + skew) && (expires >= now - skew);
}

function createSignatureBaseString(params, headersList, rawBody) {
  const headers = headersList.split(' ');
  let signatureString = '';

  for (const header of headers) {
    switch (header.toLowerCase()) {
      case '(created)':
        signatureString += `(created): ${params.created}\n`;
        break;
      case '(expires)':
        signatureString += `(expires): ${params.expires}\n`;
        break;
      case 'digest':
        const hash = crypto.createHash('sha256').update(rawBody).digest('base64');
        signatureString += `digest: BLAKE-512=${hash}\n`; // Use SHA-256 or as per ONDC requirement
        break;
      default:
        throw new Error(`Unsupported signature header: ${header}`);
    }
  }

  return signatureString.trim();
}

async function verifyOndcSignature(req, rawBodyBuffer) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const signatureParams = parseAuthorizationHeader(authHeader);
  if (!signatureParams) {
    throw new Error('Malformed Authorization header');
  }

  const {
    keyId,
    algorithm,
    headers,
    signature,
    created,
    expires
  } = signatureParams;

  if (!keyId || !signature || !headers || !algorithm || !created || !expires) {
    throw new Error('Missing required signature parameters');
  }

  if (!isTimestampValid(Number(created), Number(expires))) {
    throw new Error('Signature timestamp expired or not valid');
  }

  const [subscriber_id, unique_key_id] = keyId.split('|');
  if (!subscriber_id || !unique_key_id) {
    throw new Error('Invalid keyId format in Authorization header');
  }

  const publicKey = await getSubscriberPublicKey(subscriber_id, unique_key_id);
  if (!publicKey) {
    throw new Error(`Public key not found for ${keyId}`);
  }

  const signatureBaseString = createSignatureBaseString(signatureParams, headers, rawBodyBuffer);

  const isVerified = crypto.verify(
    'sha256',
    Buffer.from(signatureBaseString),
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    },
    Buffer.from(signature, 'base64')
  );

  if (!isVerified) {
    throw new Error('Signature verification failed');
  }

  // If body is valid and signature is verified, return subscriber_id
  return subscriber_id;
}

module.exports = {
  verifyOndcSignature,
  validateConfirmBody
};
