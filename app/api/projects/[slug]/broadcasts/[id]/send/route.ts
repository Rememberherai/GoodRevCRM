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

    const result = await sendBroadcast(broadcast, user.id);
    const status = result.failures.length > 0 ? 'failed' : 'sent';

    await supabase
      .from('broadcasts')
      .update({
        status,
        sent_at: new Date().toISOString(),
        failure_reason: result.failures.length > 0 ? result.failures.join('\n').slice(0, 2000) : null,
      })
      .eq('id', id)
      .eq('project_id', project.id);

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
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/broadcasts/[id]/send:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
