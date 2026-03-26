'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface NewEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  onCreated: () => void;
}

export function NewEventDialog({ open, onOpenChange, projectSlug, onCreated }: NewEventDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [locationType, setLocationType] = useState('in_person');
  const [venueName, setVenueName] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [category, setCategory] = useState('');
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt || !endsAt) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          timezone: browserTimezone,
          location_type: locationType,
          venue_name: venueName.trim() || null,
          virtual_url: virtualUrl.trim() || null,
          category: category || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to create event');

      toast.success(`"${title}" has been created as a draft.`);
      onCreated();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setLocationType('in_person');
    setVenueName('');
    setVirtualUrl('');
    setCategory('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>Add a new event. It will be saved as a draft.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Start *</Label>
              <Input id="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">End *</Label>
              <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </div>
          </div>

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
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="gala">Gala</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="fundraiser">Fundraiser</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(locationType === 'in_person' || locationType === 'hybrid') && (
            <div className="space-y-2">
              <Label htmlFor="venue_name">Venue Name</Label>
              <Input id="venue_name" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </div>
          )}

          {(locationType === 'virtual' || locationType === 'hybrid') && (
            <div className="space-y-2">
              <Label htmlFor="virtual_url">Virtual URL</Label>
              <Input id="virtual_url" type="url" value={virtualUrl} onChange={(e) => setVirtualUrl(e.target.value)} placeholder="https://..." />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !startsAt || !endsAt}>
              {isSubmitting ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
