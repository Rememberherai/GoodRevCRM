'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckSquare,
  Linkedin,
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_TYPE_OUTCOMES,
  OUTCOME_LABELS,
} from '@/types/activity';
import type { ActivityType, ActivityOutcome } from '@/types/activity';
import { logActivitySchema } from '@/lib/validators/activity';

type LogActivityFormData = z.infer<typeof logActivitySchema>;

const MANUAL_ACTIVITY_TYPES: {
  value: ActivityType;
  label: string;
  icon: typeof Phone;
  color: string;
}[] = [
  { value: 'call', label: 'Call', icon: Phone, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { value: 'note', label: 'Note', icon: StickyNote, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  { value: 'task', label: 'Task', icon: CheckSquare, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
];

interface LogActivityModalProps {
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

export function LogActivityModal({
  open,
  onOpenChange,
  projectSlug,
  personId,
  personName,
  organizationId,
  organizationName: _organizationName,
  opportunityId,
  rfpId,
  onSuccess,
}: LogActivityModalProps) {
  const [saving, setSaving] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const form = useForm<LogActivityFormData>({
    resolver: zodResolver(logActivitySchema),
    defaultValues: {
      activity_type: 'call',
      person_id: personId ?? '',
      organization_id: organizationId ?? null,
      opportunity_id: opportunityId ?? null,
      rfp_id: rfpId ?? null,
      subject: '',
      notes: '',
      outcome: null,
      direction: null,
      duration_minutes: null,
      follow_up_date: null,
      follow_up_title: null,
    },
  });

  const activityType = form.watch('activity_type');
  const subject = form.watch('subject');

  useEffect(() => {
    if (open) {
      form.reset({
        activity_type: 'call',
        person_id: personId ?? '',
        organization_id: organizationId ?? null,
        opportunity_id: opportunityId ?? null,
        rfp_id: rfpId ?? null,
        subject: '',
        notes: '',
        outcome: null,
        direction: null,
        duration_minutes: null,
        follow_up_date: null,
        follow_up_title: null,
      });
      setShowFollowUp(false);
    }
  }, [open, form, personId, organizationId, opportunityId, rfpId]);

  // Reset outcome when activity type changes (since valid outcomes differ)
  useEffect(() => {
    form.setValue('outcome', null);
    // Reset direction when switching away from call/email/linkedin
    if (activityType !== 'call' && activityType !== 'email' && activityType !== 'linkedin') {
      form.setValue('direction', null);
    }
    // Reset duration when switching away from call/meeting
    if (activityType !== 'call' && activityType !== 'meeting') {
      form.setValue('duration_minutes', null);
    }
  }, [activityType, form]);

  const availableOutcomes = ACTIVITY_TYPE_OUTCOMES[activityType] ?? [];
  const showDirection = activityType === 'call' || activityType === 'email' || activityType === 'linkedin';
  const showDuration = activityType === 'call' || activityType === 'meeting';

  const onSubmit = async (data: LogActivityFormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...data,
        person_id: personId ?? data.person_id,
        organization_id: organizationId ?? data.organization_id ?? null,
        opportunity_id: opportunityId ?? data.opportunity_id ?? null,
        rfp_id: rfpId ?? data.rfp_id ?? null,
      };

      // Handle follow-up: convert date string to ISO datetime
      if (showFollowUp && data.follow_up_date) {
        payload.follow_up_date = new Date(data.follow_up_date).toISOString();
        payload.follow_up_title = data.follow_up_title || `Follow up: ${data.subject}`;
      } else {
        payload.follow_up_date = null;
        payload.follow_up_title = null;
      }

      const response = await fetch(`/api/projects/${projectSlug}/activity/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to log activity');
      }

      toast.success('Activity logged successfully');
      form.reset();
      setShowFollowUp(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription>Record a CRM activity for tracking</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Activity Type Selector */}
            <FormField
              control={form.control}
              name="activity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      {MANUAL_ACTIVITY_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isSelected = field.value === type.value;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => field.onChange(type.value)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                              isSelected
                                ? cn(type.color, 'border-transparent')
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Person Selector */}
            <FormField
              control={form.control}
              name="person_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Person *</FormLabel>
                  <FormControl>
                    {personId ? (
                      <Input
                        value={personName ?? 'Selected person'}
                        disabled
                      />
                    ) : (
                      <div>
                        <Input
                          placeholder="Person ID"
                          {...field}
                          value={field.value ?? ''}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          (search coming soon)
                        </p>
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter activity subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Outcome */}
            {availableOutcomes.length > 0 && (
              <FormField
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val as ActivityOutcome)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableOutcomes.map((outcome) => (
                          <SelectItem key={outcome} value={outcome}>
                            {OUTCOME_LABELS[outcome]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Direction and Duration row */}
            {(showDirection || showDuration) && (
              <div className="grid grid-cols-2 gap-4">
                {showDirection && (
                  <FormField
                    control={form.control}
                    name="direction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direction</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select direction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showDuration && (
                  <FormField
                    control={form.control}
                    name="duration_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={1440}
                            placeholder="0"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value, 10) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add notes about this activity..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Follow-up Section */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="follow-up-toggle"
                  checked={showFollowUp}
                  onCheckedChange={(checked) => {
                    setShowFollowUp(checked === true);
                    if (!checked) {
                      form.setValue('follow_up_date', null);
                      form.setValue('follow_up_title', null);
                    }
                  }}
                />
                <label
                  htmlFor="follow-up-toggle"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Schedule follow-up
                </label>
              </div>

              {showFollowUp && (
                <div className="space-y-3 pt-1">
                  <FormField
                    control={form.control}
                    name="follow_up_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={
                              field.value
                                ? field.value.substring(0, 10)
                                : ''
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="follow_up_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`Follow up: ${subject || '...'}`}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-xs text-muted-foreground">
                    A task will be automatically created
                  </p>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
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
                    Logging...
                  </>
                ) : (
                  'Log Activity'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
