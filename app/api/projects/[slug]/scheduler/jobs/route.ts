import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSchedulerProvider } from '@/lib/scheduler/provider';

interface RouteContext {
  params: Promise<{ slug: string }>;
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

const createJobSchema = z.object({
  templateKey: z.string(),
  enabled: z.boolean().optional(),
  schedule: z
    .object({
      timezone: z.string().optional(),
      hours: z.array(z.number()),
      minutes: z.array(z.number()),
      mdays: z.array(z.number()),
      months: z.array(z.number()),
      wdays: z.array(z.number()),
    })
    .optional(),
});

/**
 * GET /api/projects/[slug]/scheduler/jobs
 * List cron jobs merged with templates (provider-agnostic).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const { provider, providerType, configured } = await getSchedulerProvider(result.project.id);

    if (!provider || !configured) {
      return NextResponse.json({ configured: false, providerType, jobs: [] });
    }

    const jobs = await provider.listJobs();

    return NextResponse.json({ configured: true, providerType, jobs });
  } catch (error) {
    console.error('Error listing scheduler jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/scheduler/jobs
 * Create a new cron job from a template (provider-agnostic).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const body = await request.json();
    const validation = createJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { provider, configured } = await getSchedulerProvider(result.project.id);
    if (!provider || !configured) {
      return NextResponse.json({ error: 'Scheduler not configured' }, { status: 400 });
    }

    const { templateKey, enabled, schedule } = validation.data;
    const fullSchedule = schedule
      ? { timezone: schedule.timezone ?? 'America/New_York', ...schedule }
      : undefined;

    const { jobId } = await provider.createJob(templateKey, fullSchedule, enabled);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error creating scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
