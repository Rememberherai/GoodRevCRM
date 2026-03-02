'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ProcessQueueButton() {
  const [pendingCount, setPendingCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/queue/count');
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending ?? 0);
      }
    } catch {
      // Silently fail — non-critical
    }
  }, []);

  // Poll every 30 seconds for pending count
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/cron/process-sequences', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        const seq = data.sequences;
        const parts: string[] = [];
        if (seq?.sent > 0) parts.push(`${seq.sent} sent`);
        if (seq?.completed > 0) parts.push(`${seq.completed} completed`);
        if (seq?.errors > 0) parts.push(`${seq.errors} errors`);

        if (parts.length > 0) {
          toast.success(`Queue processed: ${parts.join(', ')}`);
        } else {
          toast.info('No pending items to process');
        }
      } else {
        toast.error('Failed to process queue');
      }
    } catch {
      toast.error('Failed to process queue');
    } finally {
      setProcessing(false);
      fetchCount();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            {pendingCount > 0 && !processing && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 flex items-center justify-center',
                  'min-w-[18px] h-[18px] px-1',
                  'bg-orange-500 text-white',
                  'text-xs font-medium rounded-full'
                )}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {processing
              ? 'Processing queue...'
              : pendingCount > 0
                ? `Process queue (${pendingCount} pending)`
                : 'Process queue'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
