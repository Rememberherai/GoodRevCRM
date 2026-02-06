import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { RfpResearchResult } from '@/types/rfp-research';

interface UseRfpResearchReturn {
  results: RfpResearchResult[];
  latest: RfpResearchResult | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  runResearch: (additionalContext?: string) => Promise<void>;
  refresh: () => Promise<void>;
  cancelResearch: () => void;
}

export function useRfpResearch(rfpId: string): UseRfpResearchReturn {
  const params = useParams();
  const projectSlug = params.slug as string;

  const [results, setResults] = useState<RfpResearchResult[]>([]);
  const [latest, setLatest] = useState<RfpResearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const runningJobIdRef = useRef<string | null>(null);
  const pollAttemptsRef = useRef<number>(0);

  // Maximum polling attempts (3 seconds * 60 = 3 minutes max)
  const MAX_POLL_ATTEMPTS = 60;

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    runningJobIdRef.current = null;
    pollAttemptsRef.current = 0;
  }, []);

  // Poll for job completion
  const pollForCompletion = useCallback(
    async (jobId: string) => {
      try {
        pollAttemptsRef.current += 1;

        // Check if we've exceeded max attempts
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          console.error('[RFP Research] Max polling attempts exceeded');
          stopPolling();
          setIsRunning(false);
          setError('Research timed out. Please try again.');
          return;
        }

        const response = await fetch(
          `/api/projects/${projectSlug}/rfps/${rfpId}/research/${jobId}`
        );

        if (!response.ok) {
          // If the job is not found, it might have been deleted or failed to create
          if (response.status === 404) {
            console.error('[RFP Research] Job not found:', jobId);
            stopPolling();
            setIsRunning(false);
            setError('Research job not found. Please try again.');
            return;
          }
          throw new Error('Failed to fetch research status');
        }

        const data = await response.json();
        const result = data.result as RfpResearchResult;

        if (result.status === 'completed' || result.status === 'failed') {
          stopPolling();
          setIsRunning(false);

          // Update results with the completed job
          setResults((prev) => {
            const filtered = prev.filter((r) => r.id !== result.id);
            return [result, ...filtered];
          });

          if (result.status === 'completed') {
            setLatest(result);
          } else if (result.status === 'failed') {
            setError(result.error ?? 'Research failed');
          }
        }
      } catch (err) {
        console.error('[RFP Research] Polling error:', err);
        // Increment failed attempts counter
        const failedAttempts = (pollAttemptsRef.current || 0);

        // Stop polling after 5 consecutive failures
        if (failedAttempts > 5) {
          stopPolling();
          setIsRunning(false);
          setError('Lost connection while polling for research status. Please refresh and try again.');
        }
      }
    },
    [projectSlug, rfpId, stopPolling, MAX_POLL_ATTEMPTS]
  );

  // Start polling for a job
  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      runningJobIdRef.current = jobId;
      pollAttemptsRef.current = 0;

      // Poll every 3 seconds
      pollingRef.current = setInterval(() => {
        pollForCompletion(jobId);
      }, 3000);

      // Also poll immediately
      pollForCompletion(jobId);
    },
    [pollForCompletion, stopPolling]
  );

  // Load research history
  const loadResearch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/projects/${projectSlug}/rfps/${rfpId}/research`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch research history');
      }

      const data = await response.json();
      setResults(data.results ?? []);
      setLatest(data.latest ?? null);

      // Check if there's a running job
      const runningJob = (data.results ?? []).find(
        (r: RfpResearchResult) => r.status === 'running'
      );
      if (runningJob) {
        setIsRunning(true);
        startPolling(runningJob.id);
      }
    } catch (err) {
      console.error('Error loading research:', err);
      setError(err instanceof Error ? err.message : 'Failed to load research');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, rfpId, startPolling]);

  // Run new research
  const runResearch = useCallback(
    async (additionalContext?: string) => {
      try {
        setIsRunning(true);
        setError(null);

        const response = await fetch(
          `/api/projects/${projectSlug}/rfps/${rfpId}/research`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ additional_context: additionalContext }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? 'Failed to start research');
        }

        const data = await response.json();
        const job = data.job as RfpResearchResult;

        // Add the new job to results
        setResults((prev) => [job, ...prev]);

        // Start polling for completion
        startPolling(job.id);
      } catch (err) {
        console.error('Error starting research:', err);
        setError(err instanceof Error ? err.message : 'Failed to start research');
        setIsRunning(false);
      }
    },
    [projectSlug, rfpId, startPolling]
  );

  // Load on mount
  useEffect(() => {
    loadResearch();
  }, [loadResearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Cancel ongoing research
  const cancelResearch = useCallback(() => {
    stopPolling();
    setIsRunning(false);
    setError('Research cancelled by user');
  }, [stopPolling]);

  return {
    results,
    latest,
    isLoading,
    isRunning,
    error,
    runResearch,
    refresh: loadResearch,
    cancelResearch,
  };
}
