'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useCallStore, emitDispositionSaved } from '@/stores/call';
import { DISPOSITION_LABELS } from '@/types/call';
import type { CallDisposition } from '@/types/call';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const dispositions = Object.entries(DISPOSITION_LABELS) as [CallDisposition, string][];

export function CallDispositionModal() {
  const params = useParams();
  const slug = params?.slug as string;
  const { showDispositionModal, lastEndedCallId, currentCallRecord, closeDispositionModal } = useCallStore();

  const [disposition, setDisposition] = useState<CallDisposition | ''>('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pollingStartedRef = useRef(false);

  // Poll the recording endpoint after a call ends to fetch the recording URL
  // from the Telnyx API and save it to the DB. Runs in the background.
  const pollForRecording = useCallback((projectSlug: string, callId: string) => {
    if (pollingStartedRef.current) return; // Already started
    pollingStartedRef.current = true;

    let attempts = 0;
    const maxAttempts = 6; // 60 seconds at 10s intervals

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/projects/${projectSlug}/calls/${callId}/recording`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.recording_url) {
          return true; // Found - stop polling
        }
      } catch {
        // Silently fail
      }
      return false;
    };

    // Start after 5s delay (recording needs time to process), then retry every 10s
    const run = async () => {
      await new Promise((r) => setTimeout(r, 5000));
      for (let i = 0; i < maxAttempts; i++) {
        const found = await poll();
        if (found) return;
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
    };

    run();
  }, []);

  const handleSave = async () => {
    if (!disposition || !lastEndedCallId) return;

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        disposition,
        disposition_notes: notes || null,
      };

      if (followUpDate) {
        body.follow_up_date = new Date(followUpDate).toISOString();
        body.follow_up_title = followUpTitle || `Follow up: ${DISPOSITION_LABELS[disposition]}`;
      }

      const res = await fetch(`/api/projects/${slug}/calls/${lastEndedCallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Failed to save disposition');
      }

      toast.success('Call disposition saved');
      // Emit event to refresh activity lists
      emitDispositionSaved(currentCallRecord?.person_id ?? null);

      // Start polling for recording in the background
      // (Telnyx recordings may not be available immediately after call ends)
      if (slug && lastEndedCallId) {
        pollForRecording(slug, lastEndedCallId);
      }

      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save disposition');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // If we haven't started polling yet (user skipped disposition), start it now
    if (slug && lastEndedCallId) {
      pollForRecording(slug, lastEndedCallId);
    }
    pollingStartedRef.current = false; // Reset for next call
    setDisposition('');
    setNotes('');
    setFollowUpDate('');
    setFollowUpTitle('');
    closeDispositionModal();
  };

  return (
    <Dialog open={showDispositionModal} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call Disposition</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select
              value={disposition}
              onValueChange={(v) => setDisposition(v as CallDisposition)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select disposition..." />
              </SelectTrigger>
              <SelectContent>
                {dispositions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes..."
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Follow-up Date (optional)</Label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>

          {followUpDate && (
            <div className="space-y-2">
              <Label>Follow-up Task Title</Label>
              <Input
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                placeholder="e.g., Follow up on call"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={!disposition || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
