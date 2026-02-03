'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, X, CalendarClock, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useUpdateMeetingStatus } from '@/hooks/use-meetings';
import type { MeetingWithRelations, MeetingOutcome } from '@/types/meeting';
import {
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
  MEETING_OUTCOME_LABELS,
  meetingOutcomes,
} from '@/types/meeting';
import { meetingOutcomeValues } from '@/lib/validators/meeting';

interface MeetingStatusActionsProps {
  meeting: MeetingWithRelations;
  projectSlug: string;
  onStatusChange?: () => void;
}

// Schema for the "Mark Attended" form
const attendedFormSchema = z.object({
  outcome: z.enum(meetingOutcomeValues).nullable().optional(),
  outcome_notes: z.string().max(5000).optional(),
  next_steps: z.string().max(5000).optional(),
});

type AttendedFormData = z.infer<typeof attendedFormSchema>;

// Schema for the "Reschedule" form
const rescheduleFormSchema = z.object({
  new_scheduled_at: z.string().min(1, 'New date and time is required'),
});

type RescheduleFormData = z.infer<typeof rescheduleFormSchema>;

// Schema for the "Cancel" form
const cancelFormSchema = z.object({
  cancellation_reason: z.string().max(2000).optional(),
});

type CancelFormData = z.infer<typeof cancelFormSchema>;

export function MeetingStatusActions({
  meeting,
  projectSlug,
  onStatusChange,
}: MeetingStatusActionsProps) {
  const { updateStatus, isUpdating } = useUpdateMeetingStatus(projectSlug);
  const [attendedOpen, setAttendedOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const attendedForm = useForm<AttendedFormData>({
    resolver: zodResolver(attendedFormSchema),
    defaultValues: {
      outcome: null,
      outcome_notes: '',
      next_steps: '',
    },
  });

  const rescheduleForm = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: {
      new_scheduled_at: '',
    },
  });

  const cancelForm = useForm<CancelFormData>({
    resolver: zodResolver(cancelFormSchema),
    defaultValues: {
      cancellation_reason: '',
    },
  });

  // Terminal statuses show a read-only badge
  const terminalStatuses = ['attended', 'no_show', 'cancelled', 'rescheduled'] as const;
  if (terminalStatuses.includes(meeting.status as (typeof terminalStatuses)[number])) {
    return (
      <Badge className={MEETING_STATUS_COLORS[meeting.status]}>
        {MEETING_STATUS_LABELS[meeting.status]}
      </Badge>
    );
  }

  const handleMarkAttended = async (data: AttendedFormData) => {
    try {
      await updateStatus(meeting.id, {
        status: 'attended',
        outcome: data.outcome ?? null,
        outcome_notes: data.outcome_notes || null,
        next_steps: data.next_steps || null,
      });
      toast.success('Meeting marked as attended');
      setAttendedOpen(false);
      attendedForm.reset();
      onStatusChange?.();
    } catch {
      toast.error('Failed to update meeting status');
    }
  };

  const handleNoShow = async () => {
    try {
      await updateStatus(meeting.id, {
        status: 'no_show',
      });
      toast.success('Meeting marked as no show');
      onStatusChange?.();
    } catch {
      toast.error('Failed to update meeting status');
    }
  };

  const handleReschedule = async (data: RescheduleFormData) => {
    try {
      const newScheduledAtISO = new Date(data.new_scheduled_at).toISOString();
      await updateStatus(meeting.id, {
        status: 'rescheduled',
        new_scheduled_at: newScheduledAtISO,
      });
      toast.success('Meeting rescheduled');
      setRescheduleOpen(false);
      rescheduleForm.reset();
      onStatusChange?.();
    } catch {
      toast.error('Failed to reschedule meeting');
    }
  };

  const handleCancel = async (data: CancelFormData) => {
    try {
      await updateStatus(meeting.id, {
        status: 'cancelled',
        cancellation_reason: data.cancellation_reason || null,
      });
      toast.success('Meeting cancelled');
      setCancelOpen(false);
      cancelForm.reset();
      onStatusChange?.();
    } catch {
      toast.error('Failed to cancel meeting');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mark Attended */}
      <Popover open={attendedOpen} onOpenChange={setAttendedOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isUpdating}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Mark Attended
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <form
            onSubmit={attendedForm.handleSubmit(handleMarkAttended)}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="outcome">Outcome</Label>
              <Select
                value={attendedForm.watch('outcome') ?? ''}
                onValueChange={(value) =>
                  attendedForm.setValue('outcome', value as MeetingOutcome)
                }
              >
                <SelectTrigger id="outcome">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {meetingOutcomes.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>
                      {MEETING_OUTCOME_LABELS[outcome]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outcome_notes">Outcome Notes</Label>
              <Textarea
                id="outcome_notes"
                placeholder="What was discussed..."
                className="min-h-[60px]"
                {...attendedForm.register('outcome_notes')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="next_steps">Next Steps</Label>
              <Textarea
                id="next_steps"
                placeholder="Follow-up actions..."
                className="min-h-[60px]"
                {...attendedForm.register('next_steps')}
              />
            </div>

            <Button type="submit" size="sm" className="w-full" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </form>
        </PopoverContent>
      </Popover>

      {/* No Show */}
      <Button
        variant="outline"
        size="sm"
        disabled={isUpdating}
        onClick={handleNoShow}
      >
        <X className="mr-1 h-3.5 w-3.5" />
        No Show
      </Button>

      {/* Reschedule */}
      <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isUpdating}>
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Reschedule
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <form
            onSubmit={rescheduleForm.handleSubmit(handleReschedule)}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new_scheduled_at">New Date & Time</Label>
              <Input
                id="new_scheduled_at"
                type="datetime-local"
                {...rescheduleForm.register('new_scheduled_at')}
              />
              {rescheduleForm.formState.errors.new_scheduled_at && (
                <p className="text-sm text-destructive">
                  {rescheduleForm.formState.errors.new_scheduled_at.message}
                </p>
              )}
            </div>

            <Button type="submit" size="sm" className="w-full" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                'Reschedule'
              )}
            </Button>
          </form>
        </PopoverContent>
      </Popover>

      {/* Cancel */}
      <Popover open={cancelOpen} onOpenChange={setCancelOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isUpdating}>
            <Ban className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <form
            onSubmit={cancelForm.handleSubmit(handleCancel)}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cancellation_reason">Reason (optional)</Label>
              <Textarea
                id="cancellation_reason"
                placeholder="Why is this meeting being cancelled?"
                className="min-h-[60px]"
                {...cancelForm.register('cancellation_reason')}
              />
            </div>

            <Button
              type="submit"
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancel'
              )}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
