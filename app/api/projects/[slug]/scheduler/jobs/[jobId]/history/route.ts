import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getProjectSecret } from '@/lib/secrets';
import { getJobHistory, JOB_STATUS_LABELS } from '@/lib/scheduler/cronjob-org';

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

/**
 * GET /api/projects/[slug]/scheduler/jobs/[jobId]/history
 * Fetch execution history for a cron job.
 */
export async function GET(_request: Request, context: RouteContext) {
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

    const data = await getJobHistory(apiKey, jobId);

    // Return last 10 entries with readable status
    const history = (data.history ?? []).slice(0, 10).map((item) => ({
      identifier: item.identifier,
      date: item.date,
      datePlanned: item.datePlanned,
      duration: item.duration,
      status: item.status,
      statusText: item.statusText || JOB_STATUS_LABELS[item.status] || 'Unknown',
      httpStatus: item.httpStatus,
    }));

    return NextResponse.json({
      history,
      predictions: data.predictions ?? [],
    });
  } catch (error) {
    console.error('Error fetching job history:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
