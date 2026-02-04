// Report Types

export type ReportType =
  | 'pipeline'
  | 'activity'
  | 'conversion'
  | 'revenue'
  | 'team_performance'
  | 'forecasting'
  | 'custom';

export type ReportSchedule = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type ReportRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type WidgetType =
  | 'pipeline_chart'
  | 'activity_feed'
  | 'conversion_rate'
  | 'revenue_chart'
  | 'top_opportunities'
  | 'recent_activities'
  | 'task_summary'
  | 'team_leaderboard';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

// Report Definition
export interface ReportDefinition {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  report_type: ReportType;
  config: ReportConfig;
  filters: ReportFilters;
  schedule: ReportSchedule | null;
  last_run_at: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportConfig {
  chart_type?: 'bar' | 'line' | 'pie' | 'funnel' | 'table';
  metrics?: string[];
  group_by?: string;
  time_range?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  show_comparison?: boolean;
  custom_query?: string;
}

export interface ReportFilters {
  date_range?: {
    start: string;
    end: string;
  };
  stages?: string[];
  owners?: string[];
  statuses?: string[];
  tags?: string[];
}

// Report Run
export interface ReportRun {
  id: string;
  report_id: string;
  project_id: string;
  status: ReportRunStatus;
  result: ReportResult | null;
  error_message: string | null;
  run_duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ReportResult {
  data: Record<string, unknown>[];
  summary?: Record<string, number | string>;
  metadata?: {
    total_rows: number;
    generated_at: string;
  };
}

// Dashboard Widget
export interface DashboardWidget {
  id: string;
  project_id: string;
  user_id: string;
  widget_type: WidgetType;
  config: WidgetConfig;
  position: number;
  size: WidgetSize;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  title?: string;
  time_range?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  limit?: number;
  filters?: Record<string, unknown>;
}

// Pipeline Summary
export interface PipelineSummary {
  stage_id: string;
  stage_name: string;
  stage_position: number;
  opportunity_count: number;
  total_value: number;
  avg_value: number;
  weighted_value: number;
}

// Activity Summary
export interface ActivitySummary {
  activity_date: string;
  entity_type: string;
  action: string;
  count: number;
}

// Conversion Metrics
export interface ConversionMetrics {
  month: string;
  total_created: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  won_value: number;
  lost_value: number;
  win_rate: number | null;
}

// Revenue Metrics
export interface RevenueMetrics {
  month: string;
  closed_won_value: number;
  expected_value: number;
  opportunity_count: number;
  avg_deal_size: number;
}

// Team Performance
export interface TeamPerformance {
  user_id: string;
  user_email: string;
  opportunities_created: number;
  opportunities_won: number;
  total_won_value: number;
  tasks_completed: number;
  activities_logged: number;
}

// Dashboard Overview
export interface DashboardOverview {
  pipeline: PipelineSummary[];
  conversion: ConversionMetrics[];
  revenue: RevenueMetrics[];
  team: TeamPerformance[];
  recent_activity: ActivitySummary[];
}

// Widget type labels
export const widgetTypeLabels: Record<WidgetType, string> = {
  pipeline_chart: 'Pipeline Chart',
  activity_feed: 'Activity Feed',
  conversion_rate: 'Conversion Rate',
  revenue_chart: 'Revenue Chart',
  top_opportunities: 'Top Opportunities',
  recent_activities: 'Recent Activities',
  task_summary: 'Task Summary',
  team_leaderboard: 'Team Leaderboard',
};

// Forecasting types
export interface ForecastQuarter {
  quarter: string;
  prospecting: number;
  qualification: number;
  proposal: number;
  negotiation: number;
  total_weighted: number;
  total_unweighted: number;
  historical_actual?: number;
}

export interface ForecastData {
  quarters: ForecastQuarter[];
  total_pipeline_weighted: number;
  total_pipeline_unweighted: number;
}

// Report type labels
export const reportTypeLabels: Record<ReportType, string> = {
  pipeline: 'Pipeline Report',
  activity: 'Activity Report',
  conversion: 'Conversion Report',
  revenue: 'Revenue Report',
  team_performance: 'Team Performance',
  forecasting: 'Forecasting',
  custom: 'Custom Report',
};
