import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;       // 256 bits
const IV_LEN = 12;        // 96 bits — GCM recommended fixed-length IV
const SALT_LEN = 16;      // 128-bit PBKDF2 salt, unique per encrypted value
const PBKDF2_ITERS = 100_000;
const PBKDF2_DIGEST = 'sha256';

export function deriveKey(passphrase, salt) {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, KEY_LEN, PBKDF2_DIGEST);
}

/**
 * Encrypts a plaintext token with AES-256-GCM using a key derived from the
 * passphrase via PBKDF2. Each call produces a unique salt + IV, so two calls
 * with the same input will produce different ciphertext.
 *
 * @param {string} plaintext - The token string to encrypt.
 * @param {string} passphrase - The encryption passphrase (never stored).
 * @returns {{ encrypted: string, iv: string, authTag: string, salt: string }} Base64-encoded components.
 */
export function encryptToken(plaintext, passphrase) {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

/**
 * Decrypts a token previously encrypted by {@link encryptToken}.
 * Throws if the passphrase is wrong or the ciphertext was tampered with
 * (AES-GCM authentication failure).
 *
 * @param {{ encrypted: string, iv: string, authTag: string, salt: string }} components - Base64-encoded components from encryptToken.
 * @param {string} passphrase - The passphrase used at encryption time.
 * @returns {string} The original plaintext token.
 */
export function decryptToken({ encrypted, iv, authTag, salt }, passphrase) {
  const key = deriveKey(passphrase, Buffer.from(salt, 'base64'));
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
