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

    const body = await request.json().catch(() => ({})) as { desired_start?: string | null };
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id, contractor_id, status')
      .eq('project_id', project.id)
      .eq('id', id)
      .maybeSingle();

    if (!existingJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const validStatuses = ['pending', 'assigned'];
    if (!validStatuses.includes(existingJob.status)) {
      return NextResponse.json({ error: `Cannot accept a job with status "${existingJob.status}"` }, { status: 409 });
    }

    let contractorId = existingJob.contractor_id;

    // If the job is unassigned or this is a contractor, resolve the person record
    // so the user can self-assign by "taking" the job
    if (role === 'contractor' || !contractorId) {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (role === 'contractor' && !person?.id) {
        return NextResponse.json(
          { error: 'Your contractor account is not linked to a person record yet.' },
          { status: 409 }
        );
      }

      if (contractorId && person?.id && contractorId !== person.id) {
        return NextResponse.json(
          { error: 'This job is assigned to a different contractor.' },
          { status: 403 }
        );
      }

      if (person?.id) {
        contractorId = person.id;
      }
    }

    if (!contractorId) {
      return NextResponse.json({ error: 'Cannot accept a job with no contractor assigned' }, { status: 409 });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        status: 'accepted',
        desired_start: body.desired_start ?? undefined,
        contractor_id: contractorId,
      })
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*, assigned_by_user:users!jobs_assigned_by_fkey(id)')
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Failed to accept job' }, { status: 500 });
    }

    await createProjectNotification({
      supabase,
      userId: job.assigned_by_user?.id,
      projectId: project.id,
      title: 'Job accepted',
      message: `${job.title} was accepted${body.desired_start ? ` for ${new Date(body.desired_start).toLocaleString()}` : ''}.`,
      entityType: 'job',
      entityId: job.id,
      actionUrl: `/projects/${slug}/jobs/${job.id}`,
    });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'job.accepted' as never,
      entityType: 'job',
      entityId: job.id,
      data: { ...job, phase5_action: 'accepted' },
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs/[id]/accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
