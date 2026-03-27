'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { GivingHistoryEntry } from '@/lib/validators/community/giving-history';

interface PipelineGrant {
  id: string;
  name: string;
  status: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  application_due_at: string | null;
  award_period_start: string | null;
  award_period_end: string | null;
}

function formatCurrency(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const GRANT_STATUS_LABELS: Record<string, string> = {
  researching: 'Researching', preparing: 'Preparing', submitted: 'Submitted',
  under_review: 'Under Review', awarded: 'Awarded', active: 'Active',
  closed: 'Closed', declined: 'Declined', not_a_fit: 'Not a Fit',
};

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: GivingHistoryEntry | null;
  organizationId: string;
  projectSlug: string;
  onSaved: (entry: GivingHistoryEntry) => void;
}

function EntryDialog({ open, onOpenChange, entry, organizationId, projectSlug, onSaved }: EntryDialogProps) {
  const [grantName, setGrantName] = useState('');
  const [year, setYear] = useState('');
  const [amount, setAmount] = useState('');
  const [programArea, setProgramArea] = useState('');
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGrantName(entry?.grant_name ?? '');
      setYear(entry?.year?.toString() ?? '');
      setAmount(entry?.amount?.toString() ?? '');
      setProgramArea(entry?.program_area ?? '');
      setRecipient(entry?.recipient ?? '');
      setNotes(entry?.notes ?? '');
    }
  }, [open, entry]);

  async function handleSave() {
    if (!grantName.trim()) return;
    setSaving(true);
    try {
      const url = entry
        ? `/api/projects/${projectSlug}/organizations/${organizationId}/giving-history/${entry.id}`
        : `/api/projects/${projectSlug}/organizations/${organizationId}/giving-history`;
      const method = entry ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_name: grantName.trim(),
          year: year ? parseInt(year, 10) : null,
          amount: amount ? parseFloat(amount) : null,
          program_area: programArea.trim() || null,
          recipient: recipient.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      const data = await res.json();
      onSaved(data.entry);
      onOpenChange(false);
      toast.success(entry ? 'Entry updated' : 'Entry added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Grant History' : 'Add Grant History'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Grant Name</Label>
            <Input value={grantName} onChange={(e) => setGrantName(e.target.value)} placeholder="e.g. Community Health Initiative" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2023" min="1900" max="2100" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" min="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Program Area</Label>
            <Input value={programArea} onChange={(e) => setProgramArea(e.target.value)} placeholder="e.g. Education, Health" />
          </div>
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Organization that received the grant" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !grantName.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OrganizationGivingHistoryTabProps {
  organizationId: string;
  projectSlug: string;
}

export function OrganizationGivingHistoryTab({ organizationId, projectSlug }: OrganizationGivingHistoryTabProps) {
  const [pipelineGrants, setPipelineGrants] = useState<PipelineGrant[]>([]);
  const [manualHistory, setManualHistory] = useState<GivingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GivingHistoryEntry | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/organizations/${organizationId}/giving-history`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPipelineGrants(data.pipeline_grants ?? []);
      setManualHistory(data.manual_history ?? []);
    } catch {
      toast.error('Failed to load giving history');
    } finally {
      setLoading(false);
    }
  }, [organizationId, projectSlug]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  async function handleDelete(entry: GivingHistoryEntry) {
    if (!confirm(`Delete "${entry.grant_name}"?`)) return;
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/organizations/${organizationId}/giving-history/${entry.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete');
      setManualHistory((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    }
  }

  function handleSaved(saved: GivingHistoryEntry) {
    setManualHistory((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const hasAnyHistory = pipelineGrants.length > 0 || manualHistory.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Grants Given
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">Grant history for this funder organization</p>
        </div>
        <Button size="sm" onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add History
        </Button>
      </div>

      {!hasAnyHistory ? (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No giving history yet</p>
          <p className="text-sm mt-1">Add manual grant history or link grants from your pipeline as funder</p>
          <Button className="mt-4" onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Entry
          </Button>
        </div>
      ) : (
        <>
          {pipelineGrants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pipeline Grants</h4>
              {pipelineGrants.map((g) => (
                <Card key={g.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.amount_awarded != null ? `Awarded: ${formatCurrency(g.amount_awarded)}` :
                            g.amount_requested != null ? `Requested: ${formatCurrency(g.amount_requested)}` : ''}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {GRANT_STATUS_LABELS[g.status] ?? g.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {manualHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Manual History</h4>
              {manualHistory.map((entry) => (
                <Card key={entry.id}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-medium truncate">{entry.grant_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[
                            entry.year,
                            entry.amount != null ? formatCurrency(entry.amount) : null,
                            entry.recipient,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditingEntry(entry); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(entry)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {entry.notes && (
                    <CardContent className="px-4 pb-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.notes}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        organizationId={organizationId}
        projectSlug={projectSlug}
        onSaved={handleSaved}
      />
    </div>
  );
}
