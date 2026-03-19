import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserProfile, calculateTokenExpiry } from '@/lib/gmail/oauth';
import { verifyOAuthState } from '@/lib/calendar/oauth-state';
import { z } from 'zod';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string(),
});

// GET /api/calendar/integrations/google/callback
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectPath = '/calendar/integrations';

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Calendar OAuth error:', error);
      const KNOWN_ERRORS: Record<string, string> = {
        access_denied: 'access_denied',
        invalid_scope: 'invalid_scope',
        server_error: 'server_error',
      };
      const safeError = KNOWN_ERRORS[error] ?? 'oauth_error';
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=${safeError}`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=missing_params`);
    }

    // Verify HMAC signature and decode state
    const state = verifyOAuthState(stateParam);
    if (!state) {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=invalid_state`);
    }

    if (state.type !== 'calendar') {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=invalid_state`);
    }

    // Verify state age (10 minutes max)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=state_expired`);
    }

    // Verify user matches
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.user_id) {
      return NextResponse.redirect(`${appUrl}/login?redirect=${encodeURIComponent(redirectPath)}`);
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error('Calendar OAuth callback: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=internal_error`);
    }
    const redirectUri = `${appUrl}/api/calendar/integrations/google/callback`;

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Calendar token exchange failed:', errorText);
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=token_error`);
    }

    const tokenData = await tokenRes.json();
    const parsed = tokenResponseSchema.safeParse(tokenData);
    if (!parsed.success) {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=invalid_token`);
    }

    const tokens = parsed.data;
    const grantedScopes = tokens.scope.split(' ');

    // Verify calendar scopes were granted
    const requiredScope = 'https://www.googleapis.com/auth/calendar.readonly';
    if (!grantedScopes.includes(requiredScope)) {
      return NextResponse.redirect(`${appUrl}${redirectPath}?error=insufficient_scopes`);
    }

    // Get user profile (email)
    const profile = await getUserProfile(tokens.access_token);

    // Check for existing Gmail connection to link
    const serviceClient = createServiceClient();
    const { data: gmailConn } = await serviceClient
      .from('gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', profile.email)
      .limit(1)
      .maybeSingle();

    // Check for existing calendar integration
    const { data: existing } = await serviceClient
      .from('calendar_integrations')
      .select('id, refresh_token')
      .eq('user_id', user.id)
      .eq('email', profile.email)
      .maybeSingle();

    const integrationData = {
      user_id: user.id,
      provider: 'google' as const,
      email: profile.email,
      gmail_connection_id: gmailConn?.id ?? null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: calculateTokenExpiry(tokens.expires_in),
      granted_scopes: grantedScopes,
      status: 'connected' as const,
      sync_enabled: true,
      push_enabled: true,
      is_primary: true,
    };

    if (existing) {
      const { error: updateError } = await serviceClient
        .from('calendar_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Calendar integration update failed:', updateError.message);
        return NextResponse.redirect(`${appUrl}${redirectPath}?error=save_error`);
      }
    } else {
      const { error: insertError } = await serviceClient
        .from('calendar_integrations')
        .insert(integrationData);
      if (insertError) {
        console.error('Calendar integration insert failed:', insertError.message);
        return NextResponse.redirect(`${appUrl}${redirectPath}?error=save_error`);
      }
    }

    return NextResponse.redirect(`${appUrl}${redirectPath}?connected=true`);
  } catch (err) {
    console.error('Error in calendar OAuth callback:', err);
    return NextResponse.redirect(`${appUrl}${redirectPath}?error=internal_error`);
  }
}
