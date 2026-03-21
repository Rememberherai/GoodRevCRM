'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface OptionRecord {
  id: string;
  name: string;
}

interface NewReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHouseholdId?: string;
  onCreated: () => void;
}

export function NewReferralDialog({ open, onOpenChange, initialHouseholdId, onCreated }: NewReferralDialogProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [people, setPeople] = useState<OptionRecord[]>([]);
  const [households, setHouseholds] = useState<OptionRecord[]>([]);
  const [partners, setPartners] = useState<OptionRecord[]>([]);
  const [personId, setPersonId] = useState('none');
  const [householdId, setHouseholdId] = useState(initialHouseholdId ?? 'none');
  const [partnerOrganizationId, setPartnerOrganizationId] = useState('none');
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadOptions = async () => {
      const [peopleResponse, householdsResponse, organizationsResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/people?limit=100`),
        fetch(`/api/projects/${slug}/households?limit=100`),
        fetch(`/api/projects/${slug}/organizations?limit=100`),
      ]);

      const [peopleData, householdsData, organizationsData] = await Promise.all([
        peopleResponse.json(),
        householdsResponse.json(),
        organizationsResponse.json(),
      ]);

      setPeople(((peopleData.people ?? []) as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map((person) => ({
        id: person.id,
        name: [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed person',
      })));
      setHouseholds(((householdsData.households ?? []) as Array<{ id: string; name: string }>).map((household) => ({
        id: household.id,
        name: household.name,
      })));
      setPartners(((organizationsData.organizations ?? []) as Array<{ id: string; name: string; is_referral_partner?: boolean | null }>).filter((organization) => organization.is_referral_partner !== false).map((organization) => ({
        id: organization.id,
        name: organization.name,
      })));
    };

    void loadOptions();
  }, [open, slug]);

  useEffect(() => {
    if (open) {
      setHouseholdId(initialHouseholdId ?? 'none');
    }
  }, [initialHouseholdId, open]);

  const isValid = useMemo(() => {
    return serviceType.trim().length > 0 && (personId !== 'none' || householdId !== 'none');
  }, [householdId, personId, serviceType]);

  async function handleSubmit() {
    if (!isValid) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${slug}/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId === 'none' ? null : personId,
          household_id: householdId === 'none' ? null : householdId,
          partner_organization_id: partnerOrganizationId === 'none' ? null : partnerOrganizationId,
          service_type: serviceType.trim(),
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create referral');
      }

      setPersonId('none');
      setHouseholdId(initialHouseholdId ?? 'none');
      setPartnerOrganizationId('none');
      setServiceType('');
      setNotes('');
      onOpenChange(false);
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create referral');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New Referral</DialogTitle>
          <DialogDescription>
            Create a closed-loop referral to a partner organization or service provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Person</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific person</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Household</Label>
              <Select value={householdId} onValueChange={setHouseholdId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional household" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific household</SelectItem>
                  {households.map((household) => (
                    <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-type">Service Type</Label>
            <Input
              id="service-type"
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              placeholder="Food assistance, counseling, employment, transportation..."
            />
          </div>

          <div className="space-y-2">
            <Label>Partner Organization</Label>
            <Select value={partnerOrganizationId} onValueChange={setPartnerOrganizationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select partner organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No partner selected</SelectItem>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral-notes">Notes</Label>
            <Textarea
              id="referral-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, urgency, and any known outcome details"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !isValid}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
