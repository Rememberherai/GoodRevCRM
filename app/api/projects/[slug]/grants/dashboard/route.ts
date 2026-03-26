import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'dashboard', 'view');

    // Fetch all grants for this project (non-discovered only for pipeline stats)
    const { data: grants } = await supabase
      .from('grants')
      .select('id, status, amount_requested, amount_awarded, loi_due_at, application_due_at, report_due_at, is_discovered, updated_at, name')
      .eq('project_id', project.id)
      .order('updated_at', { ascending: false });

    const allGrants = grants ?? [];
    const pipelineGrants = allGrants.filter(g => !g.is_discovered);
    const discoveredCount = allGrants.filter(g => g.is_discovered).length;

    // Pipeline stats by status
    const statusCounts: Record<string, { count: number; requested: number; awarded: number }> = {};
    for (const g of pipelineGrants) {
      const s = g.status ?? 'researching';
      if (!statusCounts[s]) statusCounts[s] = { count: 0, requested: 0, awarded: 0 };
      statusCounts[s].count++;
      statusCounts[s].requested += Number(g.amount_requested) || 0;
      statusCounts[s].awarded += Number(g.amount_awarded) || 0;
    }

    // Summary stats
    const totalGrants = pipelineGrants.length;
    const totalRequested = pipelineGrants.reduce((sum, g) => sum + (Number(g.amount_requested) || 0), 0);
    const totalAwarded = pipelineGrants.reduce((sum, g) => sum + (Number(g.amount_awarded) || 0), 0);
    const awardedCount = pipelineGrants.filter(g => ['awarded', 'active', 'closed'].includes(g.status ?? '')).length;
    const declinedCount = pipelineGrants.filter(g => g.status === 'declined').length;
    const decidedCount = awardedCount + declinedCount;
    const winRate = decidedCount > 0 ? Math.round((awardedCount / decidedCount) * 100) : null;

    // Upcoming deadlines (next 30 days)
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().slice(0, 10);
    const futureStr = thirtyDaysOut.toISOString().slice(0, 10);

    const deadlines: { grant_id: string; grant_name: string; type: string; date: string }[] = [];
    for (const g of pipelineGrants) {
      if (g.loi_due_at && g.loi_due_at >= nowStr && g.loi_due_at <= futureStr) {
        deadlines.push({ grant_id: g.id, grant_name: g.name, type: 'LOI Due', date: g.loi_due_at });
      }
      if (g.application_due_at && g.application_due_at >= nowStr && g.application_due_at <= futureStr) {
        deadlines.push({ grant_id: g.id, grant_name: g.name, type: 'Application Due', date: g.application_due_at });
      }
      if (g.report_due_at && g.report_due_at >= nowStr && g.report_due_at <= futureStr) {
        deadlines.push({ grant_id: g.id, grant_name: g.name, type: 'Report Due', date: g.report_due_at });
      }
    }
    deadlines.sort((a, b) => a.date.localeCompare(b.date));

    // Recently updated (top 5)
    const recentGrants = pipelineGrants.slice(0, 5).map(g => ({
      id: g.id,
      name: g.name,
      status: g.status,
      updated_at: g.updated_at,
    }));

    return NextResponse.json({
      summary: {
        totalGrants,
        totalRequested,
        totalAwarded,
        winRate,
        discoveredCount,
      },
      statusCounts,
      deadlines,
      recentGrants,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /grants/dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
