import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectSecret } from '@/lib/secrets';
import { updateJob, deleteJob } from '@/lib/scheduler/cronjob-org';

interface RouteContext {
  params: Promise<{ slug: string; jobId: string }>;
}

async function resolveProjectAndCheckAdmin(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  const isOwner = project.owner_id === user.id;
  const memberRole = (membership as { role?: string } | null)?.role;
  const isAdmin = memberRole === 'admin';

  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) };
  }

  return { project, user };
}

const updateJobSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: z
    .object({
      timezone: z.string().optional(),
      hours: z.array(z.number()).optional(),
      minutes: z.array(z.number()).optional(),
      mdays: z.array(z.number()).optional(),
      months: z.array(z.number()).optional(),
      wdays: z.array(z.number()).optional(),
    })
    .optional(),
});

/**
 * PATCH /api/projects/[slug]/scheduler/jobs/[jobId]
 * Update a cron job (enable/disable, change schedule).
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, jobId: jobIdStr } = await context.params;
    const jobId = parseInt(jobIdStr, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const apiKey = await getProjectSecret(result.project.id, 'cronjob_org_api_key');
    if (!apiKey) {
      return NextResponse.json({ error: 'cron-job.org API key not configured' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const updateParams: Record<string, unknown> = {};
    if (validation.data.enabled !== undefined) {
      updateParams.enabled = validation.data.enabled;
    }
    if (validation.data.schedule) {
      updateParams.schedule = validation.data.schedule;
    }

    await updateJob(apiKey, jobId, updateParams);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[slug]/scheduler/jobs/[jobId]
 * Delete a cron job from cron-job.org.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, jobId: jobIdStr } = await context.params;
    const jobId = parseInt(jobIdStr, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const apiKey = await getProjectSecret(result.project.id, 'cronjob_org_api_key');
    if (!apiKey) {
      return NextResponse.json({ error: 'cron-job.org API key not configured' }, { status: 400 });
    }

    await deleteJob(apiKey, jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
