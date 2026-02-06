import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOpenRouterKeyInfo } from '@/lib/openrouter/usage';
import type {
  AnalyticsData,
  ActivityTiles,
  FunnelStage,
  PipelineStage,
  ConversionMetric,
  RevenueMetric,
  EmailPerformance,
  AiModelUsage,
  AiUsageStats,
  EnrichmentStats,
  TeamMember,
} from '@/types/analytics';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const DEFAULT_ACTIVITY_TILES: ActivityTiles = {
  calls: 0,
  emails_sent: 0,
  quality_conversations: 0,
  meetings_booked: 0,
  meetings_attended: 0,
};

const DEFAULT_EMAIL: EmailPerformance = {
  total_sent: 0,
  total_opens: 0,
  unique_opens: 0,
  total_clicks: 0,
  total_replies: 0,
  total_bounces: 0,
  open_rate: 0,
  click_rate: 0,
  reply_rate: 0,
  bounce_rate: 0,
};

const DEFAULT_ENRICHMENT: EnrichmentStats = {
  total_credits: 0,
  job_count: 0,
  completed_count: 0,
  failed_count: 0,
  success_rate: 0,
};

// GET /api/projects/[slug]/analytics - Full analytics dashboard data
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

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const rawStartDate = searchParams.get('start_date');
    const rawEndDate = searchParams.get('end_date');
    const rawUserId = searchParams.get('user_id');

    // Validate dates - must be valid ISO 8601 strings
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const defaultEndDate = new Date().toISOString();

    let startDate = defaultStartDate;
    let endDate = defaultEndDate;

    if (rawStartDate) {
      const parsed = new Date(rawStartDate);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed.toISOString();
      }
    }

    if (rawEndDate) {
      const parsed = new Date(rawEndDate);
      if (!isNaN(parsed.getTime())) {
        endDate = parsed.toISOString();
      }
    }

    // Validate user_id as UUID if provided
    let userId: string | null = null;
    if (rawUserId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(rawUserId)) {
        // Verify user is a member of this project
        const { data: membership } = await supabase
          .from('project_memberships')
          .select('id')
          .eq('project_id', project.id)
          .eq('user_id', rawUserId)
          .maybeSingle();

        if (membership) {
          userId = rawUserId;
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;

    // Execute all RPC calls in parallel, with graceful fallbacks
    const [
      activityResult,
      opportunityFunnelResult,
      rfpFunnelResult,
      pipelineResult,
      conversionResult,
      revenueResult,
      emailResult,
      aiUsageResult,
      enrichmentResult,
      teamResult,
      openRouterKeyInfo,
    ] = await Promise.all([
      // Activity tiles
      rpc('get_activity_tile_metrics', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: ActivityTiles | null }) => r.data ?? DEFAULT_ACTIVITY_TILES)
        .catch((err: unknown) => { console.error('Analytics RPC error (activity_tile_metrics):', err); return DEFAULT_ACTIVITY_TILES; }),

      // Opportunity funnel
      rpc('get_opportunity_funnel', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: Array<{ stage: string; count: number; total_value: number }> | null }) =>
          (r.data ?? []).map(
            (row: { stage: string; count: number; total_value: number }): FunnelStage => ({
              name: row.stage,
              count: Number(row.count),
              value: Number(row.total_value),
            })
          )
        )
        .catch((err: unknown) => { console.error('Analytics RPC error (opportunity_funnel):', err); return [] as FunnelStage[]; }),

      // RFP funnel
      rpc('get_rfp_funnel', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: Array<{ status: string; count: number; total_value: number }> | null }) =>
          (r.data ?? []).map(
            (row: { status: string; count: number; total_value: number }): FunnelStage => ({
              name: row.status,
              count: Number(row.count),
              value: Number(row.total_value),
            })
          )
        )
        .catch((err: unknown) => { console.error('Analytics RPC error (rfp_funnel):', err); return [] as FunnelStage[]; }),

      // Pipeline
      rpc('get_pipeline_summary', {
        p_project_id: project.id,
        p_user_id: userId,
      })
        .then((r: { data: PipelineStage[] | null }) => r.data ?? [])
        .catch((err: unknown) => { console.error('Analytics RPC error (pipeline_summary):', err); return [] as PipelineStage[]; }),

      // Conversion metrics
      rpc('get_conversion_metrics', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: ConversionMetric[] | null }) => r.data ?? [])
        .catch((err: unknown) => { console.error('Analytics RPC error (conversion_metrics):', err); return [] as ConversionMetric[]; }),

      // Revenue metrics
      rpc('get_revenue_metrics', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: RevenueMetric[] | null }) => r.data ?? [])
        .catch((err: unknown) => { console.error('Analytics RPC error (revenue_metrics):', err); return [] as RevenueMetric[]; }),

      // Email performance
      rpc('get_email_performance', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: EmailPerformance | null }) => r.data ?? DEFAULT_EMAIL)
        .catch((err: unknown) => { console.error('Analytics RPC error (email_performance):', err); return DEFAULT_EMAIL; }),

      // AI usage
      rpc('get_ai_usage_stats', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: AiModelUsage[] | null }) => {
          const rows = r.data ?? [];
          const totals = rows.reduce(
            (
              acc: {
                totalTokens: number;
                totalCalls: number;
                totalPromptTokens: number;
                totalCompletionTokens: number;
              },
              row: AiModelUsage
            ) => ({
              totalTokens: acc.totalTokens + Number(row.total_tokens),
              totalCalls: acc.totalCalls + Number(row.call_count),
              totalPromptTokens: acc.totalPromptTokens + Number(row.prompt_tokens),
              totalCompletionTokens: acc.totalCompletionTokens + Number(row.completion_tokens),
            }),
            { totalTokens: 0, totalCalls: 0, totalPromptTokens: 0, totalCompletionTokens: 0 }
          );
          return { byModel: rows, totals } as AiUsageStats;
        })
        .catch((err: unknown) => {
          console.error('Analytics RPC error (ai_usage_stats):', err);
          return {
            byModel: [],
            totals: { totalTokens: 0, totalCalls: 0, totalPromptTokens: 0, totalCompletionTokens: 0 },
          } as AiUsageStats;
        }),

      // Enrichment stats
      rpc('get_enrichment_stats', {
        p_project_id: project.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: userId,
      })
        .then((r: { data: EnrichmentStats | null }) => r.data ?? DEFAULT_ENRICHMENT)
        .catch((err: unknown) => { console.error('Analytics RPC error (enrichment_stats):', err); return DEFAULT_ENRICHMENT; }),

      // Team members
      Promise.resolve(
        supabase
          .from('project_memberships')
          .select('user_id, users(id, email, full_name, avatar_url)')
          .eq('project_id', project.id)
      )
        .then(
          (r: {
            data:
              | Array<{
                  user_id: string;
                  users: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null;
                }>
              | null;
          }) =>
            (r.data ?? []).map(
              (m): TeamMember => ({
                userId: m.user_id,
                fullName:
                  (m.users as unknown as { full_name: string | null })?.full_name ??
                  (m.users as unknown as { email: string })?.email ??
                  'Unknown',
                email: (m.users as unknown as { email: string })?.email ?? '',
                avatarUrl: (m.users as unknown as { avatar_url: string | null })?.avatar_url ?? null,
              })
            )
        )
        .catch((err: unknown) => { console.error('Analytics error (team_members):', err); return [] as TeamMember[]; }),

      // OpenRouter key info (bonus)
      getOpenRouterKeyInfo().catch((err: unknown) => { console.error('Analytics error (openrouter_key_info):', err); return null; }),
    ]);

    const data: AnalyticsData = {
      activityTiles: activityResult,
      opportunityFunnel: opportunityFunnelResult,
      rfpFunnel: rfpFunnelResult,
      pipeline: pipelineResult,
      conversion: conversionResult,
      revenue: revenueResult,
      email: emailResult,
      aiUsage: aiUsageResult,
      enrichment: enrichmentResult,
      teamMembers: teamResult,
    };

    return NextResponse.json({
      ...data,
      openRouterKeyInfo: openRouterKeyInfo,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
