import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { getRpId } from '@/lib/webauthn';

// POST /api/auth/webauthn/authenticate/options
// Returns authentication options. Unauthenticated route.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string };
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const rpID = getRpId(request);
    const normalizedEmail = email.toLowerCase().trim();

    // Look up credentials for this email. Use admin to bypass RLS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userRow } = await (admin as any)
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];

    if (userRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: credentials } = await (admin as any)
        .from('webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', userRow.id);

      allowCredentials = (credentials ?? []).map(
        (c: { credential_id: string; transports: string[] | null }) => ({
          id: c.credential_id,
          transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
        })
      );
    }

    // Always return valid-looking options even if user/credentials not found
    // to prevent email enumeration
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Clean up any stale challenges for this email before inserting a new one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteChallengeError } = await (admin as any)
      .from('webauthn_challenges')
      .delete()
      .eq('email', normalizedEmail)
      .eq('type', 'authentication');

    if (deleteChallengeError) {
      console.error('Error clearing authentication challenges:', deleteChallengeError);
      return NextResponse.json({ error: 'Failed to create authentication challenge' }, { status: 500 });
    }

    // Store challenge. email stored so verify route can look up the user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertChallengeError } = await (admin as any).from('webauthn_challenges').insert({
      user_id: userRow?.id ?? null,
      email: normalizedEmail,
      challenge: options.challenge,
      type: 'authentication',
    });

    if (insertChallengeError) {
      console.error('Error storing authentication challenge:', insertChallengeError);
      return NextResponse.json({ error: 'Failed to create authentication challenge' }, { status: 500 });
    }

    return NextResponse.json(options);
  } catch (error) {
    console.error('Error in POST /api/auth/webauthn/authenticate/options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
