'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

interface AssetRecord {
  id: string;
  name: string;
}

interface ApprovedAsset {
  id: string;
  person_id: string;
  status: string;
  notes: string | null;
  expires_at: string | null;
  asset: AssetRecord;
}

export function PersonApprovedForTab({ personId }: { personId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [approvedAssets, setApprovedAssets] = useState<ApprovedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const approvalsRes = await fetch(
        `/api/projects/${slug}/people/${personId}/approved-for`
      );
      const approvalsData = await approvalsRes.json().catch(() => ({}));
      if (!approvalsRes.ok) {
        throw new Error(approvalsData.error || 'Failed to load approvals');
      }
      setApprovedAssets(approvalsData.approvals ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load approvals';
      setError(message);
      setApprovedAssets([]);
    } finally {
      setLoading(false);
    }
  }, [slug, personId]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Approved For
        </CardTitle>
        <CardDescription>
          Assets this person is pre-approved to access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchApprovals()}>
              Retry
            </Button>
          </div>
        ) : approvedAssets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            This person is not approved for any assets yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {approvedAssets.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.asset.name}</p>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.expires_at && (
                    <Badge
                      variant={
                        isExpired(item.expires_at)
                          ? 'destructive'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {isExpired(item.expires_at)
                        ? 'Expired'
                        : `Expires ${formatDate(item.expires_at)}`}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {item.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
