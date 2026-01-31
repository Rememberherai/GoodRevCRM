'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
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
  const slug = params?.slug as string;
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastResult, setLastResult] = useState<'success' | 'failed' | null>(null);

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
        setLastResult('success');
        toast.success(`Enrichment started for ${personName}. Results will appear shortly.`);
        onEnriched?.(job, 0);
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
