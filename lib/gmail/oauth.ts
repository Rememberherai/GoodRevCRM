import { z } from 'zod';
import type { GoogleOAuthTokens, GmailProfile } from '@/types/gmail';

// OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Required scopes for Gmail API
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Token response schema
const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string(),
  id_token: z.string().optional(),
});

// Userinfo response schema
const userinfoResponseSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

export class GmailOAuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GmailOAuthError';
  }
}

/**
 * Get OAuth configuration from environment
 */
function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new GmailOAuthError('Google OAuth credentials not configured');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate the authorization URL for Gmail OAuth
 */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getOAuthConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GmailOAuthError(`Failed to exchange code: ${error}`, 'token_exchange_failed', response.status);
  }

  const data = await response.json();
  const parsed = tokenResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new GmailOAuthError('Invalid token response from Google');
  }

  return parsed.data;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret } = getOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GmailOAuthError(`Failed to refresh token: ${error}`, 'token_refresh_failed', response.status);
  }

  const data = await response.json();
  const parsed = tokenResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new GmailOAuthError('Invalid token response from Google');
  }

  // Preserve the refresh token if not returned
  return {
    ...parsed.data,
    refresh_token: parsed.data.refresh_token ?? refreshToken,
  };
}

/**
 * Get user profile from Google
 */
export async function getUserProfile(accessToken: string): Promise<GmailProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GmailOAuthError('Failed to get user profile', 'profile_fetch_failed', response.status);
  }

  const data = await response.json();
  const parsed = userinfoResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new GmailOAuthError('Invalid profile response from Google');
  }

  return parsed.data;
}

/**
 * Revoke an access token
 */
export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    // Don't throw on revoke failure - token may already be revoked
    console.warn('Failed to revoke token:', await response.text());
  }
}

/**
 * Calculate token expiration timestamp
 */
export function calculateTokenExpiry(expiresIn: number): string {
  const expiryDate = new Date(Date.now() + expiresIn * 1000);
  return expiryDate.toISOString();
}

/**
 * Check if a token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= expiryTime - bufferTime;
}
