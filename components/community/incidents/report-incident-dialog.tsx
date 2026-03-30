'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  initialHouseholdId?: string | null;
  initialEventId?: string | null;
  initialAssetId?: string | null;
  initialPersonId?: string | null;
  showVisibilitySelector?: boolean;
  onCreated?: (incidentId: string) => void;
}

const DEFAULT_FORM = {
  occurred_at: '',
  summary: '',
  details: '',
  severity: 'medium',
  category: 'other',
  visibility: 'operations',
  follow_up_due_at: '',
  location_text: '',
};

export function ReportIncidentDialog({
  open,
  onOpenChange,
  projectSlug,
  initialHouseholdId,
  initialEventId,
  initialAssetId,
  initialPersonId,
  showVisibilitySelector = true,
  onCreated,
}: ReportIncidentDialogProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...DEFAULT_FORM,
      occurred_at: new Date().toISOString().slice(0, 16),
    });
  }, [open]);

  async function handleSubmit() {
    if (!form.summary.trim() || !form.occurred_at) {
      toast.error('Occurred at and summary are required');
      return;
    }

    setSaving(true);
    try {
      const incidentRes = await fetch(`/api/projects/${projectSlug}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurred_at: new Date(form.occurred_at).toISOString(),
          summary: form.summary.trim(),
          details: form.details.trim() || undefined,
          severity: form.severity,
          category: form.category,
          visibility: showVisibilitySelector ? form.visibility : 'operations',
          follow_up_due_at: form.follow_up_due_at ? new Date(form.follow_up_due_at).toISOString() : undefined,
          location_text: form.location_text.trim() || undefined,
          household_id: initialHouseholdId ?? undefined,
          event_id: initialEventId ?? undefined,
          asset_id: initialAssetId ?? undefined,
        }),
      });

      const incidentData = await incidentRes.json();
      if (!incidentRes.ok) {
        throw new Error(incidentData.error ?? 'Failed to create incident');
      }

      const incidentId = incidentData.incident?.id as string | undefined;
      if (!incidentId) {
        throw new Error('Incident created without an ID');
      }

      if (initialPersonId) {
        const personRes = await fetch(`/api/projects/${projectSlug}/incidents/${incidentId}/people`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_id: initialPersonId,
            role: 'subject',
          }),
        });

        if (!personRes.ok) {
          toast.warning('Incident created, but the linked person could not be attached automatically');
        }
      }

      toast.success('Incident reported');
      onOpenChange(false);
      onCreated?.(incidentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to report incident');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>
            Capture what happened, who was involved, and what follow-up is needed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="occurred_at">Occurred At</Label>
            <Input
              id="occurred_at"
              type="datetime-local"
              value={form.occurred_at}
              onChange={(event) => setForm((current) => ({ ...current, occurred_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="follow_up_due_at">Follow-Up Due</Label>
            <Input
              id="follow_up_due_at"
              type="datetime-local"
              value={form.follow_up_due_at}
              onChange={(event) => setForm((current) => ({ ...current, follow_up_due_at: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary">Summary</Label>
          <Input
            id="summary"
            value={form.summary}
            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            placeholder="What happened?"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={form.severity} onValueChange={(value) => setForm((current) => ({ ...current, severity: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="behavior">Behavior</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="injury">Injury</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="conflict">Conflict</SelectItem>
                <SelectItem value="theft">Theft</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            {showVisibilitySelector ? (
              <Select value={form.visibility} onValueChange={(value) => setForm((current) => ({ ...current, visibility: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="case_management">Case Management</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value="Operations" disabled />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location_text">Location</Label>
          <Input
            id="location_text"
            value={form.location_text}
            onChange={(event) => setForm((current) => ({ ...current, location_text: event.target.value }))}
            placeholder="Optional location details"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="details">Details</Label>
          <Textarea
            id="details"
            rows={6}
            value={form.details}
            onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
            placeholder="Add the full narrative, context, and immediate follow-up."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
