/**
 * Browser-based scheduler provider.
 *
 * Stores job config (enabled/disabled + schedule per template) as a JSON blob
 * in project_secrets under key "browser_scheduler_config". The actual interval
 * execution happens client-side via setInterval in the browser.
 *
 * This provider implements the SchedulerProvider interface so existing API
 * routes work unchanged — the scheduler panel can list/create/update/delete
 * jobs exactly as it does for cron-job.org or pg_cron.
 */

import type { SchedulerProvider, MergedJob, NormalizedJob, NormalizedHistoryEntry } from '../provider';
import type { CronJobSchedule } from '../templates';
import { CRON_TEMPLATES } from '../templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProjectSecret } from '@/lib/secrets';
import { setProjectSecret } from '@/lib/secrets';

// ---------- Config shape stored in project_secrets ----------

export interface BrowserJobConfig {
  enabled: boolean;
  schedule: CronJobSchedule;
}

export interface BrowserSchedulerConfig {
  jobs: Record<string, BrowserJobConfig>;
}

// ---------- Provider ----------

export class BrowserSchedulerProvider implements SchedulerProvider {
  constructor(private projectId: string) {}

  private async readConfig(): Promise<BrowserSchedulerConfig> {
    const raw = await getProjectSecret(this.projectId, 'browser_scheduler_config');
    if (!raw) return { jobs: {} };
    try {
      return JSON.parse(raw) as BrowserSchedulerConfig;
    } catch {
      return { jobs: {} };
    }
  }

  private async writeConfig(config: BrowserSchedulerConfig): Promise<void> {
    await setProjectSecret(
      this.projectId,
      'browser_scheduler_config',
      JSON.stringify(config),
    );
  }

  async listJobs(): Promise<MergedJob[]> {
    const config = await this.readConfig();
    const supabase = createAdminClient();

    // Fetch latest history entry per template for status display
    const { data: latestHistory } = await supabase
      .from('browser_scheduler_history')
      .select('template_key, started_at, duration_ms, http_status, status')
      .eq('project_id', this.projectId)
      .order('started_at', { ascending: false })
      .limit(100);

    // Group by template, take first (most recent) per key
    const latestByTemplate = new Map<string, typeof latestHistory extends (infer T)[] | null ? T : never>();
    for (const entry of latestHistory ?? []) {
      if (!latestByTemplate.has(entry.template_key)) {
        latestByTemplate.set(entry.template_key, entry);
      }
    }

    return CRON_TEMPLATES.map((template) => {
      const jobConfig = config.jobs[template.key];

      if (!jobConfig) {
        return { template, job: null };
      }

      const latest = latestByTemplate.get(template.key);
      const lastExecTs = latest?.started_at
        ? Math.floor(new Date(latest.started_at).getTime() / 1000)
        : 0;
      const lastStatus = latest?.status === 'success' ? 1 : latest?.status === 'error' ? 4 : 0;

      const job: NormalizedJob = {
        jobId: template.key, // Use template key as jobId for browser provider
        enabled: jobConfig.enabled,
        url: template.path,
        schedule: jobConfig.schedule,
        lastStatus,
        lastDuration: latest?.duration_ms ?? 0,
        lastExecution: lastExecTs,
        nextExecution: null, // Computed client-side
      };

      return { template, job };
    });
  }

  async createJob(
    templateKey: string,
    schedule?: CronJobSchedule,
    enabled?: boolean,
  ): Promise<{ jobId: string }> {
    const template = CRON_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) throw new Error('Unknown template key');

    const config = await this.readConfig();
    config.jobs[templateKey] = {
      enabled: enabled ?? true,
      schedule: schedule ?? template.defaultSchedule,
    };

    await this.writeConfig(config);
    return { jobId: templateKey };
  }

  async updateJob(
    jobId: string,
    params: { enabled?: boolean; schedule?: CronJobSchedule },
  ): Promise<void> {
    const config = await this.readConfig();
    const existing = config.jobs[jobId];
    if (!existing) throw new Error(`Browser scheduler job not found: ${jobId}`);

    if (params.enabled !== undefined) {
      existing.enabled = params.enabled;
    }
    if (params.schedule) {
      existing.schedule = params.schedule;
    }

    await this.writeConfig(config);
  }

  async deleteJob(jobId: string): Promise<void> {
    const config = await this.readConfig();
    delete config.jobs[jobId];
    await this.writeConfig(config);

    // Also clean up history for this template
    const supabase = createAdminClient();
    await supabase
      .from('browser_scheduler_history')
      .delete()
      .eq('project_id', this.projectId)
      .eq('template_key', jobId);
  }

  async getJobHistory(jobId: string): Promise<NormalizedHistoryEntry[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('browser_scheduler_history')
      .select('id, started_at, duration_ms, http_status, status, error_message')
      .eq('project_id', this.projectId)
      .eq('template_key', jobId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to get browser scheduler history: ${error.message}`);
    }

    return (data ?? []).map((h) => {
      const startMs = new Date(h.started_at).getTime();
      const isOk = h.status === 'success';

      return {
        identifier: h.id,
        date: Math.floor(startMs / 1000),
        datePlanned: Math.floor(startMs / 1000),
        duration: h.duration_ms ?? 0,
        status: isOk ? 1 : 4,
        statusText: h.status ?? 'unknown',
        httpStatus: h.http_status ?? 0,
      };
    });
  }
}
