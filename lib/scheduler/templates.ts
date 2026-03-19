/**
 * Cron job templates — static config for known cron endpoints.
 *
 * Each template defines a cron endpoint that can be scheduled via cron-job.org.
 * The `defaultSchedule` uses the cron-job.org schedule object format
 * (arrays of hours/minutes/mdays/months/wdays, where [-1] = every).
 */

export interface CronJobSchedule {
  timezone: string;
  hours: number[];
  minutes: number[];
  mdays: number[];
  months: number[];
  wdays: number[];
}

export interface CronTemplate {
  key: string;
  title: string;
  path: string;
  description: string;
  defaultSchedule: CronJobSchedule;
}

export const CRON_TEMPLATES: CronTemplate[] = [
  {
    key: 'process-sequences',
    title: 'Process Sequences',
    path: '/api/cron/process-sequences',
    description: 'Processes email sequences and time-based automations',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [-1],
      minutes: [0, 30],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'sync-emails',
    title: 'Sync Emails',
    path: '/api/cron/sync-emails',
    description: 'Syncs Gmail inbox for new emails and bounces',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [-1],
      minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'fetch-news',
    title: 'Fetch News',
    path: '/api/cron/fetch-news',
    description: 'Fetches company news articles for monitoring',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [0, 6, 12, 18],
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'workflow-delays',
    title: 'Workflow Delays',
    path: '/api/cron/workflow-delays',
    description: 'Processes delayed workflow steps and scheduled workflows',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [-1],
      minutes: [-1],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'contract-reminders',
    title: 'Contract Reminders',
    path: '/api/cron/contract-reminders',
    description: 'Sends signing reminders, expires documents, repairs completions',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [-1],
      minutes: [0, 30],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'recurring-transactions',
    title: 'Recurring Transactions',
    path: '/api/cron/recurring-transactions',
    description: 'Creates scheduled invoices and bills from recurring templates',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [6],
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'payment-reminders',
    title: 'Payment Reminders',
    path: '/api/cron/payment-reminders',
    description: 'Marks overdue invoices/bills and creates payment reminders',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [8],
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    key: 'booking-reminders',
    title: 'Booking Reminders',
    path: '/api/cron/booking-reminders',
    description: 'Sends 24h and 1h reminders for upcoming bookings',
    defaultSchedule: {
      timezone: 'America/New_York',
      hours: [-1],
      minutes: [0, 30],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
];

/** Human-readable description of a cron-job.org schedule */
export function describeSchedule(schedule: CronJobSchedule): string {
  const { hours, minutes } = schedule;
  const everyHour = hours.length === 1 && hours[0] === -1;
  const everyMinute = minutes.length === 1 && minutes[0] === -1;

  if (everyMinute && everyHour) return 'Every minute';
  if (everyHour && minutes.length === 1) return `Every hour at :${String(minutes[0]).padStart(2, '0')}`;
  if (everyHour && minutes.length > 1) {
    const interval = minutes.length > 1 ? (minutes[1] ?? 0) - (minutes[0] ?? 0) : 0;
    if (interval > 0 && minutes.every((m, i) => m === i * interval)) {
      return `Every ${interval} minutes`;
    }
    return `${minutes.length} times per hour`;
  }
  if (hours.length === 1 && !everyHour) {
    return `Daily at ${hours[0]}:${String(minutes[0] ?? 0).padStart(2, '0')}`;
  }
  if (hours.length > 1 && minutes.length === 1) {
    return `${hours.length} times per day`;
  }
  return 'Custom schedule';
}

/** Schedule presets for the UI dropdown */
export const SCHEDULE_PRESETS: { label: string; schedule: Pick<CronJobSchedule, 'hours' | 'minutes'> }[] = [
  { label: 'Every minute', schedule: { hours: [-1], minutes: [-1] } },
  { label: 'Every 5 minutes', schedule: { hours: [-1], minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] } },
  { label: 'Every 15 minutes', schedule: { hours: [-1], minutes: [0, 15, 30, 45] } },
  { label: 'Every 30 minutes', schedule: { hours: [-1], minutes: [0, 30] } },
  { label: 'Every hour', schedule: { hours: [-1], minutes: [0] } },
  { label: 'Every 6 hours', schedule: { hours: [0, 6, 12, 18], minutes: [0] } },
  { label: 'Daily (midnight)', schedule: { hours: [0], minutes: [0] } },
];
