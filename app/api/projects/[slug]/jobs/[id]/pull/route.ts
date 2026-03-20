import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createProjectNotification } from '@/lib/community/notifications';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'delete');

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id, title, status, contractor:people!jobs_contractor_id_fkey(user_id)')
      .eq('project_id', project.id)
      .eq('id', id)
      .single();

    if (!existingJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const pullableStatuses = ['pending', 'assigned', 'accepted', 'in_progress', 'paused'];
    if (!pullableStatuses.includes(existingJob.status)) {
      return NextResponse.json({ error: `Cannot pull a job with status "${existingJob.status}"` }, { status: 409 });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        status: 'pulled',
        pulled_at: new Date().toISOString(),
        contractor_id: null,
      })
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Failed to pull job' }, { status: 500 });
    }

    await createProjectNotification({
      supabase,
      userId: existingJob?.contractor?.user_id,
      projectId: project.id,
      title: 'Job pulled',
      message: `${existingJob?.title ?? 'A job'} has been pulled back and is no longer assigned to you.`,
      entityType: 'job',
      entityId: job.id,
      actionUrl: `/contractor/${slug}`,
      priority: 'high',
    });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'job',
      entityId: job.id,
      data: { ...job, phase5_action: 'pulled' },
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs/[id]/pull:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
