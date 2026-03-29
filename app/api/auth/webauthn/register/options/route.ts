import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getRpId, WEBAUTHN_RP_NAME } from '@/lib/webauthn';

// POST /api/auth/webauthn/register/options
// Returns registration options for the authenticated user.
// Requires the user to already be logged in.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch existing credentials so we can exclude them from the prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCredentials } = await (admin as any)
      .from('webauthn_credentials')
      .select('credential_id, transports')
      .eq('user_id', user.id);

    const excludeCredentials = (existingCredentials ?? []).map(
      (c: { credential_id: string; transports: string[] | null }) => ({
        id: c.credential_id,
        transports: c.transports ?? [],
      })
    );

    const rpID = getRpId(request);

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID,
      userName: user.email,
      userDisplayName: user.user_metadata?.full_name ?? user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Clean up stale registration challenges for this user before inserting a new one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteChallengeError } = await (admin as any)
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'registration');

    if (deleteChallengeError) {
      console.error('Error clearing registration challenges:', deleteChallengeError);
      return NextResponse.json({ error: 'Failed to create registration challenge' }, { status: 500 });
    }

    // Store challenge (expires in 5 minutes, handled by DB default)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertChallengeError } = await (admin as any).from('webauthn_challenges').insert({
      user_id: user.id,
      email: user.email,
      challenge: options.challenge,
      type: 'registration',
    });

    if (insertChallengeError) {
      console.error('Error storing registration challenge:', insertChallengeError);
      return NextResponse.json({ error: 'Failed to create registration challenge' }, { status: 500 });
    }

    return NextResponse.json(options);
  } catch (error) {
    console.error('Error in POST /api/auth/webauthn/register/options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
