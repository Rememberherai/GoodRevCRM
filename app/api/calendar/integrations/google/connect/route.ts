import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { CALENDAR_SCOPES } from '@/lib/calendar/google-calendar';
import { signOAuthState } from '@/lib/calendar/oauth-state';
import { getPublicAppUrl } from '@/lib/url/get-public-url';
import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// GET /api/calendar/integrations/google/connect — Initiate Google Calendar OAuth
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = getPublicAppUrl(request);
    if (!clientId || !appUrl) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    const redirectUri = `${appUrl}/api/calendar/integrations/google/callback`;

    const stateData = {
      user_id: user.id,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      type: 'calendar',
    };
    const state = signOAuthState(stateData);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: CALENDAR_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true', // Incremental auth — preserve existing Gmail scopes
    });

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  } catch (error) {
    console.error('Error in GET /api/calendar/integrations/google/connect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
