/**
 * Convert a CronJobSchedule to a setInterval-compatible millisecond interval.
 *
 * Since browser setInterval can't do true cron expressions (e.g., "at 6am daily"),
 * we approximate: compute the gap between consecutive executions based on the
 * hours/minutes arrays.
 */

import type { CronJobSchedule } from './templates';

export function scheduleToIntervalMs(schedule: CronJobSchedule): number {
  const { hours, minutes } = schedule;
  const everyHour = hours.length === 1 && hours[0] === -1;
  const everyMinute = minutes.length === 1 && minutes[0] === -1;

  // Every minute
  if (everyMinute && everyHour) {
    return 60_000;
  }

  // Every N minutes (hours = every)
  if (everyHour && minutes.length > 0) {
    // e.g., [0, 30] => every 30 min; [0, 15, 30, 45] => every 15 min
    const intervalMinutes = 60 / minutes.length;
    return Math.max(intervalMinutes * 60_000, 60_000); // minimum 1 minute
  }

  // Specific hours (e.g., [0, 6, 12, 18] => every 6 hours)
  if (hours.length > 0 && !everyHour) {
    const intervalHours = 24 / hours.length;
    return Math.max(intervalHours * 3_600_000, 60_000);
  }

  // Fallback: every 30 minutes
  return 30 * 60_000;
}
