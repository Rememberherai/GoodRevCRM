import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { acceptInvitationSchema } from '@/lib/validators/user';

// POST /api/invitations/accept - Accept an invitation
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = acceptInvitationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = validationResult.data;

    // Call the accept_invitation RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any).rpc('accept_invitation', {
      p_token: token,
    });

    if (error) {
      console.error('Error accepting invitation:', error);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // The RPC returns a JSONB result
    if (!result.success) {
      // Map specific errors to appropriate status codes
      if (result.error === 'Not authenticated') {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      if (result.error === 'Email does not match invitation') {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error === 'Invalid or expired invitation') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Success - return the project_id so frontend can redirect
    return NextResponse.json({
      success: true,
      message: result.message || 'Invitation accepted',
      project_id: result.project_id,
    });
  } catch (error) {
    console.error('Error in POST /api/invitations/accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
