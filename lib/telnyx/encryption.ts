// Encryption utilities for sensitive Telnyx credentials
// Uses AES-256-GCM for authenticated encryption

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TELNYX_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TELNYX_ENCRYPTION_KEY environment variable is required');
  }
  // Key should be 32 bytes (256 bits) for AES-256
  // If provided as hex string (64 chars), convert to buffer
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise, hash it to get consistent 32 bytes
  const { createHash } = require('crypto');
  return createHash('sha256').update(key).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a ciphertext string encrypted with encryptApiKey
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decryptApiKey(ciphertext: string): string {
  // Check if this is already plaintext (migration support)
  if (!ciphertext.includes(':') || ciphertext.startsWith('KEY_')) {
    return ciphertext;
  }

  const key = getEncryptionKey();
  const [ivBase64, authTagBase64, encryptedBase64] = ciphertext.split(':');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted API key format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Checks if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  // Encrypted values have format: iv:authTag:ciphertext (base64:base64:base64)
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  // Check if all parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => base64Regex.test(part));
}
