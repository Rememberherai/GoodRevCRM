'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, RotateCcw } from 'lucide-react';

interface CommunityAsset { id: string; name: string; access_mode: string; return_required: boolean }
interface EventType { id: string; title: string; asset_id: string; duration_minutes: number; community_assets: CommunityAsset }
interface AccessRequest {
  id: string; status: string; start_at: string; end_at: string;
  invitee_name: string; invitee_email: string; created_at: string; event_types: EventType;
}
interface RequestsResponse { requests: AccessRequest[]; nextCursor?: string; total: number }

const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AssetAccessQueue({ initialFilter }: { initialFilter?: string }) {
  const params = useParams();
  const slug = params.slug as string;

  const overdueOnly = initialFilter === 'overdue';
  const [statusFilter, setStatusFilter] = useState(overdueOnly ? 'confirmed' : (initialFilter ?? 'all'));
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all' && !overdueOnly) params.set('status', statusFilter);
      if (overdueOnly) params.set('overdue', 'true');
      if (cursor) params.set('cursor', cursor);

      const qs = params.toString();
      const res = await fetch(
        `/api/projects/${slug}/community-assets/requests${qs ? `?${qs}` : ''}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load requests');
      }
      return data as RequestsResponse;
    },
    [slug, statusFilter, overdueOnly]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRequests();
      setRequests(data.requests);
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load access requests';
      setError(message);
      setRequests([]);
      setNextCursor(undefined);
      setTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [fetchRequests]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const data = await fetchRequests(nextCursor);
      setRequests((prev) => [...prev, ...data.requests]);
      setNextCursor(data.nextCursor);
    } catch {
      toast.error('Failed to load more requests');
    }
  }

  async function handleReview(id: string, action: 'approve' | 'deny') {
    setActioning(id);
    try {
      const res = await fetch(
        `/api/projects/${slug}/community-assets/requests/${id}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Review failed');
      }
      toast.success(action === 'approve' ? 'Request approved' : 'Request denied');
      await loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioning(null);
    }
  }

  async function handleReturn(id: string) {
    setActioning(id);
    try {
      const res = await fetch(
        `/api/projects/${slug}/community-assets/requests/${id}/return`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Return failed');
      }
      toast.success('Marked as returned');
      await loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status filter buttons */}
      <div className="flex flex-wrap gap-2">
        {!overdueOnly && STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
        {overdueOnly && (
          <Badge variant="outline" className="px-3 py-1 text-xs">
            Overdue Returns
          </Badge>
        )}
        {total > 0 && (
          <span className="ml-2 self-center text-sm text-muted-foreground">
            {total} total
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && requests.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        error ? (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <div className="text-sm text-destructive">{error}</div>
            <div>
              <Button variant="outline" size="sm" onClick={() => void loadRequests()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {overdueOnly
              ? 'No overdue asset returns found.'
              : `No access requests found${statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.`}
          </div>
        )
      )}

      {/* Request list */}
      {requests.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          <div className="hidden grid-cols-[1.5fr_1.5fr_1.2fr_0.8fr_auto] gap-3 px-3 text-xs font-medium uppercase text-muted-foreground md:grid">
            <div>Asset</div>
            <div>Invitee</div>
            <div>Requested Time</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {requests.map((req) => {
            const asset = req.event_types?.community_assets;
            const isPending = req.status === 'pending';
            const isConfirmedLoanable =
              req.status === 'confirmed' &&
              (asset?.access_mode === 'loanable' || asset?.access_mode === 'hybrid') &&
              asset?.return_required;
            const isActioning = actioning === req.id;

            return (
              <div
                key={req.id}
                className="grid grid-cols-1 gap-2 rounded-lg border p-3 text-sm md:grid-cols-[1.5fr_1.5fr_1.2fr_0.8fr_auto] md:items-center md:gap-3"
              >
                <div className="font-medium">{asset?.name ?? 'Unknown asset'}</div>
                <div>
                  <div>{req.invitee_name}</div>
                  <div className="text-xs text-muted-foreground">{req.invitee_email}</div>
                </div>
                <div className="text-muted-foreground">
                  {formatTime(req.start_at)}
                  {req.end_at && (
                    <span className="text-xs"> &ndash; {formatTime(req.end_at)}</span>
                  )}
                </div>
                <div>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[req.status] ?? ''}
                  >
                    {req.status}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActioning}
                        onClick={() => void handleReview(req.id, 'approve')}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActioning}
                        onClick={() => void handleReview(req.id, 'deny')}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Deny
                      </Button>
                    </>
                  )}
                  {isConfirmedLoanable && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isActioning}
                      onClick={() => void handleReturn(req.id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Mark Returned
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => void loadMore()}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
