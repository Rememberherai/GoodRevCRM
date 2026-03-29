import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPublicAppUrl } from '@/lib/url/get-public-url';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const publicAppUrl = getPublicAppUrl(request);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const errorDescription = searchParams.get('error_description');
  let next = searchParams.get('next') ?? '/projects';

  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/projects';
  }

  // Handle errors from Supabase (e.g., expired confirmation links)
  if (errorDescription) {
    const baseUrl = process.env.NODE_ENV === 'development' ? origin : publicAppUrl;
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  const supabase = await createClient();
  let authError = null;

  // Handle PKCE code exchange (OAuth, magic link)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  }
  // Handle token hash verification (email confirmation, password recovery)
  else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'recovery' | 'email' | 'magiclink',
    });
    authError = error;
  }

  if (!authError && (code || token_hash)) {
    const isLocalEnv = process.env.NODE_ENV === 'development';

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      return NextResponse.redirect(`${publicAppUrl}${next}`);
    }
  }

  // Return the user to an error page with instructions
  const baseUrl = process.env.NODE_ENV === 'development' ? origin : publicAppUrl;
  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_error`);
}
