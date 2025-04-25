import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * return raw base64 decoded key
 */
const extractRawKeyFromPem = (pemKey) => {
  return Buffer.from(
    pemKey.replace(/-----BEGIN .* KEY-----|-----END .* KEY-----|\n/g, ''),
    'base64'
  );
};

/**
 * ED25519 key pair in base64 format
 */
const generateSigningKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    publicKey: extractRawKeyFromPem(publicKey).toString('base64'),
    privateKey: extractRawKeyFromPem(privateKey).toString('base64')
  };
};

/**
 * X25519 key pair in base64 format
 */
const generateEncryptionKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    publicKey: extractRawKeyFromPem(publicKey).toString('base64'),
    privateKey: extractRawKeyFromPem(privateKey).toString('base64')
  };
};

/**
 * Write key to file
 */
const writeKeyToFile = (dir, filename, key) => {
  fs.writeFileSync(path.resolve(dir, filename), key);
};

/**
 * Generate and save key pairs
 */
const generateAndSaveKeys = (outputDir = './keys') => {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const signingKeys = generateSigningKeyPair();
  writeKeyToFile(outputDir, 'signing_private_key.b64', signingKeys.privateKey);
  writeKeyToFile(outputDir, 'signing_public_key.b64', signingKeys.publicKey);

  const encryptionKeys = generateEncryptionKeyPair();
  writeKeyToFile(outputDir, 'encryption_private_key.b64', encryptionKeys.privateKey);
  writeKeyToFile(outputDir, 'encryption_public_key.b64', encryptionKeys.publicKey);

  console.log(`Keys saved to ${outputDir}`);
  console.log(`Signing Public Key: ${signingKeys.publicKey}`);
  console.log(`Encryption Public Key: ${encryptionKeys.publicKey}`);

  return { signingKeys, encryptionKeys };
};

/**
 * Load keys from env vars or fallback to file system
 */
const loadKeys = () => {
  const keysDir = process.env.KEYS_DIR || './keys';

  const getKey = (envVar, fileName) => {
    return process.env[envVar] || (
      fs.existsSync(path.resolve(keysDir, fileName)) ?
        fs.readFileSync(path.resolve(keysDir, fileName), 'utf8').trim() :
        null
    );
  };

  return {
    signingPublicKey: getKey('ONDC_SIGNING_PUBLIC_KEY', 'signing_public_key.b64'),
    signingPrivateKey: getKey('ONDC_SIGNING_PRIVATE_KEY', 'signing_private_key.b64'),
    encryptionPublicKey: getKey('ONDC_ENCRYPTION_PUBLIC_KEY', 'encryption_public_key.b64'),
    encryptionPrivateKey: getKey('ONDC_ENCRYPTION_PRIVATE_KEY', 'encryption_private_key.b64')
  };
};

// If run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAndSaveKeys();
}

export {
  generateSigningKeyPair,
  generateEncryptionKeyPair,
  generateAndSaveKeys,
  loadKeys
};
