/**
 * cron-job.org scheduler provider.
 *
 * Wraps the existing cronjob-org.ts API client into the SchedulerProvider interface.
 */

import type { SchedulerProvider, MergedJob, NormalizedJob, NormalizedHistoryEntry } from '../provider';
import type { CronJobSchedule } from '../templates';
import { CRON_TEMPLATES } from '../templates';
import {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  getJobHistory,
  type CronJobOrgSchedule,
} from '../cronjob-org';

function toNormalizedSchedule(schedule: CronJobOrgSchedule): CronJobSchedule {
  return {
    timezone: schedule.timezone,
    hours: schedule.hours,
    minutes: schedule.minutes,
    mdays: schedule.mdays,
    months: schedule.months,
    wdays: schedule.wdays,
  };
}

function toNormalizedJob(job: {
  jobId: number;
  enabled: boolean;
  url: string;
  schedule: CronJobOrgSchedule;
  lastStatus: number;
  lastDuration: number;
  lastExecution: number;
  nextExecution: number | null;
}): NormalizedJob {
  return {
    jobId: String(job.jobId),
    enabled: job.enabled,
    url: job.url,
    schedule: toNormalizedSchedule(job.schedule),
    lastStatus: job.lastStatus,
    lastDuration: job.lastDuration,
    lastExecution: job.lastExecution,
    nextExecution: job.nextExecution,
  };
}

export class CronJobOrgProvider implements SchedulerProvider {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private cronSecret: string,
    private projectId: string,
  ) {}

  async listJobs(): Promise<MergedJob[]> {
    const jobs = await listJobs(this.apiKey);

    return CRON_TEMPLATES.map((template) => {
      const matchedJob = jobs.find(
        (j) =>
          j.title === `GoodRev: ${template.title}` ||
          j.url.includes(template.path),
      );

      return {
        template,
        job: matchedJob ? toNormalizedJob(matchedJob) : null,
      };
    });
  }

  async createJob(
    templateKey: string,
    schedule?: CronJobSchedule,
    enabled?: boolean,
  ): Promise<{ jobId: string }> {
    const template = CRON_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) throw new Error('Unknown template key');

    const callbackUrl = `${this.baseUrl.replace(/\/$/, '')}${template.path}?project_id=${this.projectId}`;

    const jobSchedule: CronJobOrgSchedule = {
      timezone: schedule?.timezone ?? template.defaultSchedule.timezone,
      expiresAt: 0,
      hours: schedule?.hours ?? template.defaultSchedule.hours,
      minutes: schedule?.minutes ?? template.defaultSchedule.minutes,
      mdays: schedule?.mdays ?? template.defaultSchedule.mdays,
      months: schedule?.months ?? template.defaultSchedule.months,
      wdays: schedule?.wdays ?? template.defaultSchedule.wdays,
    };

    const jobId = await createJob(this.apiKey, {
      title: template.title,
      url: callbackUrl,
      enabled: enabled ?? true,
      schedule: jobSchedule,
      headers: this.cronSecret ? { Authorization: `Bearer ${this.cronSecret}` } : {},
      saveResponses: true,
      notification: { onFailure: true, onDisable: true },
    });

    return { jobId: String(jobId) };
  }

  async updateJob(
    jobId: string,
    params: { enabled?: boolean; schedule?: CronJobSchedule },
  ): Promise<void> {
    const updateParams: Record<string, unknown> = {};
    if (params.enabled !== undefined) {
      updateParams.enabled = params.enabled;
    }
    if (params.schedule) {
      updateParams.schedule = {
        ...params.schedule,
        expiresAt: 0,
      };
    }
    await updateJob(this.apiKey, parseInt(jobId, 10), updateParams);
  }

  async deleteJob(jobId: string): Promise<void> {
    await deleteJob(this.apiKey, parseInt(jobId, 10));
  }

  async getJobHistory(jobId: string): Promise<NormalizedHistoryEntry[]> {
    const { history } = await getJobHistory(this.apiKey, parseInt(jobId, 10));
    return (history ?? []).slice(0, 10).map((h) => ({
      identifier: h.identifier,
      date: h.date,
      datePlanned: h.datePlanned,
      duration: h.duration,
      status: h.status,
      statusText: h.statusText,
      httpStatus: h.httpStatus,
    }));
  }
}
