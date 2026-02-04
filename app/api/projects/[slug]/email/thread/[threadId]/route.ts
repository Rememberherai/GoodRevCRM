import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { SyncedEmail } from '@/types/gmail';

interface RouteContext {
  params: Promise<{ slug: string; threadId: string }>;
}

/**
 * GET /api/projects/[slug]/email/thread/[threadId]
 * Fetch all messages in an email thread (both inbound and outbound)
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, threadId } = await context.params;
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
      .select('*')
      .eq('project_id', project.id)
      .eq('gmail_thread_id', threadId)
      .order('email_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
        .select('*')
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
