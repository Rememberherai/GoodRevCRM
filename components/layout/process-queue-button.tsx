'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Loader2, Clock, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QueueItem {
  id: string;
  sequence_id: string;
  person_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  created_at: string;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  sequence?: {
    id: string;
    name: string;
  };
}

export function ProcessQueueButton() {
  const [pendingCount, setPendingCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);

  // Long-press tracking
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

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

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch('/api/queue/items?limit=100');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotalItems(data.total ?? 0);
      }
    } catch {
      toast.error('Failed to load queue items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Poll every 30 seconds for pending count
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Load items when sheet opens
  useEffect(() => {
    if (sheetOpen) {
      fetchItems();
    }
  }, [sheetOpen, fetchItems]);

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
      // Refresh items if sheet is open
      if (sheetOpen) {
        fetchItems();
      }
    }
  };

  // Long-press handlers
  const handlePointerDown = () => {
    if (processing) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setSheetOpen(true);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Only process on short click (not long-press)
    if (!isLongPress.current && !processing) {
      handleProcess();
    }
  };

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const getPersonName = (person: QueueItem['person']) => {
    if (!person) return 'Unknown';
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
    return name || person.email || 'Unknown';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group items by sequence
  const groupedItems = items.reduce<Record<string, { name: string; items: QueueItem[] }>>(
    (acc, item) => {
      const seqId = item.sequence_id;
      const seqName = item.sequence?.name || 'Unknown Sequence';
      if (!acc[seqId]) {
        acc[seqId] = { name: seqName, items: [] };
      }
      acc[seqId].items.push(item);
      return acc;
    },
    {}
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative select-none"
              disabled={processing}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onContextMenu={(e) => e.preventDefault()}
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
                  ? `Click to process · Long-press to view (${pendingCount} pending)`
                  : 'Process queue'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Queue
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {totalItems} item{totalItems !== 1 ? 's' : ''}
              </span>
            </SheetTitle>
            <SheetDescription>
              Active sequence enrollments ready to send. Click process to send them.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4">
            <Button
              onClick={handleProcess}
              disabled={processing || totalItems === 0}
              className="w-full mb-4"
              size="sm"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Process Queue ({totalItems})
                </>
              )}
            </Button>

            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium">Queue is empty</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No pending items to process right now.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedItems).map(([seqId, group]) => (
                  <div key={seqId} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-1">
                      <Mail className="h-3.5 w-3.5" />
                      {group.name}
                      <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded-full">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {getPersonName(item.person)}
                            </div>
                            {item.person?.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.person.email}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground">
                              Step {item.current_step}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(item.next_send_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {totalItems > items.length && (
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    Showing {items.length} of {totalItems} items
                  </p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
