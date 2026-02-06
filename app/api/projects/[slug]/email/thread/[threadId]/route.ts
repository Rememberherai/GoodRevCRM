import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { SyncedEmail } from '@/types/gmail';

interface RouteContext {
  params: Promise<{ slug: string; threadId: string }>;
}

const GMAIL_THREAD_ID_REGEX = /^[a-f0-9]+$/i;
const MAX_THREAD_MESSAGES = 200;

/**
 * GET /api/projects/[slug]/email/thread/[threadId]
 * Fetch all messages in an email thread (both inbound and outbound)
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, threadId } = await context.params;

    if (!threadId || !GMAIL_THREAD_ID_REGEX.test(threadId)) {
      return NextResponse.json({ error: 'Invalid thread ID format' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    // Fetch all messages in the thread
    const { data, error } = await supabase
      .from('emails')
      .select('id, gmail_message_id, gmail_thread_id, direction, from_email, from_name, to_emails, cc_emails, subject, snippet, body_html, body_text, email_date, label_ids, attachments, person_id, organization_id, sent_email_id, created_at')
      .eq('project_id', project.id)
      .eq('gmail_thread_id', threadId)
      .order('email_date', { ascending: true })
      .limit(MAX_THREAD_MESSAGES);

    if (error) {
      console.error('Failed to fetch thread:', error);
      return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 });
    }

    const messages = (data ?? []) as unknown as SyncedEmail[];

    // For outbound messages with sent_email_id, fetch tracking stats
    const sentEmailIds = messages
      .filter(m => m.sent_email_id)
      .map(m => m.sent_email_id as string);

    let trackingStats: Record<string, unknown> = {};
    if (sentEmailIds.length > 0) {
      const { data: stats } = await supabase
        .from('email_tracking_stats' as 'emails')
        .select('sent_email_id, opens, unique_opens, clicks, unique_clicks, replies, bounces, first_open_at, last_open_at')
        .in('sent_email_id', sentEmailIds);

      if (stats) {
        trackingStats = Object.fromEntries(
          (stats as unknown as Array<{ sent_email_id: string }>).map(s => [s.sent_email_id, s])
        );
      }
    }

    // Build thread response
    const thread = {
      thread_id: threadId,
      subject: messages[0]?.subject ?? null,
      messages: messages.map(m => ({
        ...m,
        tracking: m.sent_email_id ? trackingStats[m.sent_email_id] ?? null : null,
      })),
      message_count: messages.length,
      latest_date: messages[messages.length - 1]?.email_date ?? null,
    };

    return NextResponse.json(thread);
  } catch (error) {
    console.error('Thread fetch error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
