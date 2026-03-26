'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface JobOption {
  id: string;
  title: string;
}

export interface LogTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  contractorPersonId: string;
  prefilledJobId?: string;
  mode: 'portal' | 'admin';
  onCreated: () => void;
}

const ACTIVE_STATUSES = ['assigned', 'accepted', 'in_progress', 'paused'];

export function LogTimeDialog({
  open,
  onOpenChange,
  projectSlug,
  contractorPersonId,
  prefilledJobId,
  mode,
  onCreated,
}: LogTimeDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [jobId, setJobId] = useState<string | null>(prefilledJobId ?? null);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load jobs when dialog opens
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (mode === 'portal') params.set('contractorId', contractorPersonId);
        const response = await fetch(`/api/projects/${projectSlug}/jobs?${params}`);
        const data = await response.json() as { jobs?: Array<{ id: string; title: string; status: string }> };
        const filtered = (data.jobs ?? []).filter((job) => ACTIVE_STATUSES.includes(job.status));
        setJobs(filtered);
      } catch {
        // Non-fatal — jobs dropdown will just be empty
      }
    })();
  }, [open, projectSlug, contractorPersonId, mode]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime('09:00');
      setEndTime('10:00');
      setJobId(prefilledJobId ?? null);
      setCategory('');
      setNotes('');
    }
  }, [open, prefilledJobId]);

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Date is required');
      return;
    }
    if (!startTime || !endTime) {
      toast.error('Start and end times are required');
      return;
    }

    const startedAt = new Date(`${date}T${startTime}:00`).toISOString();
    const endedAt = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(endedAt) <= new Date(startedAt)) {
      toast.error('End time must be after start time');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorPersonId,
          job_id: jobId ?? null,
          started_at: startedAt,
          ended_at: endedAt,
          is_break: false,
          category: category.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to log time');
      toast.success('Time entry logged');
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log time');
    } finally {
      setSubmitting(false);
    }
  };

  const showWarning = !jobId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>

        {showWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This entry won&apos;t be linked to any job. It will appear in your timesheet but won&apos;t affect job status or completion.
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="log-date">Date</Label>
            <Input
              id="log-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="log-start">Start Time</Label>
              <Input
                id="log-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-end">End Time</Label>
              <Input
                id="log-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-job">Job (optional)</Label>
            <Select
              value={jobId ?? '__none__'}
              onValueChange={(val) => setJobId(val === '__none__' ? null : val)}
            >
              <SelectTrigger id="log-job">
                <SelectValue placeholder="No job selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No job</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-category">Category (optional)</Label>
            <Input
              id="log-category"
              value={category}
              onChange={(e) => setCategory(e.target.value.slice(0, 100))}
              placeholder="e.g. Admin, Travel, Training"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-notes">Notes (optional)</Label>
            <Textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Any additional details"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Log Time'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
