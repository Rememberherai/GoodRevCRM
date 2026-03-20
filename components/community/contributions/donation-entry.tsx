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
import { OrganizationCombobox } from '@/components/ui/organization-combobox';
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

export function DonationEntry({
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
  const [type, setType] = useState<'monetary' | 'in_kind' | 'grant'>('monetary');
  const [status, setStatus] = useState<'pledged' | 'received' | 'completed' | 'cancelled'>('received');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [programId, setProgramId] = useState<string>('none');
  const [dimensionId, setDimensionId] = useState<string>('none');
  const [donorPersonId, setDonorPersonId] = useState<string | null>(null);
  const [donorOrganizationId, setDonorOrganizationId] = useState<string | null>(null);
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
    setType('monetary');
    setStatus('received');
    setValue('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setProgramId('none');
    setDimensionId('none');
    setDonorPersonId(null);
    setDonorOrganizationId(null);
  };

  const handleSubmit = async () => {
    const payload = {
      type,
      status,
      value: value ? Number(value) : null,
      description: description || null,
      date,
      program_id: programId === 'none' ? null : programId,
      dimension_id: dimensionId === 'none' ? null : dimensionId,
      donor_person_id: donorPersonId,
      donor_organization_id: donorOrganizationId,
    };

    const validation = createContributionSchema.safeParse(payload);
    if (!validation.success) {
      toast.error('Check the donation fields and try again.');
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
        throw new Error(data.error ?? 'Failed to create contribution');
      }

      toast.success('Contribution logged');
      onOpenChange(false);
      reset();
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create contribution');
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
          <DialogTitle>New Donation</DialogTitle>
          <DialogDescription>Log monetary, in-kind, or grant value flowing through the project.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value: typeof type) => setType(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monetary">Monetary</SelectItem>
                <SelectItem value="in_kind">In Kind</SelectItem>
                <SelectItem value="grant">Grant</SelectItem>
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
            <Label htmlFor="donation-value">Value</Label>
            <Input id="donation-value" value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="2500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donation-date">Date</Label>
            <Input id="donation-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="donation-description">Description</Label>
            <Textarea id="donation-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Garden tools donation from a local partner" />
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
              <SelectTrigger><SelectValue placeholder="Auto from program or choose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto / none</SelectItem>
                {dimensions.map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>{dimension.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Donor Person</Label>
            <PersonCombobox value={donorPersonId} onValueChange={setDonorPersonId} placeholder="Optional donor person" />
          </div>
          <div className="space-y-2">
            <Label>Donor Organization</Label>
            <OrganizationCombobox value={donorOrganizationId} onValueChange={setDonorOrganizationId} placeholder="Optional donor organization" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Save Donation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
