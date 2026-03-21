import crypto from 'node:crypto';

const KEY_LENGTH = 64;

function toHex(buffer: Buffer) {
  return buffer.toString('hex');
}

export function hashPublicDashboardPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${toHex(salt)}:${toHex(derived)}`;
}

export function verifyPublicDashboardPassword(password: string, passwordHash: string) {
  const [saltHex, hashHex] = passwordHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, derived);
}

export function createShareToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function isExpiredTimestamp(timestamp: string | null) {
  if (!timestamp) return false;
  return new Date(timestamp).getTime() < Date.now();
}
