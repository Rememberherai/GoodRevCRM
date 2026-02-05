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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll the recording endpoint after a call ends to fetch the recording URL
  // from the Telnyx API and save it to the DB. Runs in the background.
  const pollForRecording = useCallback((projectSlug: string, callId: string) => {
    let attempts = 0;
    const maxAttempts = 6; // 60 seconds at 10s intervals

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/projects/${projectSlug}/calls/${callId}/recording`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.recording_url) {
          // Recording found, stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
      } catch {
        // Silently fail
      }

      if (attempts >= maxAttempts && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    // Clear any previous polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Start after a delay (recording needs time to process)
    setTimeout(() => {
      poll(); // First attempt immediately
      pollingRef.current = setInterval(poll, 10000);
    }, 5000);
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
    if (!pollingRef.current && slug && lastEndedCallId) {
      pollForRecording(slug, lastEndedCallId);
    }
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
