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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';

interface ApprovedPerson {
  id: string;
  person_id: string;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export function ApprovedPeopleTab({ assetId }: { assetId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [approvals, setApprovals] = useState<ApprovedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [personId, setPersonId] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const basePath = `/api/projects/${slug}/community-assets/${assetId}/approved-people`;

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(basePath);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to fetch approved people');
      setApprovals(data.approvals ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load approved people';
      setError(message);
      setApprovals([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const handleAdd = async () => {
    if (!personId.trim()) {
      toast.error('Person ID is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId.trim(),
          notes: notes.trim() || null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add approved person');
      }
      toast.success('Person approved successfully');
      setDialogOpen(false);
      setPersonId('');
      setNotes('');
      setExpiresAt('');
      void fetchApprovals();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add approved person');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (approvalId: string) => {
    try {
      const res = await fetch(`${basePath}/${approvalId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke approval');
      toast.success('Approval revoked');
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } catch {
      toast.error('Failed to revoke approval');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const personName = (p: ApprovedPerson['person']) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
    return name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Approved People
            </CardTitle>
            <CardDescription>
              People pre-approved to use this asset without review.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Person
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchApprovals()}>
              Retry
            </Button>
          </div>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved people yet.</p>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{personName(a.person)}</p>
                  {a.person.email && (
                    <p className="text-xs text-muted-foreground">{a.person.email}</p>
                  )}
                  {a.notes && (
                    <p className="text-xs text-muted-foreground">{a.notes}</p>
                  )}
                  {a.expires_at && (
                    <Badge variant="outline" className="text-xs">
                      Expires {formatDate(a.expires_at)}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevoke(a.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Approved Person</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="person-id">Person ID</Label>
              <Input
                id="person-id"
                placeholder="UUID of the person"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notes (optional)</Label>
              <Input
                id="approval-notes"
                placeholder="Reason for approval"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expires At (optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
