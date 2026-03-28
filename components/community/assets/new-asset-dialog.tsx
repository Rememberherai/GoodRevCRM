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
import { OrganizationCombobox } from '@/components/ui/organization-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { createCommunityAssetSchema } from '@/lib/validators/community/assets';
import { AddressAutocomplete, type AddressResult } from '@/components/ui/address-autocomplete';

interface DimensionOption {
  id: string;
  label: string;
}

export function NewAssetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (assetId?: string) => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'facility' | 'land' | 'equipment' | 'vehicle' | 'technology' | 'other'>('facility');
  const [condition, setCondition] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [dimensionId, setDimensionId] = useState<string>('none');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [valueEstimate, setValueEstimate] = useState('');
  const [notes, setNotes] = useState('');
  const [stewardPersonId, setStewardPersonId] = useState<string | null>(null);
  const [stewardOrganizationId, setStewardOrganizationId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);

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
        console.error('Failed to load dimensions for asset dialog:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, slug]);

  const reset = () => {
    setName('');
    setDescription('');
    setCategory('facility');
    setCondition('good');
    setDimensionId('none');
    setAddressStreet('');
    setAddressCity('');
    setAddressState('');
    setValueEstimate('');
    setNotes('');
    setStewardPersonId(null);
    setStewardOrganizationId(null);
    setIsShared(false);
  };

  const handleSubmit = async () => {
    const payload = {
      name,
      description: description || null,
      category,
      condition,
      dimension_id: dimensionId === 'none' ? null : dimensionId,
      address_street: addressStreet || null,
      address_city: addressCity || null,
      address_state: addressState || null,
      value_estimate: valueEstimate ? Number(valueEstimate) : null,
      notes: notes || null,
      steward_person_id: stewardPersonId,
      steward_organization_id: stewardOrganizationId,
    };

    const validation = createCommunityAssetSchema.safeParse(payload);
    if (!validation.success) {
      toast.error('Check the asset fields and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/community-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });
      const data = await response.json() as { asset?: { id: string }; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create asset');
      }

      toast.success('Community asset created');
      onOpenChange(false);
      const createdId = isShared ? data.asset?.id : undefined;
      reset();
      onCreated(createdId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create asset');
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
          <DialogTitle>New Community Asset</DialogTitle>
          <DialogDescription>Track facilities, land, equipment, and other shared resources.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="asset-name">Asset Name</Label>
            <Input id="asset-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="North Garden Tool Shed" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="asset-description">Description</Label>
            <Textarea id="asset-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What the asset is and how it supports the community." />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value: typeof category) => setCategory(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="land">Land</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(value: typeof condition) => setCondition(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dimension</Label>
            <Select value={dimensionId} onValueChange={setDimensionId}>
              <SelectTrigger><SelectValue placeholder="Optional dimension" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No dimension</SelectItem>
                {dimensions.map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>{dimension.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-value">Value Estimate</Label>
            <Input id="asset-value" value={valueEstimate} onChange={(event) => setValueEstimate(event.target.value)} inputMode="decimal" placeholder="12000" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="asset-address">Street Address</Label>
            <AddressAutocomplete
              id="asset-address"
              value={addressStreet}
              onChange={setAddressStreet}
              onSelect={(result: AddressResult) => {
                setAddressStreet(result.street);
                setAddressCity(result.city);
                setAddressState(result.state);
              }}
              placeholder="Start typing an address..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-city">City</Label>
            <Input id="asset-city" value={addressCity} onChange={(event) => setAddressCity(event.target.value)} placeholder="Denver" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-state">State</Label>
            <Input id="asset-state" value={addressState} onChange={(event) => setAddressState(event.target.value)} placeholder="CO" />
          </div>
          <div className="space-y-2">
            <Label>Steward Person</Label>
            <PersonCombobox value={stewardPersonId} onValueChange={setStewardPersonId} placeholder="Optional steward person" />
          </div>
          <div className="space-y-2">
            <Label>Steward Organization</Label>
            <OrganizationCombobox value={stewardOrganizationId} onValueChange={setStewardOrganizationId} placeholder="Optional steward organization" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="asset-notes">Notes</Label>
            <Textarea id="asset-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Maintenance needs, booking notes, or condition context." />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
          <Checkbox
            id="asset-shared"
            checked={isShared}
            onCheckedChange={(checked) => setIsShared(checked === true)}
          />
          <Label htmlFor="asset-shared" className="text-sm font-medium leading-none cursor-pointer">
            This asset will be shared or bookable by the public
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Create Asset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
