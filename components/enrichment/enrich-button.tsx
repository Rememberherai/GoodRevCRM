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
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import { EnrichmentReviewModal } from './enrichment-review-modal';

interface EnrichButtonProps {
  personId: string;
  personName: string;
  currentPerson?: {
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_country?: string | null;
  };
  onEnriched?: (job: EnrichmentJob, fieldsUpdated: number) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function EnrichButton({
  personId,
  personName,
  currentPerson = {},
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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentPerson | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Poll for job completion with increasing delays
  const pollForResults = useCallback(async (jobId: string, _externalJobId: string) => {
    // Delays: 30s, 30s, 45s, 60s, 60s, 90s, 90s, 120s... (total ~10 minutes)
    const pollDelays = [30000, 30000, 45000, 60000, 60000, 90000, 90000, 120000, 120000, 120000];

    console.log('[Enrich] Starting poll for job:', jobId);

    for (let attempt = 0; attempt < pollDelays.length; attempt++) {
      const delay = pollDelays[attempt]!;
      console.log(`[Enrich] Poll attempt ${attempt + 1}/${pollDelays.length} - waiting ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        // Check job status (with poll=true to actively check FullEnrich)
        const url = `/api/projects/${slug}/enrich?person_id=${personId}&limit=1&poll=true`;
        console.log('[Enrich] Fetching:', url);
        const response = await fetch(url);

        if (!response.ok) {
          console.log('[Enrich] Response not ok:', response.status);
          continue;
        }

        const data = await response.json();
        console.log('[Enrich] Poll response:', JSON.stringify(data, null, 2));
        const jobs = data.jobs as EnrichmentJob[];
        const latestJob = jobs?.find((j) => j.id === jobId);

        if (!latestJob) {
          console.log('[Enrich] Job not found in response');
          continue;
        }

        console.log('[Enrich] Job status:', latestJob.status, 'Result:', latestJob.result ? 'present' : 'null');

        if (latestJob.status === 'completed' && latestJob.result) {
          console.log('[Enrich] Job completed with result, opening modal');
          // Open review modal with the enrichment data
          setEnrichmentData(latestJob.result as EnrichmentPerson);
          setShowReviewModal(true);
          setIsEnriching(false);
          return;
        } else if (latestJob.status === 'failed') {
          console.log('[Enrich] Job failed:', latestJob.error);
          setLastResult('failed');
          toast.error(`Enrichment failed: ${latestJob.error ?? 'Unknown error'}`);
          setIsEnriching(false);
          return;
        }
        // Still processing, continue polling
        console.log('[Enrich] Still processing, continuing...');
      } catch (err) {
        console.error('[Enrich] Poll error:', err);
        // Ignore polling errors, continue trying
      }
    }

    // Timed out - job may still complete via webhook
    console.log('[Enrich] Timed out after max attempts');
    setIsEnriching(false);
    toast.info(`Enrichment is taking longer than expected. Results will appear when ready.`);
  }, [slug, personId]);

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

      if (job.status === 'completed' && job.result) {
        // Open review modal with the enrichment data
        setEnrichmentData(job.result as EnrichmentPerson);
        setShowReviewModal(true);
        setIsEnriching(false);
      } else if (job.status === 'processing') {
        toast.info(`Enriching ${personName}...`);
        // Start polling for results in background (don't set isEnriching to false)
        pollForResults(job.id, job.external_job_id ?? '');
      } else if (job.status === 'failed') {
        setLastResult('failed');
        setIsEnriching(false);
        toast.error(`Enrichment failed: ${job.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      setLastResult('failed');
      setIsEnriching(false);
      const message = error instanceof Error ? error.message : 'Enrichment failed';
      toast.error(message);
    }
  };

  // Handle applying selected enrichment fields
  const handleApplyEnrichment = async (selectedFields: Record<string, string | null>) => {
    if (!slug || Object.keys(selectedFields).length === 0) return;

    setIsApplying(true);
    try {
      const response = await fetch(`/api/projects/${slug}/people/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedFields),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to apply enrichment');
      }

      setLastResult('success');
      setShowReviewModal(false);
      setEnrichmentData(null);
      toast.success(`Applied ${Object.keys(selectedFields).length} field${Object.keys(selectedFields).length !== 1 ? 's' : ''} to ${personName}`);
      router.refresh();
      onEnriched?.(null as unknown as EnrichmentJob, Object.keys(selectedFields).length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply enrichment';
      toast.error(message);
    } finally {
      setIsApplying(false);
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
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>Enrich {personName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <EnrichmentReviewModal
          open={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setEnrichmentData(null);
          }}
          enrichmentData={enrichmentData}
          currentPerson={currentPerson}
          onApply={handleApplyEnrichment}
          isApplying={isApplying}
        />
      </>
    );
  }

  return (
    <>
      {button}
      <EnrichmentReviewModal
        open={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setEnrichmentData(null);
        }}
        enrichmentData={enrichmentData}
        currentPerson={currentPerson}
        onApply={handleApplyEnrichment}
        isApplying={isApplying}
      />
    </>
  );
}
