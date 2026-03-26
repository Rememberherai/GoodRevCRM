'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NewGrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'declined', label: 'Declined' },
];

const CATEGORIES = [
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'individual', label: 'Individual' },
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function NewGrantDialog({ open, onOpenChange, onCreated }: NewGrantDialogProps) {
  const { slug } = useParams<{ slug: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('researching');
  const [category, setCategory] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [loiDueAt, setLoiDueAt] = useState('');
  const [applicationDueAt, setApplicationDueAt] = useState('');
  const [tier, setTier] = useState('');
  const [urgency, setUrgency] = useState('');
  const [missionFit, setMissionFit] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName('');
    setStatus('researching');
    setCategory('');
    setAmountRequested('');
    setLoiDueAt('');
    setApplicationDueAt('');
    setTier('');
    setUrgency('');
    setMissionFit('');
    setNotes('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name,
        status,
      };
      if (amountRequested) body.amount_requested = parseFloat(amountRequested);
      if (loiDueAt) body.loi_due_at = loiDueAt;
      if (applicationDueAt) body.application_due_at = applicationDueAt;
      if (category) body.category = category;
      if (tier) body.tier = parseInt(tier, 10);
      if (urgency) body.urgency = urgency;
      if (missionFit) body.mission_fit = parseInt(missionFit, 10);
      if (notes) body.notes = notes;

      const res = await fetch(`/api/projects/${slug}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create grant');

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create grant');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Grant</DialogTitle>
          <DialogDescription>
            Track a new grant opportunity through the pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="grant-name">Grant Name *</Label>
            <Input
              id="grant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Community Development Block Grant"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grant-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="grant-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category || '__none__'} onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-amount">Amount Requested</Label>
              <Input
                id="grant-amount"
                type="number"
                min="0"
                step="0.01"
                value={amountRequested}
                onChange={(e) => setAmountRequested(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier || '__none__'} onValueChange={(v) => setTier(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="1">Tier 1 — Top Priority</SelectItem>
                  <SelectItem value="2">Tier 2 — Strong Fit</SelectItem>
                  <SelectItem value="3">Tier 3 — Worth Watching</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency || '__none__'} onValueChange={(v) => setUrgency(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {URGENCY_LEVELS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mission Fit</Label>
              <div className="flex items-center gap-1 h-9 px-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="p-0.5"
                    onClick={() => setMissionFit(missionFit === n.toString() ? '' : n.toString())}
                  >
                    <Star className={`h-5 w-5 ${(Number(missionFit) || 0) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grant-loi">LOI Deadline</Label>
              <Input
                id="grant-loi"
                type="date"
                value={loiDueAt}
                onChange={(e) => setLoiDueAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-app-deadline">Application Deadline</Label>
              <Input
                id="grant-app-deadline"
                type="date"
                value={applicationDueAt}
                onChange={(e) => setApplicationDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-notes">Notes</Label>
            <Textarea
              id="grant-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Requirements, eligibility, contacts..."
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Grant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
