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
        return NextResponse.json({ error: 'You can only decline jobs assigned to you' }, { status: 403 });
      }
    }

    const declinableStatuses = ['pending', 'assigned', 'accepted'];
    if (!declinableStatuses.includes(existingJob.status)) {
      return NextResponse.json({ error: `Cannot decline a job with status "${existingJob.status}"` }, { status: 409 });
    }

    const body = await request.json().catch(() => ({})) as { reason?: string | null };
    const reason = body.reason?.trim() || null;

    const declineNote = reason ? `Decline reason: ${reason}` : null;
    const updatedNotes = declineNote
      ? (existingJob.notes ? `${existingJob.notes}\n${declineNote}` : declineNote)
      : undefined;

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        status: 'declined',
        decline_reason: reason,
        notes: updatedNotes,
      })
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*, assigned_by_user:users!jobs_assigned_by_fkey(id)')
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Failed to decline job' }, { status: 500 });
    }

    await createProjectNotification({
      supabase,
      userId: job.assigned_by_user?.id,
      projectId: project.id,
      title: 'Job declined',
      message: reason ? `${job.title} was declined: ${reason}` : `${job.title} was declined.`,
      entityType: 'job',
      entityId: job.id,
      actionUrl: `/projects/${slug}/jobs/${job.id}`,
      priority: 'high',
    });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'job',
      entityId: job.id,
      data: { ...job, phase5_action: 'declined', decline_reason: reason },
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs/[id]/decline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
