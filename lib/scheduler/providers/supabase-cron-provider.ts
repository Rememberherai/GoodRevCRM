/**
 * Supabase pg_cron scheduler provider.
 *
 * Manages cron jobs via SECURITY DEFINER RPC functions that wrap pg_cron + pg_net.
 * No external API key needed — runs inside the same Supabase database.
 *
 * Job naming: goodrev_{projectId_first8}_{templateKey}
 * HTTP callbacks: via pg_net's net.http_post()
 */

import type { SchedulerProvider, MergedJob, NormalizedJob, NormalizedHistoryEntry } from '../provider';
import type { CronJobSchedule } from '../templates';
import { CRON_TEMPLATES } from '../templates';
import { cronJobScheduleToCronExpr, cronExprToCronJobSchedule } from '../schedule-convert';
import { createAdminClient } from '@/lib/supabase/admin';

function jobPrefix(projectId: string): string {
  return `goodrev_${projectId.slice(0, 8)}_`;
}

function jobName(projectId: string, templateKey: string): string {
  return `${jobPrefix(projectId)}${templateKey.replace(/-/g, '_')}`;
}

/** Extract the callback URL from a pg_cron command that wraps net.http_post. */
function extractUrlFromCommand(command: string): string {
  const match = command.match(/url\s*:=\s*'([^']+)'/);
  return match?.[1] ?? '';
}

export class SupabaseCronProvider implements SchedulerProvider {
  private prefix: string;

  constructor(
    private projectId: string,
    private baseUrl: string,
    private cronSecret: string,
  ) {
    this.prefix = jobPrefix(projectId);
  }

  async listJobs(): Promise<MergedJob[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('scheduler_list_jobs', {
      p_prefix: this.prefix,
    });

    if (error) {
      throw new Error(`Failed to list pg_cron jobs: ${error.message}`);
    }

    const jobRows = data ?? [];

    return CRON_TEMPLATES.map((template) => {
      const expectedName = jobName(this.projectId, template.key);
      const row = jobRows.find((j) => j.job_name === expectedName);

      if (!row) {
        return { template, job: null };
      }

      const schedule = cronExprToCronJobSchedule(
        row.schedule,
        template.defaultSchedule.timezone,
      );

      const job: NormalizedJob = {
        jobId: String(row.job_id),
        enabled: row.active,
        url: extractUrlFromCommand(row.command),
        schedule,
        lastStatus: 0, // pg_cron doesn't track last status on the job itself
        lastDuration: 0,
        lastExecution: 0,
        nextExecution: null,
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

    const resolvedSchedule = schedule ?? template.defaultSchedule;
    const cronExpr = cronJobScheduleToCronExpr(resolvedSchedule);
    const callbackUrl = `${this.baseUrl.replace(/\/$/, '')}${template.path}?project_id=${this.projectId}`;
    const name = jobName(this.projectId, templateKey);

    const headers: Record<string, string> = {};
    if (this.cronSecret) {
      headers['Authorization'] = `Bearer ${this.cronSecret}`;
    }
    headers['Content-Type'] = 'application/json';

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('scheduler_create_job', {
      p_name: name,
      p_schedule: cronExpr,
      p_url: callbackUrl,
      p_headers: headers,
      p_body: {},
    });

    if (error) {
      throw new Error(`Failed to create pg_cron job: ${error.message}`);
    }

    const jobId = String(data);

    // If created but should be disabled, update active state
    if (enabled === false) {
      await this.updateJob(jobId, { enabled: false });
    }

    return { jobId };
  }

  async updateJob(
    jobId: string,
    params: { enabled?: boolean; schedule?: CronJobSchedule },
  ): Promise<void> {
    // We need the job name to call the RPC. Look it up from the job list.
    const supabase = createAdminClient();
    const { data: jobs } = await supabase.rpc('scheduler_list_jobs', {
      p_prefix: this.prefix,
    });

    const jobRows = jobs ?? [];
    const row = jobRows.find((j) => String(j.job_id) === jobId);
    if (!row) throw new Error(`pg_cron job not found: ${jobId}`);

    const rpcParams: { p_name: string; p_schedule?: string; p_active?: boolean } = {
      p_name: row.job_name,
    };

    if (params.schedule) {
      rpcParams.p_schedule = cronJobScheduleToCronExpr(params.schedule);
    }
    if (params.enabled !== undefined) {
      rpcParams.p_active = params.enabled;
    }

    const { error } = await supabase.rpc('scheduler_update_job', rpcParams);
    if (error) {
      throw new Error(`Failed to update pg_cron job: ${error.message}`);
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    const supabase = createAdminClient();

    // Look up job name from ID
    const { data: jobs } = await supabase.rpc('scheduler_list_jobs', {
      p_prefix: this.prefix,
    });

    const jobRows = jobs ?? [];
    const row = jobRows.find((j) => String(j.job_id) === jobId);
    if (!row) throw new Error(`pg_cron job not found: ${jobId}`);

    const { error } = await supabase.rpc('scheduler_delete_job', {
      p_name: row.job_name,
    });
    if (error) {
      throw new Error(`Failed to delete pg_cron job: ${error.message}`);
    }
  }

  async getJobHistory(jobId: string): Promise<NormalizedHistoryEntry[]> {
    const supabase = createAdminClient();

    // Look up job name from ID
    const { data: jobs } = await supabase.rpc('scheduler_list_jobs', {
      p_prefix: this.prefix,
    });

    const jobRows = jobs ?? [];
    const row = jobRows.find((j) => String(j.job_id) === jobId);
    if (!row) return [];

    const { data, error } = await supabase.rpc('scheduler_job_history', {
      p_name: row.job_name,
    });

    if (error) {
      throw new Error(`Failed to get pg_cron job history: ${error.message}`);
    }

    return (data ?? []).map((h) => {
      const startMs = new Date(h.start_time).getTime();
      const endMs = h.end_time ? new Date(h.end_time).getTime() : startMs;
      const isOk = h.status === 'succeeded';

      return {
        identifier: String(h.run_id),
        date: Math.floor(startMs / 1000),
        datePlanned: Math.floor(startMs / 1000),
        duration: endMs - startMs,
        status: isOk ? 1 : 4,
        statusText: h.status ?? 'unknown',
        httpStatus: isOk ? 200 : 0,
      };
    });
  }
}
