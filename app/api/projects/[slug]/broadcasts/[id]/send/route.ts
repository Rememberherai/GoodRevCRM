import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { sendBroadcast } from '@/lib/community/broadcasts';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'update');

    const { data: broadcast } = await supabase.from('broadcasts').select('*').eq('id', id).eq('project_id', project.id).single();
    if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });

    // Only draft broadcasts can be sent manually. Scheduled broadcasts are sent by the cron.
    if (broadcast.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot send a broadcast with status "${broadcast.status}". Only draft broadcasts can be sent manually.` },
        { status: 409 }
      );
    }

    const { data: sendingRow, error: sendingError } = await supabase
      .from('broadcasts')
      .update({ status: 'sending' as never })
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('status', 'draft')
      .select('*')
      .maybeSingle();

    if (sendingError) {
      throw sendingError;
    }
    if (!sendingRow) {
      return NextResponse.json({ error: 'Broadcast is no longer eligible to send.' }, { status: 409 });
    }

    try {
      const result = await sendBroadcast(sendingRow, user.id);
      const noRecipients = result.sentCount === 0 && result.failures.length === 0;
      const status = (result.failures.length > 0 || noRecipients) ? 'failed' : 'sent';

      const { error: finalUpdateError } = await supabase
        .from('broadcasts')
        .update({
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
          scheduled_at: null,
          failure_reason: noRecipients
            ? 'No recipients matched the filter criteria.'
            : result.failures.length > 0 ? result.failures.join('\n').slice(0, 2000) : null,
        })
        .eq('id', id)
        .eq('project_id', project.id);
      if (finalUpdateError) {
        throw finalUpdateError;
      }

      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'broadcast.sent' as never,
        entityType: 'broadcast',
        entityId: id,
        data: { broadcast_id: id, status, sent_count: result.sentCount },
      });

      return NextResponse.json({
        broadcast_id: id,
        status,
        sent_count: result.sentCount,
        failure_count: result.failures.length,
        failures: result.failures,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';

      const { error: failUpdateError } = await supabase
        .from('broadcasts')
        .update({
          status: 'failed' as never,
          sent_at: null,
          scheduled_at: null,
          failure_reason: message.slice(0, 2000),
        })
        .eq('id', id)
        .eq('project_id', project.id);
      if (failUpdateError) {
        console.error('Error updating failed broadcast status:', failUpdateError);
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/broadcasts/[id]/send:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
