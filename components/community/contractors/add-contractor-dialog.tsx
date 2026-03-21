'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ServiceTypeMultiSelect } from '@/components/ui/service-type-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  onCreated?: () => void;
}

export function AddContractorDialog({ open, onOpenChange, projectSlug, onCreated }: AddContractorDialogProps) {
  // Person fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Scope fields
  const [scopeTitle, setScopeTitle] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [serviceTypeIds, setServiceTypeIds] = useState<string[]>([]);
  const [compensationTerms, setCompensationTerms] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setScopeTitle('');
    setScopeDescription('');
    setServiceTypeIds([]);
    setCompensationTerms('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!scopeTitle.trim()) {
      toast.error('Scope title is required');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create the person with is_contractor = true
      const personResponse = await fetch(`/api/projects/${projectSlug}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          is_contractor: true,
          force_create: true,
        }),
      });

      const personData = await personResponse.json() as { person?: { id: string }; error?: string };
      if (!personResponse.ok || !personData.person) {
        throw new Error(personData.error ?? 'Failed to create person');
      }

      const personId = personData.person.id;

      // Step 2: Create the scope
      const scopeResponse = await fetch(`/api/projects/${projectSlug}/contractor-scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: personId,
          title: scopeTitle.trim(),
          description: scopeDescription.trim() || null,
          service_categories: [],
          service_type_ids: serviceTypeIds,
          compensation_terms: compensationTerms.trim() || null,
        }),
      });

      const scopeData = await scopeResponse.json() as { error?: string };
      if (!scopeResponse.ok) {
        // Person was created but scope failed — still notify
        toast.warning(`Contractor created but scope failed: ${scopeData.error ?? 'Unknown error'}. Add scope manually.`);
      } else {
        toast.success('Contractor added with scope');
      }

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contractor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contractor</DialogTitle>
          <DialogDescription>
            Create a new contractor with their scope of work in one step.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Person section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractor-first-name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contractor-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-last-name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contractor-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractor-email">Email</Label>
                <Input
                  id="contractor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-phone">Phone</Label>
                <Input
                  id="contractor-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <Separator />

            {/* Scope section */}
            <div className="space-y-2">
              <Label htmlFor="contractor-scope-title">
                Scope Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contractor-scope-title"
                value={scopeTitle}
                onChange={(e) => setScopeTitle(e.target.value)}
                placeholder="e.g. General Plumbing Services"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-scope-desc">Description</Label>
              <Textarea
                id="contractor-scope-desc"
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Describe the scope of work..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Service Types</Label>
              <ServiceTypeMultiSelect
                value={serviceTypeIds}
                onChange={setServiceTypeIds}
                placeholder="Select service types..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-compensation">Compensation Terms</Label>
              <Input
                id="contractor-compensation"
                value={compensationTerms}
                onChange={(e) => setCompensationTerms(e.target.value)}
                placeholder="e.g. $45/hr, Net 30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Contractor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
