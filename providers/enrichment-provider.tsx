'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useEnrichmentStore } from '@/stores/enrichment';
import type { EnrichmentJob } from '@/types/enrichment';

const POLL_INTERVAL = 15000; // 15 seconds

export function EnrichmentProvider({ children }: { children: ReactNode }) {
  const {
    pendingEnrichments,
    completeEnrichment,
    failEnrichment,
    getPendingEnrichments,
  } = useEnrichmentStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pending = getPendingEnrichments();
    if (pending.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkPendingEnrichments = async () => {
      const currentPending = getPendingEnrichments();

      for (const enrichment of currentPending) {
        try {
          const response = await fetch(
            `/api/projects/${enrichment.projectSlug}/enrich?person_id=${enrichment.personId}&limit=1&poll=true`
          );

          if (!response.ok) continue;

          const data = await response.json();
          const job = data.jobs?.[0] as EnrichmentJob | undefined;

          if (job?.status === 'completed' && job.result) {
            completeEnrichment(enrichment.personId, job);
            toast.success(`Enrichment complete for ${enrichment.personName}`, {
              action: {
                label: 'Review',
                onClick: () => {
                  window.location.href = `/projects/${enrichment.projectSlug}/people/${enrichment.personId}`;
                },
              },
              duration: 15000,
            });
          } else if (job?.status === 'failed') {
            failEnrichment(enrichment.personId);
            toast.error(`Enrichment failed for ${enrichment.personName}`, {
              description: job.error ?? 'Unknown error',
            });
          }
        } catch (error) {
          console.error('Error checking enrichment status:', error);
        }
      }
    };

    // Check immediately on mount if there are pending enrichments
    checkPendingEnrichments();

    // Set up polling interval
    intervalRef.current = setInterval(checkPendingEnrichments, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [Object.keys(pendingEnrichments).length, completeEnrichment, failEnrichment, getPendingEnrichments]);

  return <>{children}</>;
}
