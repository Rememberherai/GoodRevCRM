import crypto from 'crypto';

export interface QuickBooksOAuthState {
  project_id: string;
  user_id: string;
  nonce: string;
  timestamp: number;
  type: 'quickbooks';
}

function getSigningKey() {
  const key = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!key) {
    throw new Error('QUICKBOOKS_CLIENT_SECRET is required for QuickBooks OAuth state signing');
  }
  return key;
}

export function signQuickBooksOAuthState(stateData: QuickBooksOAuthState) {
  const payload = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyQuickBooksOAuthState(rawState: string) {
  const parts = rawState.split('.');
  if (parts.length !== 2) return null;

  const payload = parts[0];
  const signature = parts[1];
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as QuickBooksOAuthState;
  } catch {
    return null;
  }
}
