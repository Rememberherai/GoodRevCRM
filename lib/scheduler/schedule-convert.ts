/**
 * Convert between cron-job.org schedule format (arrays) and standard cron expressions.
 *
 * cron-job.org format: { hours: [-1], minutes: [0, 30], mdays: [-1], months: [-1], wdays: [-1] }
 *   where [-1] means "every"
 *
 * Standard cron: "0,30 * * * *"
 *   fields: minute hour day-of-month month day-of-week
 */

import type { CronJobSchedule } from './templates';

/** Convert a cron-job.org schedule object to a 5-field cron expression string. */
export function cronJobScheduleToCronExpr(schedule: CronJobSchedule): string {
  const fieldToExpr = (values: number[]): string => {
    if (values.length === 1 && values[0] === -1) return '*';
    return values.filter((v) => v >= 0).join(',');
  };

  return [
    fieldToExpr(schedule.minutes),
    fieldToExpr(schedule.hours),
    fieldToExpr(schedule.mdays),
    fieldToExpr(schedule.months),
    fieldToExpr(schedule.wdays),
  ].join(' ');
}

/** Parse a 5-field cron expression string into a cron-job.org schedule object. */
export function cronExprToCronJobSchedule(
  expr: string,
  timezone: string = 'America/New_York',
): CronJobSchedule {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression (expected 5 fields): ${expr}`);
  }

  const parseField = (field: string, maxVal: number): number[] => {
    if (field === '*') return [-1];

    const values = new Set<number>();

    for (const part of field.split(',')) {
      // Handle ranges like 1-5
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!, 10);
        const end = parseInt(rangeMatch[2]!, 10);
        for (let i = start; i <= end; i++) values.add(i);
        continue;
      }

      // Handle step values like */5 or 1-30/5
      const stepMatch = part.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
      if (stepMatch) {
        const step = parseInt(stepMatch[4]!, 10);
        const start = stepMatch[2] ? parseInt(stepMatch[2], 10) : 0;
        const end = stepMatch[3] ? parseInt(stepMatch[3], 10) : maxVal;
        for (let i = start; i <= end; i += step) values.add(i);
        continue;
      }

      // Plain number
      const num = parseInt(part, 10);
      if (!isNaN(num)) values.add(num);
    }

    return values.size === 0 ? [-1] : Array.from(values).sort((a, b) => a - b);
  };

  return {
    timezone,
    minutes: parseField(parts[0]!, 59),
    hours: parseField(parts[1]!, 23),
    mdays: parseField(parts[2]!, 31),
    months: parseField(parts[3]!, 12),
    wdays: parseField(parts[4]!, 6),
  };
}
