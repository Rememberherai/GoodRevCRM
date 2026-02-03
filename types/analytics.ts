// Analytics dashboard types

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ActivityTiles {
  calls: number;
  emails_sent: number;
  quality_conversations: number;
  meetings_booked: number;
  meetings_attended: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  value: number;
  fill?: string;
}

export interface PipelineStage {
  stage_name: string;
  opportunity_count: number;
  total_value: number;
  avg_value: number;
  weighted_value: number;
}

export interface ConversionMetric {
  month: string;
  total_created: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  won_value: number;
  lost_value: number;
  win_rate: number;
}

export interface RevenueMetric {
  month: string;
  closed_won_value: number;
  expected_value: number;
  opportunity_count: number;
  avg_deal_size: number;
}

export interface EmailPerformance {
  total_sent: number;
  total_opens: number;
  unique_opens: number;
  total_clicks: number;
  total_replies: number;
  total_bounces: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export interface AiModelUsage {
  feature: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  call_count: number;
}

export interface AiUsageStats {
  byModel: AiModelUsage[];
  totals: {
    totalTokens: number;
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
}

export interface EnrichmentStats {
  total_credits: number;
  job_count: number;
  completed_count: number;
  failed_count: number;
  success_rate: number;
}

export interface TeamMember {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface AnalyticsData {
  activityTiles: ActivityTiles;
  opportunityFunnel: FunnelStage[];
  rfpFunnel: FunnelStage[];
  pipeline: PipelineStage[];
  conversion: ConversionMetric[];
  revenue: RevenueMetric[];
  email: EmailPerformance;
  aiUsage: AiUsageStats;
  enrichment: EnrichmentStats;
  teamMembers: TeamMember[];
}

// AI usage log entry (matches ai_usage_log table)
export interface AiUsageLogEntry {
  id: string;
  project_id: string;
  user_id: string;
  feature: AiFeature;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AiFeature =
  | 'research'
  | 'sequence_generation'
  | 'contact_discovery'
  | 'rfp_response'
  | 'content_extraction'
  | 'bulk_rfp_generation';

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  research: 'Research',
  sequence_generation: 'Sequences',
  contact_discovery: 'Contact Discovery',
  rfp_response: 'RFP Responses',
  content_extraction: 'Content Extraction',
  bulk_rfp_generation: 'Bulk RFP Gen',
};
