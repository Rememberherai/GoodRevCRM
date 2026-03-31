import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/gmail/oauth';
import { getPublicAppUrl } from '@/lib/url/get-public-url';
import crypto from 'crypto';

export function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET or NEXTAUTH_SECRET must be set for Gmail OAuth');
  }
  return secret;
}

export function signOAuthState(payload: string): string {
  return crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('base64url');
}

// GET /api/gmail/connect - Initiate Gmail OAuth flow
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a secure state parameter
    const stateData = {
      user_id: user.id,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };

    // Encode state as base64 and sign with HMAC to prevent tampering
    const payload = Buffer.from(JSON.stringify(stateData)).toString('base64url');
    const sig = signOAuthState(payload);
    const state = `${payload}.${sig}`;

    // Generate authorization URL
    const appUrl = getPublicAppUrl(request);
    const authUrl = getAuthorizationUrl(state, {
      redirectUri: `${appUrl}/api/gmail/callback`,
    });

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error in GET /api/gmail/connect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
