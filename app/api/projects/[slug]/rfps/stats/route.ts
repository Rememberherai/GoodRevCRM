import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/rfps/stats - Get RFP summary stats
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch all active RFPs
    const { data: rfps, error } = await supabase
      .from('rfps')
      .select('id, status, due_date, estimated_value')
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching RFPs:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const allRfps = rfps ?? [];

    // Count by status
    const byStatus: Record<string, number> = {};
    for (const rfp of allRfps) {
      byStatus[rfp.status] = (byStatus[rfp.status] ?? 0) + 1;
    }

    // Upcoming deadlines (due within 7 days, not completed/closed)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const upcomingDeadlines = allRfps.filter((rfp) => {
      if (!rfp.due_date) return false;
      if (['won', 'lost', 'no_bid', 'submitted'].includes(rfp.status)) return false;
      const due = new Date(rfp.due_date);
      return due >= now && due <= sevenDaysFromNow;
    }).length;

    // Win rate
    const decidedRfps = allRfps.filter((rfp) =>
      ['won', 'lost'].includes(rfp.status)
    );
    const wonRfps = allRfps.filter((rfp) => rfp.status === 'won');
    const winRate = decidedRfps.length > 0
      ? Math.round((wonRfps.length / decidedRfps.length) * 100)
      : 0;

    // Total estimated value of active RFPs
    const activeStatuses = ['identified', 'reviewing', 'preparing'];
    const totalValue = allRfps
      .filter((rfp) => activeStatuses.includes(rfp.status) && rfp.estimated_value)
      .reduce((sum, rfp) => sum + (rfp.estimated_value ?? 0), 0);

    return NextResponse.json({
      total: allRfps.length,
      byStatus,
      upcomingDeadlines,
      winRate,
      totalValue,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
