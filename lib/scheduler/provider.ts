/**
 * Scheduler provider abstraction.
 *
 * Defines a common interface for managing cron jobs, with implementations
 * for cron-job.org and Supabase pg_cron. A factory function reads the chosen
 * provider from project_secrets and returns the right implementation.
 */

import type { CronJobSchedule, CronTemplate } from './templates';
import { getProjectSecrets } from '@/lib/secrets';

// ---------- Types ----------

export type SchedulerProviderType = 'cronjob_org' | 'supabase_pgcron';

export interface NormalizedJob {
  jobId: string;
  enabled: boolean;
  url: string;
  schedule: CronJobSchedule;
  lastStatus: number;
  lastDuration: number;
  lastExecution: number;
  nextExecution: number | null;
}

export interface MergedJob {
  template: CronTemplate;
  job: NormalizedJob | null;
}

export interface NormalizedHistoryEntry {
  identifier: string;
  date: number;
  datePlanned: number;
  duration: number;
  status: number;
  statusText: string;
  httpStatus: number;
}

export interface SchedulerProvider {
  listJobs(): Promise<MergedJob[]>;
  createJob(
    templateKey: string,
    schedule?: CronJobSchedule,
    enabled?: boolean,
  ): Promise<{ jobId: string }>;
  updateJob(
    jobId: string,
    params: { enabled?: boolean; schedule?: CronJobSchedule },
  ): Promise<void>;
  deleteJob(jobId: string): Promise<void>;
  getJobHistory(jobId: string): Promise<NormalizedHistoryEntry[]>;
}

// ---------- Factory ----------

export async function getSchedulerProvider(projectId: string): Promise<{
  provider: SchedulerProvider | null;
  providerType: SchedulerProviderType | null;
  configured: boolean;
}> {
  const secrets = await getProjectSecrets(projectId, [
    'scheduler_provider',
    'cronjob_org_api_key',
    'cron_secret',
    'scheduler_base_url',
  ]);

  const providerChoice = secrets.scheduler_provider;
  const cronSecret = secrets.cron_secret || '';
  const baseUrl = secrets.scheduler_base_url || process.env.NEXT_PUBLIC_APP_URL || '';

  // Determine provider type
  let providerType: SchedulerProviderType | null = null;

  if (providerChoice === 'supabase_pgcron') {
    providerType = 'supabase_pgcron';
  } else if (providerChoice === 'cronjob_org' || secrets.cronjob_org_api_key) {
    providerType = 'cronjob_org';
  }

  if (!providerType) {
    return { provider: null, providerType: null, configured: false };
  }

  if (providerType === 'cronjob_org') {
    const apiKey = secrets.cronjob_org_api_key;
    if (!apiKey) {
      return { provider: null, providerType, configured: false };
    }
    const { CronJobOrgProvider } = await import('./providers/cronjob-org-provider');
    return {
      provider: new CronJobOrgProvider(apiKey, baseUrl, cronSecret, projectId),
      providerType,
      configured: true,
    };
  }

  // supabase_pgcron — no API key needed, uses the admin client
  const { SupabaseCronProvider } = await import('./providers/supabase-cron-provider');
  return {
    provider: new SupabaseCronProvider(projectId, baseUrl, cronSecret),
    providerType,
    configured: true,
  };
}
