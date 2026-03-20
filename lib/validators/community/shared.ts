import { z } from 'zod';

export const uuidSchema = z.string().uuid('Must be a valid UUID');
export const optionalUuidSchema = uuidSchema.nullable().optional();
export const dateSchema = z.string().min(1, 'Date is required');
export const dateTimeSchema = z.string().min(1, 'Date/time is required');
export const nullableString = (max: number, message: string) =>
  z.string().max(max, message).nullable().optional();
export const optionalUrlSchema = z.string().url('Must be a valid URL').nullable().optional().or(z.literal(''));
export const numericCoordinateSchema = z.number().min(-180).max(180);

export const jsonValueSchema: z.ZodType<
  string | number | boolean | null | { [key: string]: unknown } | unknown[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), z.unknown()),
  ])
);

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const requiredExcludedCategories = ['minors', 'intake', 'risk_scores', 'PII'] as const;

export function appendRequiredExcludedCategories(values: string[] | undefined): string[] {
  return Array.from(new Set([...(values ?? []), ...requiredExcludedCategories]));
}
