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
import { AddressAutocomplete, type AddressResult } from '@/components/ui/address-autocomplete';

interface DimensionOption {
  id: string;
  label: string;
}

interface AssetForEdit {
  id: string;
  name: string;
  description: string | null;
  category: string;
  condition: string;
  dimension_id: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  value_estimate: number | null;
  notes: string | null;
  steward_person_id: string | null;
  steward_organization_id: string | null;
}

type AssetCategory = 'facility' | 'land' | 'equipment' | 'vehicle' | 'technology' | 'other';
type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor';

export function EditAssetDialog({
  open,
  onOpenChange,
  asset,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetForEdit;
  onUpdated: () => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? '');
  const [category, setCategory] = useState<AssetCategory>(asset.category as AssetCategory);
  const [condition, setCondition] = useState<AssetCondition>(asset.condition as AssetCondition);
  const [dimensionId, setDimensionId] = useState(asset.dimension_id ?? 'none');
  const [addressStreet, setAddressStreet] = useState(asset.address_street ?? '');
  const [addressCity, setAddressCity] = useState(asset.address_city ?? '');
  const [addressState, setAddressState] = useState(asset.address_state ?? '');
  const [valueEstimate, setValueEstimate] = useState(asset.value_estimate?.toString() ?? '');
  const [notes, setNotes] = useState(asset.notes ?? '');
  const [stewardPersonId, setStewardPersonId] = useState<string | null>(asset.steward_person_id);
  const [stewardOrganizationId, setStewardOrganizationId] = useState<string | null>(asset.steward_organization_id);

  // Reset form when asset changes (e.g. dialog reopened with fresh data)
  useEffect(() => {
    if (open) {
      setName(asset.name);
      setDescription(asset.description ?? '');
      setCategory(asset.category as AssetCategory);
      setCondition(asset.condition as AssetCondition);
      setDimensionId(asset.dimension_id ?? 'none');
      setAddressStreet(asset.address_street ?? '');
      setAddressCity(asset.address_city ?? '');
      setAddressState(asset.address_state ?? '');
      setValueEstimate(asset.value_estimate?.toString() ?? '');
      setNotes(asset.notes ?? '');
      setStewardPersonId(asset.steward_person_id);
      setStewardOrganizationId(asset.steward_organization_id);
    }
  }, [open, asset]);

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
        console.error('Failed to load dimensions:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, slug]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Asset name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
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

      const response = await fetch(`/api/projects/${slug}/community-assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update asset');
      }

      toast.success('Asset updated');
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>Update asset details, location, and stewardship.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-asset-name">Asset Name</Label>
            <Input id="edit-asset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="North Garden Tool Shed" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-asset-description">Description</Label>
            <Textarea id="edit-asset-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the asset is and how it supports the community." />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v: AssetCategory) => setCategory(v)}>
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
            <Select value={condition} onValueChange={(v: AssetCondition) => setCondition(v)}>
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
                {dimensions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-asset-value">Value Estimate</Label>
            <Input id="edit-asset-value" value={valueEstimate} onChange={(e) => setValueEstimate(e.target.value)} inputMode="decimal" placeholder="12000" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-asset-address">Street Address</Label>
            <AddressAutocomplete
              id="edit-asset-address"
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
            <Label htmlFor="edit-asset-city">City</Label>
            <Input id="edit-asset-city" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Denver" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-asset-state">State</Label>
            <Input id="edit-asset-state" value={addressState} onChange={(e) => setAddressState(e.target.value)} placeholder="CO" />
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
            <Label htmlFor="edit-asset-notes">Notes</Label>
            <Textarea id="edit-asset-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maintenance needs, booking notes, or condition context." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
