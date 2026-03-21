'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { createHouseholdSchema } from '@/lib/validators/community/households';
import { AddressAutocomplete, type AddressResult } from '@/components/ui/address-autocomplete';

interface PersonOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface MemberDraft {
  person_id: string;
  relationship: 'head_of_household' | 'spouse_partner' | 'child' | 'dependent' | 'extended_family' | 'other';
  start_date: string;
  is_primary_contact: boolean;
}

const RELATIONSHIP_OPTIONS: MemberDraft['relationship'][] = [
  'head_of_household',
  'spouse_partner',
  'child',
  'dependent',
  'extended_family',
  'other',
];

export function NewHouseholdDialog({
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
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [name, setName] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [householdSize, setHouseholdSize] = useState('');
  const [notes, setNotes] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<MemberDraft['relationship']>('head_of_household');
  const [selectedStartDate, setSelectedStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [intakeNotes, setIntakeNotes] = useState('');

  useEffect(() => {
    if (!open || peopleLoaded) return;

    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/people?limit=100`);
        const data = await response.json() as { people?: PersonOption[] };
        if (active && response.ok) {
          setPeople(data.people ?? []);
          setPeopleLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load people for household dialog:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, peopleLoaded, slug]);

  const resetForm = () => {
    setStep(0);
    setName('');
    setAddressStreet('');
    setAddressCity('');
    setAddressState('');
    setAddressPostalCode('');
    setAddressCountry('');
    setLatitude(null);
    setLongitude(null);
    setHouseholdSize('');
    setNotes('');
    setMembers([]);
    setSelectedPersonId('');
    setSelectedRelationship('head_of_household');
    setSelectedStartDate(new Date().toISOString().slice(0, 10));
    setIntakeNotes('');
  };

  const selectedPeopleIds = useMemo(() => new Set(members.map((member) => member.person_id)), [members]);

  const availablePeople = people.filter((person) => !selectedPeopleIds.has(person.id));

  const addMember = () => {
    if (!selectedPersonId) return;
    setMembers((current) => [
      ...current,
      {
        person_id: selectedPersonId,
        relationship: selectedRelationship,
        start_date: selectedStartDate,
        is_primary_contact: current.length === 0,
      },
    ]);
    setSelectedPersonId('');
    setSelectedRelationship('head_of_household');
  };

  const removeMember = (personId: string) => {
    setMembers((current) => {
      const next = current.filter((member) => member.person_id !== personId);
      if (next.length > 0 && !next.some((member) => member.is_primary_contact)) {
        const firstMember = next[0];
        if (firstMember) {
          next[0] = { ...firstMember, is_primary_contact: true };
        }
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const payload = {
      name,
      address_street: addressStreet || null,
      address_city: addressCity || null,
      address_state: addressState || null,
      address_postal_code: addressPostalCode || null,
      address_country: addressCountry || null,
      latitude,
      longitude,
      geocoded_status: latitude ? 'success' as const : 'pending' as const,
      household_size: householdSize ? Number(householdSize) : null,
      notes: notes || null,
      members,
      intake: intakeNotes.trim()
        ? {
            notes: intakeNotes,
            status: 'draft',
            needs: {},
          }
        : undefined,
    };

    const validation = createHouseholdSchema.safeParse(payload);
    if (!validation.success) {
      toast.error('Check the household details and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/households`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create household');
      }

      toast.success('Household created');
      onOpenChange(false);
      resetForm();
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create household');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) {
      return name.trim().length > 0;
    }
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>New Household</DialogTitle>
          <DialogDescription>
            {step === 0 && 'Capture the core household details.'}
            {step === 1 && 'Optionally add members and mark a primary contact.'}
            {step === 2 && 'Optionally record intake notes for follow-up.'}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="household-name">Household Name</Label>
              <Input id="household-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Martinez Family" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="household-address-street">Street Address</Label>
              <AddressAutocomplete
                id="household-address-street"
                value={addressStreet}
                onChange={setAddressStreet}
                onSelect={(result: AddressResult) => {
                  setAddressStreet(result.street);
                  setAddressCity(result.city);
                  setAddressState(result.state);
                  setAddressPostalCode(result.postal_code);
                  setAddressCountry(result.country);
                  setLatitude(result.lat);
                  setLongitude(result.lng);
                }}
                placeholder="Start typing an address..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="household-address-city">City</Label>
              <Input id="household-address-city" value={addressCity} onChange={(event) => setAddressCity(event.target.value)} placeholder="Denver" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="household-address-state">State</Label>
              <Input id="household-address-state" value={addressState} onChange={(event) => setAddressState(event.target.value)} placeholder="CO" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="household-address-postal">Zip Code</Label>
              <Input id="household-address-postal" value={addressPostalCode} onChange={(event) => setAddressPostalCode(event.target.value)} placeholder="80202" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="household-size">Household Size</Label>
              <Input id="household-size" value={householdSize} onChange={(event) => setHouseholdSize(event.target.value)} inputMode="numeric" placeholder="4" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="household-notes">Notes</Label>
              <Textarea id="household-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context or quick notes" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.8fr_1.2fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Person</Label>
                <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeople.length === 0 ? (
                      <SelectItem value="none" disabled>No more people available</SelectItem>
                    ) : availablePeople.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {[person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || person.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select value={selectedRelationship} onValueChange={(value: MemberDraft['relationship']) => setSelectedRelationship(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((relationship) => (
                      <SelectItem key={relationship} value={relationship}>
                        {relationship.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={selectedStartDate} onChange={(event) => setSelectedStartDate(event.target.value)} />
              </div>
              <Button type="button" variant="secondary" onClick={addMember} disabled={!selectedPersonId}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {members.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No members added yet. You can still create the household and add members later.
                </div>
              ) : members.map((member) => {
                const person = people.find((entry) => entry.id === member.person_id);
                const label = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.email || member.person_id;
                return (
                  <div key={member.person_id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-sm text-muted-foreground">
                        {member.relationship.replaceAll('_', ' ')}
                        {member.is_primary_contact ? ' • primary contact' : ''}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMember(member.person_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label htmlFor="household-intake-notes">Intake Notes</Label>
            <Textarea
              id="household-intake-notes"
              value={intakeNotes}
              onChange={(event) => setIntakeNotes(event.target.value)}
              placeholder="Optional intake details for case-management follow-up"
              className="min-h-40"
            />
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          )}

          {step < 2 ? (
            <Button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canAdvance()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Household
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
