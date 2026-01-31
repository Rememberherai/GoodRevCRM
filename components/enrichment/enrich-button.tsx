'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { EnrichmentJob } from '@/types/enrichment';

interface EnrichButtonProps {
  personId: string;
  personName: string;
  onEnriched?: (job: EnrichmentJob, fieldsUpdated: number) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function EnrichButton({
  personId,
  personName,
  onEnriched,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}: EnrichButtonProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastResult, setLastResult] = useState<'success' | 'failed' | null>(null);

  // Poll for job completion
  const pollForResults = useCallback(async (jobId: string, _externalJobId: string) => {
    const maxAttempts = 20; // Poll for up to ~2 minutes
    const pollInterval = 6000; // 6 seconds between polls

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        // Check job status
        const response = await fetch(
          `/api/projects/${slug}/enrich?person_id=${personId}&limit=1`
        );

        if (!response.ok) continue;

        const data = await response.json();
        const jobs = data.jobs as EnrichmentJob[];
        const latestJob = jobs?.find((j) => j.id === jobId);

        if (!latestJob) continue;

        if (latestJob.status === 'completed') {
          setLastResult('success');
          toast.success(`Enriched ${personName} successfully!`);
          onEnriched?.(latestJob, 1);
          router.refresh();
          return;
        } else if (latestJob.status === 'failed') {
          setLastResult('failed');
          toast.error(`Enrichment failed: ${latestJob.error ?? 'Unknown error'}`);
          return;
        }
        // Still processing, continue polling
      } catch {
        // Ignore polling errors, continue trying
      }
    }

    // Timed out - job may still complete via webhook
    toast.info(`Enrichment is taking longer than expected. Results will appear when ready.`);
  }, [slug, personId, personName, onEnriched, router]);

  const handleEnrich = async () => {
    if (!slug || isEnriching) return;

    setIsEnriching(true);
    setLastResult(null);

    try {
      const response = await fetch(`/api/projects/${slug}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Enrichment failed');
      }

      const job = data.job as EnrichmentJob;
      const fieldsUpdated = data.fields_updated ?? 0;

      if (job.status === 'completed') {
        setLastResult('success');
        if (fieldsUpdated > 0) {
          toast.success(`Enriched ${personName} - ${fieldsUpdated} fields updated`);
        } else {
          toast.info(`${personName} already has complete data`);
        }
        onEnriched?.(job, fieldsUpdated);
      } else if (job.status === 'processing') {
        toast.info(`Enriching ${personName}...`);
        // Start polling for results in background
        pollForResults(job.id, job.external_job_id ?? '');
      } else if (job.status === 'failed') {
        setLastResult('failed');
        toast.error(`Enrichment failed: ${job.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      setLastResult('failed');
      const message = error instanceof Error ? error.message : 'Enrichment failed';
      toast.error(message);
    } finally {
      setIsEnriching(false);
    }
  };

  const getIcon = () => {
    if (isEnriching) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (lastResult === 'success') {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (lastResult === 'failed') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <Sparkles className="h-4 w-4" />;
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleEnrich}
      disabled={isEnriching}
    >
      {getIcon()}
      {showLabel && size !== 'icon' && (
        <span className="ml-2">
          {isEnriching ? 'Enriching...' : 'Enrich'}
        </span>
      )}
    </Button>
  );

  if (size === 'icon' || !showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>Enrich {personName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
