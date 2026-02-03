'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  meetingTypeValues,
} from '@/lib/validators/meeting';
import { MEETING_TYPE_LABELS } from '@/types/meeting';

// Form schema: createMeetingSchema minus attendee arrays for v1
const bookMeetingFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  meeting_type: z.enum(meetingTypeValues),
  scheduled_at: z.string().min(1, 'Date and time is required'),
  duration_minutes: z.number().int().min(5).max(480),
  location: z.string().max(500).optional(),
  meeting_url: z.string().max(2000).optional(),
  description: z.string().max(5000).optional(),
});

type BookMeetingFormData = z.infer<typeof bookMeetingFormSchema>;

interface BookMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  personId?: string;
  personName?: string;
  organizationId?: string;
  organizationName?: string;
  opportunityId?: string;
  rfpId?: string;
  onSuccess?: () => void;
}

export function BookMeetingModal({
  open,
  onOpenChange,
  projectSlug,
  personId,
  personName,
  organizationId,
  organizationName,
  opportunityId,
  rfpId,
  onSuccess,
}: BookMeetingModalProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<BookMeetingFormData>({
    resolver: zodResolver(bookMeetingFormSchema),
    defaultValues: {
      title: '',
      meeting_type: 'general',
      scheduled_at: '',
      duration_minutes: 30,
      location: '',
      meeting_url: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: '',
        meeting_type: 'general',
        scheduled_at: '',
        duration_minutes: 30,
        location: '',
        meeting_url: '',
        description: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (data: BookMeetingFormData) => {
    setSaving(true);
    try {
      // Convert datetime-local value to ISO string
      const scheduledAtISO = new Date(data.scheduled_at).toISOString();

      const response = await fetch(`/api/projects/${projectSlug}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          meeting_type: data.meeting_type,
          scheduled_at: scheduledAtISO,
          duration_minutes: data.duration_minutes,
          location: data.location || null,
          meeting_url: data.meeting_url || null,
          description: data.description || null,
          person_id: personId || null,
          organization_id: organizationId || null,
          opportunity_id: opportunityId || null,
          rfp_id: rfpId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to book meeting');
      }

      toast.success('Meeting booked successfully');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to book meeting');
    } finally {
      setSaving(false);
    }
  };

  const contextLabel = personName
    ? `with ${personName}`
    : organizationName
      ? `with ${organizationName}`
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Book Meeting</DialogTitle>
          <DialogDescription>
            Schedule a new meeting{contextLabel ? ` ${contextLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter meeting title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meeting_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {meetingTypeValues.map((type) => (
                        <SelectItem key={type} value={type}>
                          {MEETING_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={480}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Office, conference room, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meeting_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://zoom.us/j/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Agenda, talking points, notes..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Book Meeting'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
