import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getRpId, getOrigin } from '@/lib/webauthn';

// POST /api/auth/webauthn/register/verify
// Verifies the registration response and stores the credential.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { response: RegistrationResponseJSON; deviceName?: string };
    const { response, deviceName } = body;

    const admin = createAdminClient();

    // Retrieve the stored challenge for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: challengeRow, error: challengeError } = await (admin as any)
      .from('webauthn_challenges')
      .select('id, challenge, expires_at')
      .eq('user_id', user.id)
      .eq('type', 'registration')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (challengeError || !challengeRow) {
      return NextResponse.json({ error: 'No pending registration challenge' }, { status: 400 });
    }

    if (new Date(challengeRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
    }

    const rpID = getRpId(request);
    const origin = getOrigin(request);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const trimmedDeviceName = deviceName?.trim();

    // Store the new credential
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (admin as any)
      .from('webauthn_credentials')
      .insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: response.response.transports ?? [],
        device_name: trimmedDeviceName || (credentialDeviceType === 'multiDevice' ? 'Synced passkey' : 'This device'),
      });

    if (insertError) {
      console.error('Error storing credential:', insertError);
      return NextResponse.json({ error: 'Failed to save credential' }, { status: 500 });
    }

    // Delete the used challenge after the credential is stored so a transient insert
    // failure does not force the user to restart the browser ceremony.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteChallengeError } = await (admin as any)
      .from('webauthn_challenges')
      .delete()
      .eq('id', challengeRow.id);

    if (deleteChallengeError) {
      console.error('Error clearing used registration challenge:', deleteChallengeError);
      return NextResponse.json({ error: 'Failed to finalize registration' }, { status: 500 });
    }

    // Log backup eligibility for info
    console.log(`Passkey registered for ${user.email}: deviceType=${credentialDeviceType}, backedUp=${credentialBackedUp}`);

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Error in POST /api/auth/webauthn/register/verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
