import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSchedulerProvider } from '@/lib/scheduler/provider';

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
    const { slug, jobId } = await context.params;

    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const { provider, configured } = await getSchedulerProvider(result.project.id);
    if (!provider || !configured) {
      return NextResponse.json({ error: 'Scheduler not configured' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const updateParams: { enabled?: boolean; schedule?: { timezone: string; hours: number[]; minutes: number[]; mdays: number[]; months: number[]; wdays: number[] } } = {};
    if (validation.data.enabled !== undefined) {
      updateParams.enabled = validation.data.enabled;
    }
    if (validation.data.schedule) {
      updateParams.schedule = {
        timezone: validation.data.schedule.timezone ?? 'America/New_York',
        hours: validation.data.schedule.hours ?? [-1],
        minutes: validation.data.schedule.minutes ?? [-1],
        mdays: validation.data.schedule.mdays ?? [-1],
        months: validation.data.schedule.months ?? [-1],
        wdays: validation.data.schedule.wdays ?? [-1],
      };
    }

    await provider.updateJob(jobId, updateParams);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[slug]/scheduler/jobs/[jobId]
 * Delete a cron job.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, jobId } = await context.params;

    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const { provider, configured } = await getSchedulerProvider(result.project.id);
    if (!provider || !configured) {
      return NextResponse.json({ error: 'Scheduler not configured' }, { status: 400 });
    }

    await provider.deleteJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
