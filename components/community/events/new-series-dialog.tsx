'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface NewSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  onCreated: () => void;
}

interface TicketTemplate {
  name: string;
  quantity_available: string;
  max_per_order: string;
}

const DAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
] as const;

export function NewSeriesDialog({ open, onOpenChange, projectSlug, onCreated }: NewSeriesDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [dayPosition, setDayPosition] = useState('');
  const [endMode, setEndMode] = useState<'until' | 'count'>('count');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState('10');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [locationType, setLocationType] = useState('in_person');
  const [venueName, setVenueName] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [programId, setProgramId] = useState('');
  const [ticketTypes, setTicketTypes] = useState<TicketTemplate[]>([]);

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';
  const dayPositionValue = dayPosition || '__by_date__';
  const programSelectValue = programId || '__none__';

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects/${projectSlug}/programs?limit=100`)
      .then(res => res.json())
      .then(data => { if (data.programs) setPrograms(data.programs); })
      .catch(() => {});
  }, [projectSlug, open]);

  const showDaysOfWeek = frequency === 'weekly' || frequency === 'biweekly' ||
    (frequency === 'monthly' && dayPosition !== '');

  function toggleDay(day: string) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  function addTicketType() {
    setTicketTypes(prev => [...prev, { name: '', quantity_available: '', max_per_order: '10' }]);
  }

  function removeTicketType(index: number) {
    setTicketTypes(prev => prev.filter((_, i) => i !== index));
  }

  function updateTicketType(index: number, field: keyof TicketTemplate, value: string) {
    setTicketTypes(prev => {
      const next = [...prev];
      const cur = next[index];
      if (cur) next[index] = { ...cur, [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        recurrence_frequency: frequency,
        template_start_time: startTime,
        template_end_time: endTime,
        timezone: browserTimezone,
        location_type: locationType,
        venue_name: venueName.trim() || null,
        virtual_url: virtualUrl.trim() || null,
        program_id: programId || null,
      };

      if (daysOfWeek.length > 0) body.recurrence_days_of_week = daysOfWeek;
      if (dayPosition) body.recurrence_day_position = parseInt(dayPosition, 10);

      if (endMode === 'until' && recurrenceUntil) {
        body.recurrence_until = recurrenceUntil;
      } else if (endMode === 'count' && recurrenceCount) {
        body.recurrence_count = parseInt(recurrenceCount, 10);
      }

      if (ticketTypes.length > 0) {
        body.ticket_types = ticketTypes
          .filter(tt => tt.name.trim())
          .map(tt => ({
            name: tt.name.trim(),
            quantity_available: tt.quantity_available ? parseInt(tt.quantity_available, 10) : null,
            max_per_order: parseInt(tt.max_per_order, 10) || 10,
          }));
      }

      const res = await fetch(`/api/projects/${projectSlug}/events/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create series');

      toast.success(`Series created with ${data.instances_generated} event instances`);
      onCreated();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create series');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setFrequency('weekly');
    setDaysOfWeek([]);
    setDayPosition('');
    setEndMode('count');
    setRecurrenceUntil('');
    setRecurrenceCount('10');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocationType('in_person');
    setVenueName('');
    setVirtualUrl('');
    setProgramId('');
    setTicketTypes([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Recurring Event Series</DialogTitle>
          <DialogDescription>Set up a recurring event. Instances will be auto-generated.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="series-title">Title *</Label>
            <Input id="series-title" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="series-desc">Description</Label>
            <Textarea id="series-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label>Frequency *</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === 'monthly' && (
            <div className="space-y-2">
              <Label>Day Position (optional)</Label>
              <Select value={dayPositionValue} onValueChange={(value) => setDayPosition(value === '__by_date__' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="Day of month" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__by_date__">By date</SelectItem>
                  <SelectItem value="1">1st</SelectItem>
                  <SelectItem value="2">2nd</SelectItem>
                  <SelectItem value="3">3rd</SelectItem>
                  <SelectItem value="4">4th</SelectItem>
                  <SelectItem value="5">5th (last)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showDaysOfWeek && (
            <div className="space-y-2">
              <Label>Days of Week {(frequency === 'weekly' || frequency === 'biweekly') ? '*' : ''}</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={daysOfWeek.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div className="space-y-2">
            <Label>End After</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="endMode" checked={endMode === 'count'} onChange={() => setEndMode('count')} />
                <span className="text-sm">Count</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="endMode" checked={endMode === 'until'} onChange={() => setEndMode('until')} />
                <span className="text-sm">Date</span>
              </label>
            </div>
            {endMode === 'count' ? (
              <Input type="number" min="1" max="365" value={recurrenceCount} onChange={e => setRecurrenceCount(e.target.value)} placeholder="Number of instances" />
            ) : (
              <Input type="date" value={recurrenceUntil} onChange={e => setRecurrenceUntil(e.target.value)} />
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {programs.length > 0 && (
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={programSelectValue} onValueChange={(value) => setProgramId(value === '__none__' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {programs.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(locationType === 'in_person' || locationType === 'hybrid') && (
            <div className="space-y-2">
              <Label>Venue Name</Label>
              <Input value={venueName} onChange={e => setVenueName(e.target.value)} />
            </div>
          )}

          {(locationType === 'virtual' || locationType === 'hybrid') && (
            <div className="space-y-2">
              <Label>Virtual URL</Label>
              <Input type="url" value={virtualUrl} onChange={e => setVirtualUrl(e.target.value)} placeholder="https://..." />
            </div>
          )}

          {/* Ticket type templates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ticket Types (optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTicketType}>
                <Plus className="mr-1 h-3 w-3" />Add
              </Button>
            </div>
            {ticketTypes.map((tt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={tt.name}
                  onChange={e => updateTicketType(i, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={tt.quantity_available}
                  onChange={e => updateTicketType(i, 'quantity_available', e.target.value)}
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={tt.max_per_order}
                  onChange={e => updateTicketType(i, 'max_per_order', e.target.value)}
                  className="w-20"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTicketType(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !startTime || !endTime}>
              {isSubmitting ? 'Creating...' : 'Create Series'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
