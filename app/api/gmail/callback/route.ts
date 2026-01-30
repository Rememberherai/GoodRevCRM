import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getUserProfile,
  calculateTokenExpiry,
  GmailOAuthError,
} from '@/lib/gmail/oauth';

interface OAuthState {
  user_id: string;
  project_id: string;
  nonce: string;
  timestamp: number;
}

// GET /api/gmail/callback - Handle Gmail OAuth callback
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    // Get base URL for redirects
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Handle OAuth errors from Google
    if (error) {
      console.error('Gmail OAuth error:', error);
      return NextResponse.redirect(`${appUrl}/projects?gmail_error=${encodeURIComponent(error)}`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${appUrl}/projects?gmail_error=missing_params`);
    }

    // Decode and validate state
    let state: OAuthState;
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    } catch {
      return NextResponse.redirect(`${appUrl}/projects?gmail_error=invalid_state`);
    }

    // Verify state is not too old (10 minutes max)
    const stateAge = Date.now() - state.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.redirect(`${appUrl}/projects?gmail_error=state_expired`);
    }

    // Verify user is authenticated and matches state
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== state.user_id) {
      return NextResponse.redirect(`${appUrl}/login?redirect=/projects`);
    }

    // Get project slug for redirect
    const { data: project } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', state.project_id)
      .single();

    const redirectPath = project ? `/projects/${project.slug}/settings` : '/projects';

    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);

      // Get user profile from Google
      const profile = await getUserProfile(tokens.access_token);

      // Check if connection already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;

      const { data: existingConnection } = await supabaseAny
        .from('gmail_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', state.project_id)
        .eq('email', profile.email)
        .single();

      const connectionData = {
        user_id: user.id,
        project_id: state.project_id,
        email: profile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? '',
        token_expires_at: calculateTokenExpiry(tokens.expires_in),
        status: 'connected',
        updated_at: new Date().toISOString(),
      };

      if (existingConnection) {
        // Update existing connection
        await supabaseAny
          .from('gmail_connections')
          .update(connectionData)
          .eq('id', existingConnection.id);
      } else {
        // Create new connection
        await supabaseAny
          .from('gmail_connections')
          .insert({
            ...connectionData,
            created_at: new Date().toISOString(),
          });
      }

      // Redirect back to settings with success
      return NextResponse.redirect(`${appUrl}${redirectPath}?gmail_connected=true`);
    } catch (oauthError) {
      console.error('Gmail OAuth token exchange error:', oauthError);
      const errorCode = oauthError instanceof GmailOAuthError ? oauthError.code : 'token_error';
      return NextResponse.redirect(`${appUrl}${redirectPath}?gmail_error=${errorCode}`);
    }
  } catch (error) {
    console.error('Error in GET /api/gmail/callback:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/projects?gmail_error=internal_error`);
  }
}
