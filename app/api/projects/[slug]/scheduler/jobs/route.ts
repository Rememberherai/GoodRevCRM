import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectSecret } from '@/lib/secrets';
import { listJobs, createJob } from '@/lib/scheduler/cronjob-org';
import { CRON_TEMPLATES } from '@/lib/scheduler/templates';

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
 * List cron-job.org jobs merged with templates.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const apiKey = await getProjectSecret(result.project.id, 'cronjob_org_api_key');
    if (!apiKey) {
      return NextResponse.json({ configured: false, jobs: [] });
    }

    const jobs = await listJobs(apiKey);

    // Merge jobs with templates
    const merged = CRON_TEMPLATES.map((template) => {
      const matchedJob = jobs.find(
        (j) =>
          j.title === `GoodRev: ${template.title}` ||
          j.url.includes(template.path),
      );

      return {
        template,
        job: matchedJob
          ? {
              jobId: matchedJob.jobId,
              enabled: matchedJob.enabled,
              url: matchedJob.url,
              schedule: matchedJob.schedule,
              lastStatus: matchedJob.lastStatus,
              lastDuration: matchedJob.lastDuration,
              lastExecution: matchedJob.lastExecution,
              nextExecution: matchedJob.nextExecution,
            }
          : null,
      };
    });

    return NextResponse.json({ configured: true, jobs: merged });
  } catch (error) {
    console.error('Error listing scheduler jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/scheduler/jobs
 * Create a new cron job from a template.
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

    const { templateKey, enabled, schedule } = validation.data;

    const template = CRON_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) {
      return NextResponse.json({ error: 'Unknown template key' }, { status: 400 });
    }

    const apiKey = await getProjectSecret(result.project.id, 'cronjob_org_api_key');
    if (!apiKey) {
      return NextResponse.json({ error: 'cron-job.org API key not configured' }, { status: 400 });
    }

    // Resolve base URL and cron secret
    const baseUrl = (await getProjectSecret(result.project.id, 'scheduler_base_url'))
      || process.env.NEXT_PUBLIC_APP_URL
      || '';

    if (!baseUrl) {
      return NextResponse.json({ error: 'Base URL not configured' }, { status: 400 });
    }

    const cronSecret = (await getProjectSecret(result.project.id, 'cron_secret'))
      || process.env.CRON_SECRET
      || '';

    // Build callback URL with project_id param for per-project auth
    const callbackUrl = `${baseUrl.replace(/\/$/, '')}${template.path}?project_id=${result.project.id}`;

    const jobSchedule = {
      timezone: schedule?.timezone ?? template.defaultSchedule.timezone,
      expiresAt: 0,
      hours: schedule?.hours ?? template.defaultSchedule.hours,
      minutes: schedule?.minutes ?? template.defaultSchedule.minutes,
      mdays: schedule?.mdays ?? template.defaultSchedule.mdays,
      months: schedule?.months ?? template.defaultSchedule.months,
      wdays: schedule?.wdays ?? template.defaultSchedule.wdays,
    };

    const jobId = await createJob(apiKey, {
      title: template.title,
      url: callbackUrl,
      enabled: enabled ?? true,
      schedule: jobSchedule,
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      saveResponses: true,
      notification: { onFailure: true, onDisable: true },
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error creating scheduler job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
