'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { createProgramSchema } from '@/lib/validators/community/programs';

interface DimensionOption {
  id: string;
  label: string;
  color: string | null;
}

function buildSchedulePayload(
  summary: string,
  startDate: string,
  sessionStartTime: string,
  sessionEndTime: string,
) {
  const hasSummary = summary.trim().length > 0;
  const hasTimes = sessionStartTime && sessionEndTime && startDate;

  if (!hasSummary && !hasTimes) return null;

  const schedule: Record<string, string> = {};
  if (hasSummary) schedule.summary = summary.trim();
  if (hasTimes) {
    schedule.session_start = `${startDate}T${sessionStartTime}:00`;
    schedule.session_end = `${startDate}T${sessionEndTime}:00`;
  }
  return schedule;
}

export function NewProgramDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'planning' | 'active' | 'completed' | 'suspended'>('planning');
  const [capacity, setCapacity] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState('');
  const [sessionEndTime, setSessionEndTime] = useState('');
  const [requiresWaiver, setRequiresWaiver] = useState(false);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/impact-dimensions`);
        const data = await response.json() as { dimensions?: DimensionOption[] };
        if (active && response.ok) {
          setDimensions(data.dimensions ?? []);
        }
      } catch (error) {
        console.error('Failed to load impact dimensions:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, slug]);

  const reset = () => {
    setName('');
    setDescription('');
    setStatus('planning');
    setCapacity('');
    setLocationName('');
    setStartDate('');
    setEndDate('');
    setScheduleText('');
    setSessionStartTime('');
    setSessionEndTime('');
    setRequiresWaiver(false);
    setSelectedDimensions([]);
  };

  const toggleDimension = (id: string, checked: boolean) => {
    setSelectedDimensions((current) => (
      checked ? [...current, id] : current.filter((value) => value !== id)
    ));
  };

  const handleSubmit = async () => {
    const payload = {
      name,
      description: description || null,
      status,
      capacity: capacity ? Number(capacity) : null,
      location_name: locationName || null,
      start_date: startDate || null,
      end_date: endDate || null,
      target_dimensions: selectedDimensions,
      schedule: buildSchedulePayload(scheduleText, startDate, sessionStartTime, sessionEndTime),
      requires_waiver: requiresWaiver,
    };

    const validation = createProgramSchema.safeParse(payload);
    if (!validation.success) {
      toast.error('Check the program fields and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create program');
      }

      toast.success('Program created');
      onOpenChange(false);
      reset();
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create program');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Program</DialogTitle>
          <DialogDescription>
            Define the schedule, target dimensions, capacity, and waiver requirement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="program-name">Program Name</Label>
            <Input id="program-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Digital Literacy for Seniors" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="program-description">Description</Label>
            <Textarea id="program-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the program, audience, and expected impact." />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value: typeof status) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-capacity">Capacity</Label>
            <Input id="program-capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} inputMode="numeric" placeholder="25" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-start">Start Date</Label>
            <Input id="program-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-end">End Date</Label>
            <Input id="program-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="program-location">Location</Label>
            <Input id="program-location" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Community Room A" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="program-schedule">Schedule Summary</Label>
            <Input id="program-schedule" value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} placeholder="Tuesdays 6-8pm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-session-start">Session Start Time</Label>
            <Input id="program-session-start" type="time" value={sessionStartTime} onChange={(event) => setSessionStartTime(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-session-end">Session End Time</Label>
            <Input id="program-session-end" type="time" value={sessionEndTime} onChange={(event) => setSessionEndTime(event.target.value)} />
          </div>
          {sessionStartTime && sessionEndTime && !startDate && (
            <div className="sm:col-span-2 text-sm text-amber-600">
              Set a Start Date above so session times can sync to Google Calendar.
            </div>
          )}
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Requires waiver</div>
              <div className="text-sm text-muted-foreground">Enrollments will start with a pending waiver status.</div>
            </div>
            <Switch checked={requiresWaiver} onCheckedChange={setRequiresWaiver} />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>Target Dimensions</Label>
            {dimensions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No impact dimensions available yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dimensions.map((dimension) => (
                  <label key={dimension.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={selectedDimensions.includes(dimension.id)}
                      onCheckedChange={(checked) => toggleDimension(dimension.id, checked === true)}
                    />
                    <div className="flex items-center gap-2">
                      {dimension.color && (
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: dimension.color }}
                        />
                      )}
                      <span className="font-medium">{dimension.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            Create Program
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
