import { createClient, createServiceClient } from '@/lib/supabase/server';
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
    console.log('[EMAIL_SEND] ====== START email send route ======');
    const { slug } = await context.params;
    console.log('[EMAIL_SEND] slug:', slug);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('[EMAIL_SEND] ERROR: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[EMAIL_SEND] user.id:', user.id, 'email:', user.email);

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      console.log('[EMAIL_SEND] ERROR: Project not found, slug:', slug, 'error:', projectError?.message);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.log('[EMAIL_SEND] project.id:', project.id);

    const body = await request.json();
    console.log('[EMAIL_SEND] request body keys:', Object.keys(body));

    // Extract and validate connection ID separately
    const { from_connection_id, ...emailData } = body;
    console.log('[EMAIL_SEND] from_connection_id:', from_connection_id);

    const connectionIdResult = z.string().uuid().safeParse(from_connection_id);
    if (!connectionIdResult.success) {
      console.log('[EMAIL_SEND] ERROR: Invalid connection ID:', from_connection_id);
      return NextResponse.json({ error: 'Valid Gmail connection ID required' }, { status: 400 });
    }

    // Validate email data
    const validationResult = sendEmailSchema.safeParse(emailData);

    if (!validationResult.success) {
      console.log('[EMAIL_SEND] ERROR: Validation failed:', JSON.stringify(validationResult.error.flatten()));
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    console.log('[EMAIL_SEND] validation passed, to:', validationResult.data.to, 'subject:', validationResult.data.subject);
    console.log('[EMAIL_SEND] entity IDs — person_id:', validationResult.data.person_id, 'organization_id:', validationResult.data.organization_id, 'opportunity_id:', validationResult.data.opportunity_id, 'rfp_id:', validationResult.data.rfp_id);

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get Gmail connection (user-scoped, not project-scoped)
    console.log('[EMAIL_SEND] fetching gmail connection id:', connectionIdResult.data, 'for user:', user.id);
    const { data: connection, error: connectionError } = await supabaseAny
      .from('gmail_connections')
      .select('*')
      .eq('id', connectionIdResult.data)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      console.log('[EMAIL_SEND] ERROR: Gmail connection not found, error:', connectionError?.message);
      return NextResponse.json({ error: 'Gmail connection not found' }, { status: 404 });
    }
    console.log('[EMAIL_SEND] gmail connection found, email:', connection.email, 'status:', connection.status);

    if (connection.status !== 'connected') {
      console.log('[EMAIL_SEND] ERROR: Gmail connection status is:', connection.status);
      return NextResponse.json(
        { error: 'Gmail connection is not active. Please reconnect.' },
        { status: 400 }
      );
    }

    // Send the email
    console.log('[EMAIL_SEND] calling sendEmail()...');
    const result = await sendEmail(
      connection as GmailConnection,
      validationResult.data,
      user.id,
      project.id
    );
    console.log('[EMAIL_SEND] sendEmail() returned:', JSON.stringify(result));

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

    console.log('[EMAIL_SEND] activity context — entityType:', entityType, 'entityId:', entityId, 'personId:', personId, 'organizationId:', organizationId);

    if (entityId) {
      try {
        console.log('[EMAIL_SEND] creating service client for activity insert...');
        // Use service role client to bypass RLS for activity logging
        const adminClient = createServiceClient() as any;
        console.log('[EMAIL_SEND] service client created, inserting activity_log...');
        const activityPayload = {
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
        };
        console.log('[EMAIL_SEND] activity payload:', JSON.stringify(activityPayload));
        const { data: activityData, error: activityError } = await adminClient.from('activity_log').insert(activityPayload).select();
        if (activityError) {
          console.error('[EMAIL_SEND] ERROR: Activity log insert failed:', activityError.message, activityError.code, activityError.details, activityError.hint);
        } else {
          console.log('[EMAIL_SEND] activity_log insert SUCCESS, data:', JSON.stringify(activityData));
        }
      } catch (activityErr) {
        // Don't fail the email send if activity logging fails
        console.error('[EMAIL_SEND] ERROR: Exception in activity logging:', activityErr);
      }
    } else {
      console.log('[EMAIL_SEND] WARNING: No entityId available, skipping activity log');
    }

    console.log('[EMAIL_SEND] ====== END email send route, returning success ======');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[EMAIL_SEND] ERROR: Unhandled exception in email send route:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
