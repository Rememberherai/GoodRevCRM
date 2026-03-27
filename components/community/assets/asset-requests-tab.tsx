'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, RotateCcw, Clock } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface EventType {
  id: string;
  title: string;
  asset_id: string;
  duration_minutes: number;
  community_assets: {
    id: string;
    name: string;
    access_mode: string;
    return_required: boolean;
  };
}

interface BookingRequest {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string | null;
  created_at: string;
  event_types: EventType;
}

interface AssetRequestsTabProps {
  assetId: string;
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const statusBadgeColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function needsReturn(req: BookingRequest) {
  const mode = req.event_types?.community_assets?.access_mode;
  const returnRequired = req.event_types?.community_assets?.return_required;
  return (mode === 'loanable' || mode === 'hybrid') && returnRequired;
}

export function AssetRequestsTab({ assetId }: AssetRequestsTabProps) {
  const { slug } = useParams<{ slug: string }>();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const apiBase = `/api/projects/${slug}/community-assets`;

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/requests?asset_id=${assetId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load requests');
      }
      setRequests(data.requests ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load requests';
      setError(message);
      setRequests([]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, assetId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function handleReview(bookingId: string, action: 'approve' | 'deny') {
    setActionInProgress(bookingId);
    try {
      const res = await fetch(`${apiBase}/requests/${bookingId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(action === 'approve' ? 'Request approved' : 'Request denied');
      void loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update request');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleMarkReturned(bookingId: string) {
    setActionInProgress(bookingId);
    try {
      const res = await fetch(`${apiBase}/requests/${bookingId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Marked as returned');
      void loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as returned');
    } finally {
      setActionInProgress(null);
    }
  }

  const filtered =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Requests</CardTitle>
        <CardDescription>Booking requests for this asset.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1 mb-4">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadRequests()}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all'
                ? 'No booking requests yet.'
                : `No ${statusFilter} requests.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Name</th>
                  <th className="px-2 py-2 text-left font-medium">Email</th>
                  <th className="px-2 py-2 text-left font-medium">Event Type</th>
                  <th className="px-2 py-2 text-left font-medium">Start</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{req.invitee_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{req.invitee_email}</td>
                    <td className="px-2 py-2">{req.event_types?.title ?? '-'}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {formatDate(req.start_at)}
                    </td>
                    <td className="px-2 py-2">
                      <Badge
                        variant="secondary"
                        className={statusBadgeColor[req.status] ?? ''}
                      >
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {req.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              disabled={actionInProgress === req.id}
                              onClick={() => handleReview(req.id, 'approve')}
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive"
                              disabled={actionInProgress === req.id}
                              onClick={() => handleReview(req.id, 'deny')}
                            >
                              <X className="h-3 w-3" />
                              Deny
                            </Button>
                          </>
                        )}
                        {req.status === 'confirmed' && needsReturn(req) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={actionInProgress === req.id}
                            onClick={() => handleMarkReturned(req.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Mark Returned
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
