'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLeaderElection } from './use-leader-election';
import { scheduleToIntervalMs } from '@/lib/scheduler/schedule-to-interval';
import type { CronJobSchedule } from '@/lib/scheduler/templates';

interface JobConfig {
  templateKey: string;
  path: string;
  enabled: boolean;
  schedule: CronJobSchedule;
}

interface LastRun {
  time: number;
  status: 'success' | 'error';
  httpStatus: number;
  durationMs: number;
}

export interface BrowserSchedulerState {
  isLeader: boolean;
  isRunning: boolean;
  activeJobCount: number;
  lastRuns: Record<string, LastRun>;
  /** Trigger a re-fetch of job config (e.g., after panel changes) */
  refresh: () => void;
}

/**
 * Core browser scheduler engine.
 * When enabled and this tab is leader, runs setInterval for each enabled job,
 * calling cron endpoints via fetch with session cookie auth.
 */
export function useBrowserScheduler(
  slug: string,
  enabled: boolean,
): BrowserSchedulerState {
  const { isLeader } = useLeaderElection(`browser-scheduler-${slug}`, enabled);
  const [jobs, setJobs] = useState<JobConfig[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, LastRun>>({});
  const [refreshCounter, setRefreshCounter] = useState(0);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const runningRef = useRef(new Set<string>());
  const prevJobsKeyRef = useRef('');

  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  // Listen for job config changes from the scheduler panel
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener('scheduler-jobs-changed', handler);
    return () => window.removeEventListener('scheduler-jobs-changed', handler);
  }, []);

  // Fetch job config from the scheduler API
  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      prevJobsKeyRef.current = '';
      return;
    }

    let cancelled = false;

    async function fetchConfig() {
      try {
        const res = await fetch(`/api/projects/${slug}/scheduler/jobs`);
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (data.providerType !== 'browser' || !data.configured) {
          setJobs([]);
          prevJobsKeyRef.current = '';
          return;
        }

        const jobConfigs: JobConfig[] = (data.jobs ?? [])
          .filter((j: any) => j.job?.enabled)
          .map((j: any) => ({
            templateKey: j.template.key,
            path: j.template.path,
            enabled: j.job.enabled,
            schedule: j.job.schedule,
          }));

        // Only update state if jobs actually changed (prevents interval re-creation)
        const newKey = JSON.stringify(jobConfigs.map((j) => `${j.templateKey}:${j.enabled}:${JSON.stringify(j.schedule)}`));
        if (newKey !== prevJobsKeyRef.current) {
          prevJobsKeyRef.current = newKey;
          setJobs(jobConfigs);
        }
      } catch {
        // Silently fail — will retry on next refresh
      }
    }

    fetchConfig();
    return () => { cancelled = true; };
  }, [slug, enabled, refreshCounter]);

  // Execute a single job
  const executeJob = useCallback(async (job: JobConfig) => {
    // Prevent overlapping executions of the same job
    if (runningRef.current.has(job.templateKey)) return;
    runningRef.current.add(job.templateKey);

    const startTime = Date.now();
    let httpStatus = 0;
    let status: 'success' | 'error' = 'error';
    let errorMessage: string | undefined;

    try {
      const res = await fetch(job.path, {
        method: 'POST',
        credentials: 'include',
      });
      httpStatus = res.status;
      status = res.ok ? 'success' : 'error';
      if (!res.ok) {
        try {
          const body = await res.json();
          errorMessage = body.error || `HTTP ${res.status}`;
        } catch {
          errorMessage = `HTTP ${res.status}`;
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Network error';
    }

    const durationMs = Date.now() - startTime;
    runningRef.current.delete(job.templateKey);

    // Update last run state
    setLastRuns((prev) => ({
      ...prev,
      [job.templateKey]: { time: Date.now(), status, httpStatus, durationMs },
    }));

    // Log to history API (fire-and-forget)
    try {
      fetch(`/api/projects/${slug}/scheduler/browser-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateKey: job.templateKey,
          durationMs,
          httpStatus,
          status,
          errorMessage,
        }),
      }).catch(() => { /* ignore logging failures */ });
    } catch { /* ignore */ }
  }, [slug]);

  // Start/stop intervals based on leader status and job config
  useEffect(() => {
    const currentIntervals = intervalsRef.current;

    if (!isLeader || !enabled) {
      // Stop all intervals
      for (const [, timer] of currentIntervals) {
        clearInterval(timer);
      }
      currentIntervals.clear();
      return;
    }

    // Reconcile: stop intervals for jobs no longer in config, start new ones
    const activeKeys = new Set(jobs.map((j) => j.templateKey));

    // Stop removed jobs
    for (const [key, timer] of currentIntervals) {
      if (!activeKeys.has(key)) {
        clearInterval(timer);
        currentIntervals.delete(key);
      }
    }

    // Start new jobs
    for (const job of jobs) {
      if (currentIntervals.has(job.templateKey)) continue;

      const intervalMs = scheduleToIntervalMs(job.schedule);

      // Run immediately on first tick
      executeJob(job);

      const timer = setInterval(() => {
        executeJob(job);
      }, intervalMs);

      currentIntervals.set(job.templateKey, timer);
    }

    return () => {
      for (const [, timer] of currentIntervals) {
        clearInterval(timer);
      }
      currentIntervals.clear();
    };
  }, [isLeader, enabled, jobs, executeJob]);

  return {
    isLeader,
    isRunning: isLeader && jobs.length > 0,
    activeJobCount: jobs.length,
    lastRuns,
    refresh,
  };
}
