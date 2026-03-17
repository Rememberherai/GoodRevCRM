import { z } from 'zod';

// ── Enums ───────────────────────────────────────────────────────────────────

export const filterOperators = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'in',
  'is_null', 'is_not_null', 'between',
] as const;

export const aggregationFunctions = [
  'sum', 'avg', 'count', 'min', 'max', 'count_distinct',
] as const;

export const customChartTypes = [
  'table', 'bar', 'line', 'pie', 'funnel',
] as const;

export const reportableObjects = [
  'organizations', 'people', 'opportunities', 'rfps',
  'activity_log', 'tasks', 'sent_emails', 'calls',
  'meetings', 'sequence_enrollments',
] as const;

// ── Filter Value Schema ─────────────────────────────────────────────────────

const filterValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(500), z.number()])).max(100),
]);

// ── Column Schema ───────────────────────────────────────────────────────────

export const reportColumnSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(/^[a-z_][a-z0-9_.]*$/, 'Invalid field name format'),
  alias: z.string().min(1).max(100).optional(),
  aggregation: z.enum(aggregationFunctions).optional(),
});

// ── Filter Schema ───────────────────────────────────────────────────────────

export const reportFilterSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(/^[a-z_][a-z0-9_.]*$/, 'Invalid field name format'),
  operator: z.enum(filterOperators),
  value: filterValueSchema.optional(),
  value2: filterValueSchema.optional(),
}).refine(
  (f) => {
    // is_null/is_not_null don't need a value
    if (f.operator === 'is_null' || f.operator === 'is_not_null') return true;
    // between needs both values
    if (f.operator === 'between') return f.value !== undefined && f.value2 !== undefined;
    // everything else needs a value
    return f.value !== undefined;
  },
  { message: 'Filter value required for this operator' }
);

// ── Aggregation Schema ──────────────────────────────────────────────────────

export const reportAggregationSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(/^[a-z_][a-z0-9_.]*$/, 'Invalid field name format'),
  function: z.enum(aggregationFunctions),
  alias: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/, 'Alias must be a valid identifier'),
});

// ── Order By Schema ─────────────────────────────────────────────────────────

export const reportOrderBySchema = z.object({
  field: z.string().min(1).max(200).regex(/^[a-z_][a-z0-9_.]*$/, 'Invalid field name format'),
  direction: z.enum(['asc', 'desc']),
});

// ── Chart Config Schema ─────────────────────────────────────────────────────

export const chartConfigSchema = z.object({
  xAxis: z.string().max(200).optional(),
  yAxis: z.string().max(200).optional(),
  series: z.string().max(200).optional(),
});

// ── Custom Report Config Schema ─────────────────────────────────────────────

export const customReportConfigSchema = z.object({
  primaryObject: z.enum(reportableObjects),
  columns: z.array(reportColumnSchema).min(1).max(50),
  filters: z.array(reportFilterSchema).max(30).default([]),
  groupBy: z.array(
    z.string().min(1).max(200).regex(/^[a-z_][a-z0-9_.]*$/, 'Invalid field name')
  ).max(10).optional(),
  aggregations: z.array(reportAggregationSchema).max(20).optional(),
  orderBy: z.array(reportOrderBySchema).max(5).optional(),
  limit: z.number().int().min(1).max(10_000).optional(),
  chartType: z.enum(customChartTypes).optional().default('table'),
  chartConfig: chartConfigSchema.optional(),
}).refine(
  (config) => {
    // If aggregations are present, groupBy should be too (or all cols are aggregated)
    const hasAgg = (config.aggregations?.length ?? 0) > 0;
    const hasGroupBy = (config.groupBy?.length ?? 0) > 0;
    const allColsAggregated = config.columns.every((c) => c.aggregation);
    if (hasAgg && !hasGroupBy && !allColsAggregated) {
      return false;
    }
    return true;
  },
  { message: 'When using aggregations, either group_by or all columns must have an aggregation function' }
);

export type CustomReportConfigInput = z.infer<typeof customReportConfigSchema>;

// ── Create Custom Report Schema ─────────────────────────────────────────────

export const createCustomReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  config: customReportConfigSchema,
  schedule: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).nullable().optional(),
  is_public: z.boolean().optional().default(false),
});

export type CreateCustomReportInput = z.infer<typeof createCustomReportSchema>;

// ── Update Custom Report Schema ─────────────────────────────────────────────

export const updateCustomReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  config: customReportConfigSchema.optional(),
  schedule: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).nullable().optional(),
  is_public: z.boolean().optional(),
});

export type UpdateCustomReportInput = z.infer<typeof updateCustomReportSchema>;

// ── Preview Schema (no save, just run) ──────────────────────────────────────

export const previewReportSchema = customReportConfigSchema;
export type PreviewReportInput = z.infer<typeof previewReportSchema>;
