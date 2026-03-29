import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getRpId, getOrigin, getWebAuthnConfig } from '@/lib/webauthn';

// POST /api/auth/webauthn/authenticate/verify
// Verifies the authentication assertion and returns a Supabase magic link URL.
// Unauthenticated route.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { response: AuthenticationResponseJSON; email: string };
    const { response, email } = body;

    if (!email || !response) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();
    const normalizedEmail = email.toLowerCase().trim();
    const rpID = getRpId(request);
    const origin = getOrigin(request);

    // Retrieve the stored challenge for this email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: challengeRow, error: challengeError } = await (admin as any)
      .from('webauthn_challenges')
      .select('id, challenge, user_id, expires_at')
      .eq('email', normalizedEmail)
      .eq('type', 'authentication')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (challengeError || !challengeRow) {
      return NextResponse.json({ error: 'No pending authentication challenge' }, { status: 400 });
    }

    if (new Date(challengeRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
    }

    // Retrieve the credential being used
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: credentialRow, error: credError } = await (admin as any)
      .from('webauthn_credentials')
      .select('id, credential_id, public_key, counter, transports, user_id')
      .eq('credential_id', response.id)
      .single();

    if (credError || !credentialRow) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
    }

    const { data: credentialOwnerData, error: credentialOwnerError } = await admin.auth.admin.getUserById(
      credentialRow.user_id
    );
    const credentialOwnerEmail = credentialOwnerData.user?.email?.toLowerCase().trim();

    if (credentialOwnerError || !credentialOwnerEmail) {
      console.error('Error resolving credential owner:', credentialOwnerError);
      return NextResponse.json({ error: 'Credential owner not found' }, { status: 400 });
    }

    // Verify the credential actually belongs to the user who initiated the challenge
    if (challengeRow.user_id && credentialRow.user_id !== challengeRow.user_id) {
      return NextResponse.json({ error: 'Credential mismatch' }, { status: 401 });
    }

    if (credentialOwnerEmail !== normalizedEmail) {
      return NextResponse.json({ error: 'Credential mismatch' }, { status: 401 });
    }

    // Decode the stored base64 public key back to Uint8Array
    const publicKeyBytes = Uint8Array.from(Buffer.from(credentialRow.public_key, 'base64'));

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialRow.credential_id,
        publicKey: publicKeyBytes,
        counter: credentialRow.counter,
        transports: credentialRow.transports ?? [],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
    }

    // Delete used challenge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteChallengeError } = await (admin as any)
      .from('webauthn_challenges')
      .delete()
      .eq('id', challengeRow.id);

    if (deleteChallengeError) {
      console.error('Error clearing used authentication challenge:', deleteChallengeError);
      return NextResponse.json({ error: 'Failed to finalize authentication' }, { status: 500 });
    }

    // Update counter and last_used_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateCredentialError } = await (admin as any)
      .from('webauthn_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', credentialRow.id);

    if (updateCredentialError) {
      console.error('Error updating credential usage:', updateCredentialError);
      return NextResponse.json({ error: 'Failed to finalize authentication' }, { status: 500 });
    }

    // Generate a Supabase magic link so the frontend can establish a session
    // without needing a password or sending an email.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: credentialOwnerEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('Error generating magic link:', linkError);
      return NextResponse.json({ error: 'Failed to create session token' }, { status: 500 });
    }

    // Return the token_hash and type so the frontend can redirect through /auth/callback
    const { appUrl } = getWebAuthnConfig(request);
    const callbackUrl = `${appUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink`;

    return NextResponse.json({ callbackUrl });
  } catch (error) {
    console.error('Error in POST /api/auth/webauthn/authenticate/verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
