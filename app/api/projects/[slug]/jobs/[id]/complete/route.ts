import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createProjectNotification } from '@/lib/community/notifications';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id, status, notes, contractor_id')
      .eq('project_id', project.id)
      .eq('id', id)
      .maybeSingle();

    if (!existingJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (role === 'contractor') {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!person || (existingJob.contractor_id && existingJob.contractor_id !== person.id)) {
        return NextResponse.json({ error: 'You can only complete jobs assigned to you' }, { status: 403 });
      }
    }

    const completableStatuses = ['accepted', 'in_progress', 'paused'];
    if (!completableStatuses.includes(existingJob.status)) {
      return NextResponse.json({ error: `Cannot complete a job with status "${existingJob.status}"` }, { status: 409 });
    }

    const body = await request.json().catch(() => ({})) as { notes?: string | null };
    const completionNotes = body.notes?.trim() || null;

    const updatedNotes = completionNotes
      ? (existingJob.notes ? `${existingJob.notes}\n${completionNotes}` : completionNotes)
      : undefined;

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: updatedNotes,
      })
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*, assigned_by_user:users!jobs_assigned_by_fkey(id), time_entries:job_time_entries(duration_minutes)')
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Failed to complete job' }, { status: 500 });
    }

    const totalMinutes = (job.time_entries ?? []).reduce((sum: number, entry: { duration_minutes: number | null }) => sum + (entry.duration_minutes ?? 0), 0);

    await createProjectNotification({
      supabase,
      userId: job.assigned_by_user?.id,
      projectId: project.id,
      title: 'Job completed',
      message: `${job.title} is complete. Total logged time: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.${completionNotes ? ` Notes: ${completionNotes}` : ''}`,
      entityType: 'job',
      entityId: job.id,
      actionUrl: `/projects/${slug}/jobs/${job.id}`,
      priority: 'high',
    });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'job.completed' as never,
      entityType: 'job',
      entityId: job.id,
      data: { ...job, phase5_action: 'completed', total_minutes: totalMinutes },
    });

    return NextResponse.json({ job, total_minutes: totalMinutes });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs/[id]/complete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
