'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Program {
  id: string;
  name: string;
}

interface EventEditTabProps {
  projectSlug: string;
  eventId: string;
  event: Record<string, unknown>;
  onUpdated: () => void;
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function EventEditTab({ projectSlug, eventId, event, onUpdated }: EventEditTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [title, setTitle] = useState(event.title as string || '');
  const [description, setDescription] = useState(event.description as string || '');
  const [startsAt, setStartsAt] = useState(toLocalDatetime(event.starts_at as string));
  const [endsAt, setEndsAt] = useState(toLocalDatetime(event.ends_at as string));
  const [timezone] = useState(event.timezone as string || 'America/Denver');
  const [locationType, setLocationType] = useState(event.location_type as string || 'in_person');
  const [venueName, setVenueName] = useState(event.venue_name as string || '');
  const [venueAddress, setVenueAddress] = useState(event.venue_address as string || '');
  const [virtualUrl, setVirtualUrl] = useState(event.virtual_url as string || '');
  const [recordingUrl, setRecordingUrl] = useState(event.recording_url as string || '');
  const [category, setCategory] = useState(event.category as string || '');
  const [totalCapacity, setTotalCapacity] = useState(event.total_capacity != null ? String(event.total_capacity) : '');
  const [registrationEnabled, setRegistrationEnabled] = useState(event.registration_enabled as boolean ?? true);
  const [waitlistEnabled, setWaitlistEnabled] = useState(event.waitlist_enabled as boolean ?? false);
  const [requireApproval, setRequireApproval] = useState(event.require_approval as boolean ?? false);
  const [addToCrm, setAddToCrm] = useState(event.add_to_crm as boolean ?? false);
  const [programId, setProgramId] = useState(event.program_id as string || '');
  const [organizerName, setOrganizerName] = useState(event.organizer_name as string || '');
  const [organizerEmail, setOrganizerEmail] = useState(event.organizer_email as string || '');
  const [confirmationMessage, setConfirmationMessage] = useState(event.confirmation_message as string || '');
  const [cancellationPolicy, setCancellationPolicy] = useState(event.cancellation_policy as string || '');
  const programSelectValue = programId || '__none__';

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/programs?limit=100`)
      .then(res => res.json())
      .then(data => { if (data.programs) setPrograms(data.programs); })
      .catch(() => {});
  }, [projectSlug]);

  async function handleSave() {
    if (!title.trim() || !startsAt || !endsAt) {
      toast.error('Title, start, and end are required');
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        timezone,
        location_type: locationType,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        virtual_url: virtualUrl.trim() || null,
        recording_url: recordingUrl.trim() || null,
        category: category || null,
        total_capacity: totalCapacity ? parseInt(totalCapacity, 10) : null,
        registration_enabled: registrationEnabled,
        waitlist_enabled: waitlistEnabled,
        require_approval: requireApproval,
        add_to_crm: addToCrm,
        program_id: programId || null,
        organizer_name: organizerName.trim() || null,
        organizer_email: organizerEmail.trim() || null,
        confirmation_message: confirmationMessage.trim() || null,
        cancellation_policy: cancellationPolicy.trim() || null,
      };

      const res = await fetch(`/api/projects/${projectSlug}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      toast.success('Event updated');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit Event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-title">Title *</Label>
          <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea id="edit-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-starts">Start *</Label>
            <Input id="edit-starts" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-ends">End *</Label>
            <Input id="edit-ends" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-venue">Venue Name</Label>
              <Input id="edit-venue" value={venueName} onChange={e => setVenueName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Venue Address</Label>
              <Input id="edit-address" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} />
            </div>
          </div>
        )}

        {(locationType === 'virtual' || locationType === 'hybrid') && (
          <div className="space-y-2">
            <Label htmlFor="edit-virtual-url">Virtual URL</Label>
            <Input id="edit-virtual-url" type="url" value={virtualUrl} onChange={e => setVirtualUrl(e.target.value)} placeholder="https://..." />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="edit-recording-url">Recording / Replay URL</Label>
          <Input id="edit-recording-url" type="url" value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-capacity">Total Capacity</Label>
            <Input id="edit-capacity" type="number" min="1" value={totalCapacity} onChange={e => setTotalCapacity(e.target.value)} placeholder="Unlimited" />
          </div>
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-organizer-name">Organizer Name</Label>
            <Input id="edit-organizer-name" value={organizerName} onChange={e => setOrganizerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-organizer-email">Organizer Email</Label>
            <Input id="edit-organizer-email" type="email" value={organizerEmail} onChange={e => setOrganizerEmail(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-confirmation">Confirmation Message</Label>
          <Textarea id="edit-confirmation" value={confirmationMessage} onChange={e => setConfirmationMessage(e.target.value)} rows={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-cancellation">Cancellation Policy</Label>
          <Textarea id="edit-cancellation" value={cancellationPolicy} onChange={e => setCancellationPolicy(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="edit-reg-enabled">Registration Enabled</Label>
            <Switch id="edit-reg-enabled" checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="edit-waitlist">Waitlist</Label>
            <Switch id="edit-waitlist" checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="edit-approval">Require Approval</Label>
            <Switch id="edit-approval" checked={requireApproval} onCheckedChange={setRequireApproval} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="edit-crm">Add to CRM</Label>
            <Switch id="edit-crm" checked={addToCrm} onCheckedChange={setAddToCrm} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !startsAt || !endsAt}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
