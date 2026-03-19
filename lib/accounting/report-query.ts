import { z, type ZodRawShape, type ZodObject } from 'zod';

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

const dateSchema = z.string().refine(isValidDateString, 'Invalid date');
const uuidSchema = z.string().uuid();

function compareDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export const dateRangeQuerySchema = z.object({
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  project_id: uuidSchema.optional(),
});

export const asOfDateQuerySchema = z.object({
  as_of_date: dateSchema.optional(),
  project_id: uuidSchema.optional(),
});

export const generalLedgerQuerySchema = z.object({
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  project_id: uuidSchema.optional(),
  account_id: uuidSchema.optional(),
});

export const agingQuerySchema = z.object({
  as_of_date: dateSchema.optional(),
});

export function parseQuery<T extends ZodObject<ZodRawShape>>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.parse(raw);

  if ('start_date' in raw && 'end_date' in raw) {
    const startDate = raw.start_date;
    const endDate = raw.end_date;
    if (startDate && endDate && compareDates(startDate, endDate) > 0) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: ['end_date'],
          message: 'End date must be on or after start date',
        },
      ]);
    }
  }

  return parsed;
}

export function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
