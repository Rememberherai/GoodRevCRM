'use client';

import { useState, useEffect } from 'react';
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
import { useEnrichmentStore } from '@/stores/enrichment';

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

  const {
    startEnrichment,
    isEnriching: isEnrichingGlobal,
    getCompletedEnrichment,
    clearEnrichment,
  } = useEnrichmentStore();

  // Check for completed enrichment on mount or when global state changes
  useEffect(() => {
    const completedJob = getCompletedEnrichment(personId);
    if (completedJob?.result) {
      setEnrichmentData(completedJob.result as EnrichmentPerson);
      setShowReviewModal(true);
    }
  }, [personId, getCompletedEnrichment]);

  // Track whether this person is being enriched globally
  const isEnrichingFromStore = isEnrichingGlobal(personId);
  const isEnrichingState = isEnriching || isEnrichingFromStore;

  const handleEnrich = async () => {
    if (!slug || isEnrichingState) return;

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
        // Register with global store - provider will handle polling
        startEnrichment({
          jobId: job.id,
          personId,
          personName,
          projectSlug: slug,
          startedAt: new Date().toISOString(),
        });
        setIsEnriching(false);
        toast.info(`Enriching ${personName}... You can navigate away.`);
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
      clearEnrichment(personId);
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

  const handleCloseModal = () => {
    setShowReviewModal(false);
    setEnrichmentData(null);
    clearEnrichment(personId);
  };

  const getIcon = () => {
    if (isEnrichingState) {
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
      disabled={isEnrichingState}
    >
      {getIcon()}
      {showLabel && size !== 'icon' && (
        <span className="ml-2">
          {isEnrichingState ? 'Enriching...' : 'Enrich'}
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
          onClose={handleCloseModal}
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
        onClose={handleCloseModal}
        enrichmentData={enrichmentData}
        currentPerson={currentPerson}
        onApply={handleApplyEnrichment}
        isApplying={isApplying}
      />
    </>
  );
}
