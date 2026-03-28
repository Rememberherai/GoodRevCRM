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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';

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

interface AvailableAsset {
  id: string;
  name: string;
}

export function PersonApprovedForTab({ personId }: { personId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [approvedAssets, setApprovedAssets] = useState<ApprovedAsset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const fetchAvailableAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/community-assets?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setAvailableAssets((data.assets ?? []) as AvailableAsset[]);
      }
    } catch {
      // non-critical
    }
  }, [slug]);

  useEffect(() => {
    void fetchApprovals();
    void fetchAvailableAssets();
  }, [fetchApprovals, fetchAvailableAssets]);

  const handleGrantAccess = async () => {
    if (!selectedAssetId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${slug}/people/${personId}/approved-for`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: selectedAssetId,
          notes: notes.trim() || undefined,
          expires_at: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to grant access');
      toast.success('Asset access granted');
      setDialogOpen(false);
      setSelectedAssetId('');
      setNotes('');
      setExpiresAt('');
      await fetchApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  // Filter out assets already approved
  const approvedAssetIds = new Set(approvedAssets.map((a) => a.asset.id));
  const unapprovedAssets = availableAssets.filter((a) => !approvedAssetIds.has(a.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Assets
          </CardTitle>
          <CardDescription>
            Assets this person is approved to access.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Grant Access
        </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Asset Access</DialogTitle>
            <DialogDescription>Approve this person to access a community asset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Asset</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                <option value="">Select an asset...</option>
                {unapprovedAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason for approval..." />
            </div>
            <div className="space-y-2">
              <Label>Expires (optional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleGrantAccess} disabled={isSaving || !selectedAssetId}>
              {isSaving ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
