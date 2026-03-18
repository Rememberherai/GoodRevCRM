/**
 * cron-job.org REST API client.
 *
 * Wraps the cron-job.org API v1 (https://api.cron-job.org/).
 * Only manages jobs prefixed with "GoodRev: " to avoid touching unrelated jobs.
 */

const API_BASE = 'https://api.cron-job.org';
const JOB_PREFIX = 'GoodRev: ';

// ---------- Types ----------

export interface CronJobOrgSchedule {
  timezone: string;
  expiresAt?: number;
  hours: number[];
  mdays: number[];
  minutes: number[];
  months: number[];
  wdays: number[];
}

export interface CronJobOrgJob {
  jobId: number;
  enabled: boolean;
  title: string;
  saveResponses: boolean;
  url: string;
  lastStatus: number;
  lastDuration: number;
  lastExecution: number;
  nextExecution: number | null;
  type: number;
  requestTimeout: number;
  redirectSuccess: boolean;
  folderId: number;
  schedule: CronJobOrgSchedule;
  requestMethod: number;
}

export interface CronJobOrgDetailedJob extends CronJobOrgJob {
  auth: {
    enable: boolean;
    user: string;
    password: string;
  };
  notification: {
    onFailure: boolean;
    onFailureCount: number;
    onSuccess: boolean;
    onDisable: boolean;
  };
  extendedData: {
    headers: Record<string, string>;
    body: string;
  };
}

export interface CronJobOrgHistoryItem {
  jobLogId: number;
  jobId: number;
  identifier: string;
  date: number;
  datePlanned: number;
  jitter: number;
  url: string;
  duration: number;
  status: number;
  statusText: string;
  httpStatus: number;
  headers: string | null;
  body: string | null;
  stats: {
    nameLookup: number;
    connect: number;
    appConnect: number;
    preTransfer: number;
    startTransfer: number;
    total: number;
  };
}

export interface CreateJobParams {
  title: string;
  url: string;
  enabled?: boolean;
  schedule: CronJobOrgSchedule;
  requestMethod?: number; // 0=GET
  saveResponses?: boolean;
  requestTimeout?: number;
  headers?: Record<string, string>;
  notification?: {
    onFailure?: boolean;
    onSuccess?: boolean;
    onDisable?: boolean;
  };
}

export interface UpdateJobParams {
  enabled?: boolean;
  schedule?: CronJobOrgSchedule;
  title?: string;
  url?: string;
}

// ---------- Status helpers ----------

export const JOB_STATUS_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'OK',
  2: 'DNS Error',
  3: 'Connection Failed',
  4: 'HTTP Error',
  5: 'Timeout',
  6: 'Response Too Large',
  7: 'Invalid URL',
  8: 'Internal Error',
  9: 'Unknown Error',
};

export function isJobStatusOk(status: number): boolean {
  return status === 0 || status === 1;
}

// ---------- API helpers ----------

class CronJobOrgError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'CronJobOrgError';
  }
}

async function apiRequest<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new CronJobOrgError('Invalid cron-job.org API key', 401, 'INVALID_KEY');
    if (res.status === 429) throw new CronJobOrgError('cron-job.org rate limit exceeded', 429, 'RATE_LIMITED');
    throw new CronJobOrgError(
      `cron-job.org API error: ${res.status} ${text}`,
      res.status,
    );
  }

  // DELETE returns empty body
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T;
  }

  return res.json();
}

// ---------- Public API ----------

/**
 * List all GoodRev-managed jobs in the account.
 * Filters to jobs with the "GoodRev: " title prefix.
 */
export async function listJobs(apiKey: string): Promise<CronJobOrgJob[]> {
  const data = await apiRequest<{ jobs: CronJobOrgJob[] }>(apiKey, 'GET', '/jobs');
  return (data.jobs ?? []).filter((j) => j.title.startsWith(JOB_PREFIX));
}

/** Get detailed info for a specific job. */
export async function getJob(apiKey: string, jobId: number): Promise<CronJobOrgDetailedJob> {
  const data = await apiRequest<{ jobDetails: CronJobOrgDetailedJob }>(apiKey, 'GET', `/jobs/${jobId}`);
  return data.jobDetails;
}

/** Create a new cron job on cron-job.org. */
export async function createJob(
  apiKey: string,
  params: CreateJobParams,
): Promise<number> {
  const payload: Record<string, unknown> = {
    job: {
      url: params.url,
      title: params.title.startsWith(JOB_PREFIX) ? params.title : `${JOB_PREFIX}${params.title}`,
      enabled: params.enabled ?? true,
      saveResponses: params.saveResponses ?? true,
      schedule: params.schedule,
      requestMethod: params.requestMethod ?? 0,
      requestTimeout: params.requestTimeout ?? 300,
      notification: {
        onFailure: params.notification?.onFailure ?? true,
        onSuccess: params.notification?.onSuccess ?? false,
        onDisable: params.notification?.onDisable ?? true,
      },
      extendedData: {
        headers: params.headers ?? {},
        body: '',
      },
    },
  };

  const data = await apiRequest<{ jobId: number }>(apiKey, 'PUT', '/jobs', payload);
  return data.jobId;
}

/** Update an existing cron job. Only include changed fields. */
export async function updateJob(
  apiKey: string,
  jobId: number,
  params: UpdateJobParams,
): Promise<void> {
  await apiRequest(apiKey, 'PATCH', `/jobs/${jobId}`, { job: params });
}

/** Delete a cron job. */
export async function deleteJob(apiKey: string, jobId: number): Promise<void> {
  await apiRequest(apiKey, 'DELETE', `/jobs/${jobId}`);
}

/** Get execution history for a job. */
export async function getJobHistory(
  apiKey: string,
  jobId: number,
): Promise<{ history: CronJobOrgHistoryItem[]; predictions: number[] }> {
  return apiRequest(apiKey, 'GET', `/jobs/${jobId}/history`);
}

/** Extract the template key from a GoodRev job title. */
export function extractTemplateTitle(jobTitle: string): string {
  return jobTitle.startsWith(JOB_PREFIX) ? jobTitle.slice(JOB_PREFIX.length) : jobTitle;
}
