import { z } from 'zod';
import {
  appendRequiredExcludedCategories,
  jsonObjectSchema,
  nullableString,
  optionalUrlSchema,
  requiredExcludedCategories,
  uuidSchema,
} from './shared';

export const publicDashboardStatusSchema = z.enum(['draft', 'preview', 'published', 'archived']);
export const publicDashboardAccessTypeSchema = z.enum(['public', 'password', 'signed_link']);
export const publicDashboardDataFreshnessSchema = z.enum(['live', 'snapshot']);
export const publicDashboardDateRangeTypeSchema = z.enum(['rolling', 'fixed']);
export const publicDashboardGeoGranularitySchema = z.enum(['zip', 'neighborhood']);
export const publicDashboardWidgetTypeSchema = z.enum([
  'metric_card',
  'bar_chart',
  'radar_chart',
  'map_heatmap',
  'program_summary',
  'contribution_summary',
  'text_block',
]);

export const widgetConfigSchema = z.object({
  id: z.string().uuid().optional(),
  type: publicDashboardWidgetTypeSchema,
  title: z.string().max(200).optional(),
  dimension_filter: z.array(uuidSchema).max(25).optional(),
  date_range: jsonObjectSchema.optional(),
  min_count_threshold: z.number().int().min(3).max(100).default(5),
  config: jsonObjectSchema.default({}),
});

const excludedCategoriesSchema = z
  .array(z.string().min(1).max(100))
  .default([...requiredExcludedCategories])
  .transform(appendRequiredExcludedCategories);

export const dashboardThemeSchema = z.object({
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  accent_color: z.string().max(20).optional(),
  logo_url: optionalUrlSchema.optional(),
});

const dashboardConfigBaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: nullableString(5000, 'Description must be 5000 characters or less'),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  status: publicDashboardStatusSchema.default('draft'),
  theme: dashboardThemeSchema.default({}),
  hero_image_url: optionalUrlSchema.optional(),
  widget_order: z.array(z.string().uuid()).default([]),
  widgets: z.array(widgetConfigSchema).default([]),
  min_count_threshold: z.number().int().min(3).max(100).default(5),
  excluded_categories: excludedCategoriesSchema,
  access_type: publicDashboardAccessTypeSchema.default('public'),
  password: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(8).max(200).optional()),
  data_freshness: publicDashboardDataFreshnessSchema.default('live'),
  snapshot_data: jsonObjectSchema.nullable().optional(),
  date_range_type: publicDashboardDateRangeTypeSchema.default('rolling'),
  date_range_start: z.string().nullable().optional(),
  date_range_end: z.string().nullable().optional(),
  geo_granularity: publicDashboardGeoGranularitySchema.default('zip'),
  published_at: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
});

function validateDashboardConfig(
  value: z.infer<typeof dashboardConfigBaseSchema> | Partial<z.infer<typeof dashboardConfigBaseSchema>>,
  ctx: z.RefinementCtx
) {
  if (value.access_type === 'password' && !value.password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'password is required when access_type is password',
      path: ['password'],
    });
  }

  if (value.date_range_type === 'fixed' && (!value.date_range_start || !value.date_range_end)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Fixed date ranges require both date_range_start and date_range_end',
      path: ['date_range_start'],
    });
  }
}

export const createDashboardConfigSchema = dashboardConfigBaseSchema.superRefine(validateDashboardConfig);

export const updateDashboardConfigSchema = dashboardConfigBaseSchema.partial().extend({
  excluded_categories: excludedCategoriesSchema.optional(),
}).superRefine(validateDashboardConfig);

export const createShareLinkSchema = z.object({
  label: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
});
