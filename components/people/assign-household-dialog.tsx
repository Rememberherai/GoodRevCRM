'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HouseholdCombobox } from '@/components/ui/household-combobox';

const RELATIONSHIP_OPTIONS = [
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'spouse_partner', label: 'Spouse / Partner' },
  { value: 'child', label: 'Child' },
  { value: 'dependent', label: 'Dependent' },
  { value: 'extended_family', label: 'Extended Family' },
  { value: 'other', label: 'Other' },
];

interface AssignHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string | null;
  projectSlug: string;
  onAssigned: () => void;
}

export function AssignHouseholdDialog({
  open,
  onOpenChange,
  personId,
  projectSlug,
  onAssigned,
}: AssignHouseholdDialogProps) {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!householdId || !personId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/households/${householdId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_id: personId,
            relationship,
            is_primary_contact: false,
            start_date: new Date().toISOString().split('T')[0],
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign household');
      }

      // Reset form and close
      setHouseholdId(null);
      setRelationship('other');
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign household');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setHouseholdId(null);
      setRelationship('other');
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Household</DialogTitle>
          <DialogDescription>
            Search for and assign this person to a household.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Household</Label>
            <HouseholdCombobox
              value={householdId}
              onValueChange={setHouseholdId}
              placeholder="Search households..."
            />
          </div>

          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!householdId || isSubmitting}
          >
            {isSubmitting ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
