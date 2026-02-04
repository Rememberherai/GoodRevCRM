import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ForecastData, ForecastQuarter } from '@/types/report';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function getQuarterLabel(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${q} ${date.getFullYear()}`;
}

function getQuarterStart(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

// GET /api/projects/[slug]/reports/forecasting - Forecast data
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get('user_id') || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch open opportunities with expected close dates
    let query = supabaseAny
      .from('opportunities')
      .select('id, name, amount, probability, expected_close_date, stage, owner_id')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .not('expected_close_date', 'is', null);

    if (userIdFilter) {
      query = query.eq('owner_id', userIdFilter);
    }

    const { data: opportunities, error: oppsError } = await query;

    if (oppsError) {
      console.error('Error fetching opportunities for forecast:', oppsError);
      return NextResponse.json({ error: 'Failed to fetch forecast data' }, { status: 500 });
    }

    // Also fetch historical closed-won for comparison
    const now = new Date();
    const fourQuartersAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    let histQuery = supabaseAny
      .from('opportunities')
      .select('amount, updated_at')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .eq('stage', 'closed_won')
      .gte('updated_at', fourQuartersAgo.toISOString());

    if (userIdFilter) {
      histQuery = histQuery.eq('owner_id', userIdFilter);
    }

    const { data: historicalOpps } = await histQuery;

    // Determine next 4 quarters
    const currentQuarterStart = getQuarterStart(now);
    const quarters: string[] = [];
    for (let i = 0; i < 4; i++) {
      const qDate = new Date(currentQuarterStart);
      qDate.setMonth(qDate.getMonth() + i * 3);
      quarters.push(getQuarterLabel(qDate));
    }

    // Group open opportunities by quarter and stage
    const quarterMap = new Map<string, ForecastQuarter>();
    for (const q of quarters) {
      quarterMap.set(q, {
        quarter: q,
        prospecting: 0,
        qualification: 0,
        proposal: 0,
        negotiation: 0,
        total_weighted: 0,
        total_unweighted: 0,
      });
    }

    const opps = (opportunities ?? []) as Array<{
      amount: number | null;
      probability: number | null;
      expected_close_date: string;
      stage: string;
    }>;

    for (const opp of opps) {
      const closeDate = new Date(opp.expected_close_date);
      const quarterLabel = getQuarterLabel(closeDate);
      const entry = quarterMap.get(quarterLabel);
      if (!entry) continue;

      const amount = Number(opp.amount) || 0;
      const probability = Number(opp.probability) || 0;
      const weighted = amount * probability / 100;

      const stage = opp.stage as keyof ForecastQuarter;
      if (stage in entry && typeof entry[stage] === 'number') {
        (entry[stage] as number) += amount;
      }

      entry.total_unweighted += amount;
      entry.total_weighted += weighted;
    }

    // Add historical actuals
    const histOpps = (historicalOpps ?? []) as Array<{ amount: number | null; updated_at: string }>;
    for (const opp of histOpps) {
      const closeDate = new Date(opp.updated_at);
      const quarterLabel = getQuarterLabel(closeDate);
      const entry = quarterMap.get(quarterLabel);
      if (entry) {
        entry.historical_actual = (entry.historical_actual ?? 0) + (Number(opp.amount) || 0);
      }
    }

    const result: ForecastData = {
      quarters: quarters.map((q) => quarterMap.get(q)!),
      total_pipeline_weighted: Array.from(quarterMap.values()).reduce((sum, q) => sum + q.total_weighted, 0),
      total_pipeline_unweighted: Array.from(quarterMap.values()).reduce((sum, q) => sum + q.total_unweighted, 0),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/reports/forecasting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
