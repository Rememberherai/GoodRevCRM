'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface BulkEnrichDialogProps {
  personIds: string[];
  onComplete?: () => void;
  trigger?: React.ReactNode;
}

interface EnrichmentProgress {
  status: 'idle' | 'starting' | 'processing' | 'completed' | 'failed';
  message: string;
  bulkJobId?: string;
  estimatedCompletion?: string;
}

export function BulkEnrichDialog({ personIds, onComplete, trigger }: BulkEnrichDialogProps) {
  const params = useParams();
  const slug = params?.slug as string;
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress>({
    status: 'idle',
    message: '',
  });

  const handleEnrich = async () => {
    if (!slug || personIds.length === 0) return;

    setProgress({ status: 'starting', message: 'Starting bulk enrichment...' });

    try {
      const response = await fetch(`/api/projects/${slug}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: personIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Bulk enrichment failed');
      }

      if (data.status === 'processing') {
        setProgress({
          status: 'processing',
          message: `Processing ${personIds.length} people...`,
          bulkJobId: data.bulk_job_id,
          estimatedCompletion: data.estimated_completion,
        });

        toast.success(`Bulk enrichment started for ${personIds.length} people`);

        // Close dialog - results will come via webhook
        setTimeout(() => {
          setOpen(false);
          onComplete?.();
        }, 2000);
      } else {
        // Single person was processed synchronously (shouldn't happen with bulk)
        setProgress({ status: 'completed', message: 'Enrichment completed!' });
        toast.success('Enrichment completed');
        onComplete?.();

        setTimeout(() => setOpen(false), 1500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bulk enrichment failed';
      setProgress({ status: 'failed', message });
      toast.error(message);
    }
  };

  const handleClose = () => {
    if (progress.status !== 'starting') {
      setOpen(false);
      setProgress({ status: 'idle', message: '' });
    }
  };

  const getProgressPercentage = () => {
    switch (progress.status) {
      case 'starting':
        return 25;
      case 'processing':
        return 50;
      case 'completed':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" disabled={personIds.length === 0}>
            <Sparkles className="mr-2 h-4 w-4" />
            Enrich {personIds.length} Selected
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk Enrich People
          </DialogTitle>
          <DialogDescription>
            Enrich {personIds.length} selected {personIds.length === 1 ? 'person' : 'people'} with
            contact information from FullEnrich.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {progress.status === 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{personIds.length} people selected</p>
                  <p className="text-sm text-muted-foreground">
                    This will use approximately {personIds.length} credits
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The enrichment process runs in the background. You&apos;ll be notified
                when it&apos;s complete.
              </p>
            </div>
          )}

          {(progress.status === 'starting' || progress.status === 'processing') && (
            <div className="space-y-4">
              <Progress value={getProgressPercentage()} className="h-2" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.message}
              </div>
              {progress.estimatedCompletion && (
                <p className="text-xs text-muted-foreground">
                  Estimated completion: {new Date(progress.estimatedCompletion).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {progress.status === 'completed' && (
            <div className="flex items-center gap-2 text-green-600">
              <Sparkles className="h-5 w-5" />
              <span>{progress.message}</span>
            </div>
          )}

          {progress.status === 'failed' && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{progress.message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {progress.status === 'idle' && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEnrich}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Enrichment
              </Button>
            </>
          )}
          {(progress.status === 'starting' || progress.status === 'processing') && (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </Button>
          )}
          {(progress.status === 'completed' || progress.status === 'failed') && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
