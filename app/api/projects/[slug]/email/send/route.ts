import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmailSchema } from '@/lib/validators/gmail';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/email/send - Send an email
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();

    // Extract and validate connection ID separately
    const { from_connection_id, ...emailData } = body;

    const connectionIdResult = z.string().uuid().safeParse(from_connection_id);
    if (!connectionIdResult.success) {
      return NextResponse.json({ error: 'Valid Gmail connection ID required' }, { status: 400 });
    }

    // Validate email data
    const validationResult = sendEmailSchema.safeParse(emailData);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get Gmail connection (user-scoped, not project-scoped)
    const { data: connection, error: connectionError } = await supabaseAny
      .from('gmail_connections')
      .select('*')
      .eq('id', connectionIdResult.data)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Gmail connection not found' }, { status: 404 });
    }

    if (connection.status !== 'connected') {
      return NextResponse.json(
        { error: 'Gmail connection is not active. Please reconnect.' },
        { status: 400 }
      );
    }

    // Send the email
    const result = await sendEmail(
      connection as GmailConnection,
      validationResult.data,
      user.id,
      project.id
    );

    // Log activity for the sent email
    const personId = validationResult.data.person_id ?? null;
    const organizationId = validationResult.data.organization_id ?? null;
    const opportunityId = validationResult.data.opportunity_id ?? null;
    const rfpId = validationResult.data.rfp_id ?? null;

    // Determine entity context for the activity log
    // Use the most specific entity link available; fall back to sent_email_id only if it's a valid UUID
    const entityType = personId
      ? 'person'
      : organizationId
        ? 'organization'
        : opportunityId
          ? 'opportunity'
          : rfpId
            ? 'rfp'
            : 'email';
    const linkedEntityId = personId ?? organizationId ?? opportunityId ?? rfpId;
    const entityId = linkedEntityId || (result.sent_email_id || null);

    if (entityId) {
      try {
        await supabaseAny.from('activity_log').insert({
          project_id: project.id,
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          action: 'logged',
          activity_type: 'email',
          outcome: 'email_sent',
          direction: 'outbound',
          subject: validationResult.data.subject,
          notes: validationResult.data.body_text || validationResult.data.body_html.replace(/<[^>]*>/g, '').slice(0, 1000),
          person_id: personId,
          organization_id: organizationId,
          opportunity_id: opportunityId,
          rfp_id: rfpId,
          metadata: {
            sent_email_id: result.sent_email_id,
            message_id: result.message_id,
            to: validationResult.data.to,
          },
        });
      } catch (activityError) {
        // Don't fail the email send if activity logging fails
        console.error('Failed to log email activity:', activityError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/email/send:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
