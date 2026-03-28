'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Loader2, Clock, Mail, Trash2, CheckSquare, XSquare } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'selected' | 'all' | null>(null);

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

  // Load items when sheet opens, clear selection
  useEffect(() => {
    if (sheetOpen) {
      fetchItems();
      setSelectedIds(new Set());
    }
  }, [sheetOpen, fetchItems]);

  const refreshAfterChange = () => {
    fetchCount();
    fetchItems();
    setSelectedIds(new Set());
  };

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
      refreshAfterChange();
    }
  };

  const handleCancel = async (mode: 'selected' | 'all') => {
    setCancelling(true);
    try {
      const body: { ids?: string[]; all?: boolean; disposition: string } =
        mode === 'all'
          ? { all: true, disposition: 'cancelled' }
          : { ids: Array.from(selectedIds), disposition: 'cancelled' };

      const res = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Removed ${data.cancelled} enrollment${data.cancelled !== 1 ? 's' : ''} from queue`);
      } else {
        toast.error('Failed to remove from queue');
      }
    } catch {
      toast.error('Failed to remove from queue');
    } finally {
      setCancelling(false);
      setConfirmDialog(null);
      refreshAfterChange();
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

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

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
              Active sequence enrollments ready to send.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4 space-y-3">
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={processing || cancelling || totalItems === 0}
                className="flex-1"
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
                    Process ({totalItems})
                  </>
                )}
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancelling || processing}
                  onClick={() => setConfirmDialog('selected')}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove ({selectedIds.size})
                </Button>
              )}
            </div>

            {/* Select toolbar */}
            {items.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={allSelected ? selectNone : selectAll}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {allSelected ? (
                    <XSquare className="h-3.5 w-3.5" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  onClick={() => setConfirmDialog('all')}
                  disabled={cancelling || processing || totalItems === 0}
                  className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove all ({totalItems})
                </button>
              </div>
            )}

            {/* Items list */}
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
                          className={cn(
                            'flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm cursor-pointer transition-colors',
                            selectedIds.has(item.id) && 'bg-muted/70'
                          )}
                          onClick={() => toggleSelect(item.id)}
                        >
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="shrink-0"
                          />
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

      {/* Confirmation dialog */}
      <AlertDialog open={confirmDialog !== null} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog === 'all'
                ? `Remove all ${totalItems} items from queue?`
                : `Remove ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} from queue?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the selected enrollments. They will be logged as
              cancelled on each contact&apos;s timeline. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDialog) handleCancel(confirmDialog);
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove from queue'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
