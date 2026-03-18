import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
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

/**
 * GET /api/projects/[slug]/scheduler/jobs/[jobId]/history
 * Fetch execution history for a cron job (provider-agnostic).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, jobId } = await context.params;

    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const { provider, configured } = await getSchedulerProvider(result.project.id);
    if (!provider || !configured) {
      return NextResponse.json({ error: 'Scheduler not configured' }, { status: 400 });
    }

    const history = await provider.getJobHistory(jobId);

    return NextResponse.json({ history, predictions: [] });
  } catch (error) {
    console.error('Error fetching job history:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
