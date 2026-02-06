import { z } from 'zod';

// Report types
export const reportTypes = [
  'pipeline',
  'activity',
  'conversion',
  'revenue',
  'team_performance',
  'forecasting',
  'custom',
] as const;

// Report schedules
export const reportSchedules = ['daily', 'weekly', 'monthly', 'quarterly'] as const;

// Report run statuses
export const reportRunStatuses = ['pending', 'running', 'completed', 'failed'] as const;

// Widget types
export const widgetTypes = [
  'pipeline_chart',
  'activity_feed',
  'conversion_rate',
  'revenue_chart',
  'top_opportunities',
  'recent_activities',
  'task_summary',
  'team_leaderboard',
] as const;

// Widget sizes
export const widgetSizes = ['small', 'medium', 'large', 'full'] as const;

// Chart types
export const chartTypes = ['bar', 'line', 'pie', 'funnel', 'table'] as const;

// Time ranges
export const timeRanges = ['day', 'week', 'month', 'quarter', 'year'] as const;

// Report config schema
export const reportConfigSchema = z.object({
  chart_type: z.enum(chartTypes).optional(),
  metrics: z.array(z.string().max(100)).max(20).optional(),
  group_by: z.string().max(100).optional(),
  time_range: z.enum(timeRanges).optional(),
  show_comparison: z.boolean().optional(),
  custom_query: z.string().max(5000).optional(),
});

export type ReportConfigInput = z.infer<typeof reportConfigSchema>;

// Report filters schema
export const reportFiltersSchema = z.object({
  date_range: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  stages: z.array(z.string().uuid()).optional(),
  owners: z.array(z.string().uuid()).optional(),
  statuses: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

// Create report schema
export const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  report_type: z.enum(reportTypes),
  config: reportConfigSchema.optional(),
  filters: reportFiltersSchema.optional(),
  schedule: z.enum(reportSchedules).nullable().optional(),
  is_public: z.boolean().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// Update report schema
export const updateReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  report_type: z.enum(reportTypes).optional(),
  config: reportConfigSchema.optional(),
  filters: reportFiltersSchema.optional(),
  schedule: z.enum(reportSchedules).nullable().optional(),
  is_public: z.boolean().optional(),
});

export type UpdateReportInput = z.infer<typeof updateReportSchema>;

// Report query schema
export const reportQuerySchema = z.object({
  report_type: z.enum(reportTypes).optional(),
  is_public: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

// Report run query schema
export const reportRunQuerySchema = z.object({
  status: z.enum(reportRunStatuses).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ReportRunQueryInput = z.infer<typeof reportRunQuerySchema>;

// Widget config schema - filter values constrained to primitives
const filterValueSchema = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(500), z.number(), z.boolean()])).max(100),
]);

export const widgetConfigSchema = z.object({
  title: z.string().max(100).optional(),
  time_range: z.enum(timeRanges).optional(),
  limit: z.number().min(1).max(50).optional(),
  filters: z.record(z.string().max(100), filterValueSchema).optional(),
});

export type WidgetConfigInput = z.infer<typeof widgetConfigSchema>;

// Create widget schema
export const createWidgetSchema = z.object({
  widget_type: z.enum(widgetTypes),
  config: widgetConfigSchema.optional(),
  position: z.number().min(0).optional(),
  size: z.enum(widgetSizes).optional(),
  is_visible: z.boolean().optional(),
});

export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;

// Update widget schema
export const updateWidgetSchema = z.object({
  config: widgetConfigSchema.optional(),
  position: z.number().min(0).optional(),
  size: z.enum(widgetSizes).optional(),
  is_visible: z.boolean().optional(),
});

export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

// Widget query schema
export const widgetQuerySchema = z.object({
  widget_type: z.enum(widgetTypes).optional(),
  is_visible: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export type WidgetQueryInput = z.infer<typeof widgetQuerySchema>;

// Date range query schema (for analytics endpoints)
export const dateRangeQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type DateRangeQueryInput = z.infer<typeof dateRangeQuerySchema>;

// Metrics query schema
export const metricsQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  group_by: z.enum(['day', 'week', 'month']).optional().default('month'),
});

export type MetricsQueryInput = z.infer<typeof metricsQuerySchema>;
