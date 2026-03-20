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
import { PersonCombobox } from '@/components/ui/person-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createContributionSchema } from '@/lib/validators/community/contributions';

interface ProgramOption {
  id: string;
  name: string;
}

interface DimensionOption {
  id: string;
  label: string;
}

export function TimeLogEntry({
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
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [type, setType] = useState<'volunteer_hours' | 'service'>('volunteer_hours');
  const [status, setStatus] = useState<'pledged' | 'received' | 'completed' | 'cancelled'>('completed');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [programId, setProgramId] = useState<string>('none');
  const [dimensionId, setDimensionId] = useState<string>('none');
  const [personId, setPersonId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void (async () => {
      const [programResponse, dimensionResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/programs?limit=100`),
        fetch(`/api/projects/${slug}/impact-dimensions`),
      ]);
      if (!active) return;
      const programData = await programResponse.json() as { programs?: ProgramOption[] };
      const dimensionData = await dimensionResponse.json() as { dimensions?: DimensionOption[] };
      if (programResponse.ok) setPrograms(programData.programs ?? []);
      if (dimensionResponse.ok) setDimensions(dimensionData.dimensions ?? []);
    })();

    return () => {
      active = false;
    };
  }, [open, slug]);

  const reset = () => {
    setType('volunteer_hours');
    setStatus('completed');
    setHours('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setProgramId('none');
    setDimensionId('none');
    setPersonId(null);
  };

  const handleSubmit = async () => {
    const payload = {
      type,
      status,
      hours: hours ? Number(hours) : null,
      description: description || null,
      date,
      program_id: programId === 'none' ? null : programId,
      dimension_id: dimensionId === 'none' ? null : dimensionId,
      donor_person_id: personId,
    };

    const validation = createContributionSchema.safeParse(payload);
    if (!validation.success) {
      toast.error('Check the time log fields and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to log time');
      }

      toast.success('Time logged');
      onOpenChange(false);
      reset();
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log time');
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
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>New Time Log</DialogTitle>
          <DialogDescription>Log volunteer hours or service time with optional program linkage.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value: typeof type) => setType(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="volunteer_hours">Volunteer Hours</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value: typeof status) => setStatus(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pledged">Pledged</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time-hours">Hours</Label>
            <Input id="time-hours" value={hours} onChange={(event) => setHours(event.target.value)} inputMode="decimal" placeholder="3.5" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time-date">Date</Label>
            <Input id="time-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Person</Label>
            <PersonCombobox value={personId} onValueChange={setPersonId} placeholder="Volunteer or service provider" />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger><SelectValue placeholder="Optional program" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked program</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dimension</Label>
            <Select value={dimensionId} onValueChange={setDimensionId}>
              <SelectTrigger><SelectValue placeholder="Auto / none" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto / none</SelectItem>
                {dimensions.map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>{dimension.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="time-description">Description</Label>
            <Textarea id="time-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Set-up support for weekend food pantry" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Save Time Log</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
