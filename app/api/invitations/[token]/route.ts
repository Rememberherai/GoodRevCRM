import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface InvitationResult {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  project: {
    id: string;
    name: string;
    slug: string;
  } | null;
  inviter: {
    full_name: string | null;
  } | null;
}

// GET /api/invitations/[token] - Get invitation details (public, no auth required)
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    // Validate token format (64 hex characters)
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 });
    }

    // Use admin client to bypass RLS since this is a public route
    const supabase = createAdminClient();

    // Fetch invitation with project and inviter details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation, error } = await (supabase as any)
      .from('project_invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        accepted_at,
        created_at,
        project:projects!project_id (
          id,
          name,
          slug
        ),
        inviter:users!invited_by (
          full_name
        )
      `)
      .eq('token', token)
      .single() as { data: InvitationResult | null; error: Error | null };

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if expired
    const isExpired = new Date(invitation.expires_at) < new Date();
    const isAccepted = invitation.accepted_at !== null;

    // Mask email for privacy (show first 2 chars + domain)
    const emailParts = invitation.email.split('@');
    const localPart = emailParts[0] || '';
    const domain = emailParts[1] || '';
    const maskedEmail =
      localPart.length > 2
        ? localPart.substring(0, 2) + '***@' + domain
        : '***@' + domain;

    return NextResponse.json({
      id: invitation.id,
      email: maskedEmail,
      full_email: invitation.email, // For matching with logged-in user
      role: invitation.role,
      expires_at: invitation.expires_at,
      created_at: invitation.created_at,
      is_expired: isExpired,
      is_accepted: isAccepted,
      project: invitation.project,
      inviter: {
        full_name: invitation.inviter?.full_name || 'A team member',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/invitations/[token]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
