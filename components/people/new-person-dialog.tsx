'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { usePeople } from '@/hooks/use-people';
import { useEmailValidation } from '@/hooks/use-email-validation';
import { DuplicateDetectedError } from '@/stores/person';
import { DuplicateInterceptModal } from '@/components/deduplication/duplicate-intercept-modal';
import { createPersonSchema, type CreatePersonInput } from '@/lib/validators/person';
import type { DetectionMatch } from '@/types/deduplication';
import { HouseholdCombobox } from '@/components/ui/household-combobox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddressAutocomplete, type AddressResult } from '@/components/ui/address-autocomplete';
import { Loader2, CheckCircle2, AlertTriangle, Home, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type HouseholdRelationship = 'head_of_household' | 'spouse_partner' | 'child' | 'dependent' | 'extended_family' | 'other';

const RELATIONSHIP_OPTIONS: { value: HouseholdRelationship; label: string }[] = [
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'spouse_partner', label: 'Spouse / Partner' },
  { value: 'child', label: 'Child' },
  { value: 'dependent', label: 'Dependent' },
  { value: 'extended_family', label: 'Extended Family' },
  { value: 'other', label: 'Other' },
];

interface NewPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPersonDialog({ open, onOpenChange }: NewPersonDialogProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const { create, isLoading } = usePeople();
  const [duplicateMatches, setDuplicateMatches] = useState<DetectionMatch[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<CreatePersonInput | null>(null);
  const { validate: validateEmail, validating: emailValidating, result: emailResult, clear: clearEmailValidation } = useEmailValidation();

  // Household state (managed outside react-hook-form so it survives duplicate detection)
  const [showHousehold, setShowHousehold] = useState(false);
  const [householdMode, setHouseholdMode] = useState<'existing' | 'new'>('existing');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdStreet, setNewHouseholdStreet] = useState('');
  const [newHouseholdCity, setNewHouseholdCity] = useState('');
  const [newHouseholdState, setNewHouseholdState] = useState('');
  const [newHouseholdPostalCode, setNewHouseholdPostalCode] = useState('');
  const [relationship, setRelationship] = useState<HouseholdRelationship>('head_of_household');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePersonInput>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
    },
  });

  const resetHouseholdState = () => {
    setShowHousehold(false);
    setHouseholdMode('existing');
    setHouseholdId(null);
    setNewHouseholdName('');
    setNewHouseholdStreet('');
    setNewHouseholdCity('');
    setNewHouseholdState('');
    setNewHouseholdPostalCode('');
    setRelationship('head_of_household');
    setIsPrimaryContact(false);
  };

  const buildHouseholdData = () => {
    if (!showHousehold) return {};

    const base = {
      household_relationship: relationship,
      household_is_primary_contact: isPrimaryContact,
    };

    if (householdMode === 'existing' && householdId) {
      return { ...base, household_id: householdId };
    }

    if (householdMode === 'new' && newHouseholdName.trim()) {
      return {
        ...base,
        new_household: {
          name: newHouseholdName.trim(),
          address_street: newHouseholdStreet || undefined,
          address_city: newHouseholdCity || undefined,
          address_state: newHouseholdState || undefined,
          address_postal_code: newHouseholdPostalCode || undefined,
        },
      };
    }

    return {};
  };

  const submitWithOptions = async (data: CreatePersonInput, forceCreate = false) => {
    try {
      await create({ ...data, ...buildHouseholdData(), force_create: forceCreate });
      reset();
      resetHouseholdState();
      setDuplicateMatches(null);
      setPendingFormData(null);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DuplicateDetectedError) {
        setDuplicateMatches(err.matches);
        setPendingFormData(data);
      }
      // Other errors handled by the hook
    }
  };

  const onSubmit = async (data: CreatePersonInput) => {
    await submitWithOptions(data);
  };

  const handleClose = () => {
    reset();
    resetHouseholdState();
    clearEmailValidation();
    onOpenChange(false);
  };

  const emailRegister = register('email');
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    emailRegister.onBlur(e);
    validateEmail(e.target.value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
          <DialogDescription>
            Create a new contact. You can add more details after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-first_name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-first_name"
                  {...register('first_name')}
                  placeholder="John"
                  autoFocus
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-last_name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-last_name"
                  {...register('last_name')}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <div className="relative">
                  <Input
                    id="new-email"
                    type="email"
                    {...emailRegister}
                    onBlur={handleEmailBlur}
                    placeholder="john@example.com"
                  />
                  {emailValidating && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!emailValidating && emailResult?.valid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {!emailValidating && emailResult && !emailResult.valid && (
                    <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                  )}
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
                {!emailValidating && emailResult && !emailResult.valid && (
                  <p className="text-sm text-amber-600">{emailResult.reason}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-phone">Phone</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="+1 (555) 123-4567"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-job_title">Job Title</Label>
              <Input
                id="new-job_title"
                {...register('job_title')}
                placeholder="Senior Engineer"
              />
              {errors.job_title && (
                <p className="text-sm text-destructive">{errors.job_title.message}</p>
              )}
            </div>

            {/* Household Section */}
            <div className="border-t pt-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHousehold(!showHousehold)}
              >
                <Home className="h-4 w-4" />
                Add to Household
                {showHousehold ? (
                  <ChevronUp className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-auto h-4 w-4" />
                )}
              </button>

              {showHousehold && (
                <div className="mt-3 space-y-3">
                  {/* Mode Toggle */}
                  <div className="flex gap-1 rounded-md border p-1">
                    <button
                      type="button"
                      className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        householdMode === 'existing'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setHouseholdMode('existing')}
                    >
                      Existing Household
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        householdMode === 'new'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setHouseholdMode('new')}
                    >
                      New Household
                    </button>
                  </div>

                  {/* Existing Household */}
                  {householdMode === 'existing' && (
                    <div className="space-y-2">
                      <Label>Household</Label>
                      <HouseholdCombobox
                        value={householdId}
                        onValueChange={setHouseholdId}
                        placeholder="Search households..."
                      />
                    </div>
                  )}

                  {/* New Household */}
                  {householdMode === 'new' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="new-hh-name">
                          Household Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new-hh-name"
                          value={newHouseholdName}
                          onChange={(e) => setNewHouseholdName(e.target.value)}
                          placeholder="Martinez Family"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-hh-street">Street Address</Label>
                        <AddressAutocomplete
                          id="new-hh-street"
                          value={newHouseholdStreet}
                          onChange={setNewHouseholdStreet}
                          onSelect={(result: AddressResult) => {
                            setNewHouseholdStreet(result.street);
                            setNewHouseholdCity(result.city);
                            setNewHouseholdState(result.state);
                            setNewHouseholdPostalCode(result.postal_code);
                          }}
                          placeholder="Start typing an address..."
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="new-hh-city">City</Label>
                          <Input
                            id="new-hh-city"
                            value={newHouseholdCity}
                            onChange={(e) => setNewHouseholdCity(e.target.value)}
                            placeholder="Denver"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-hh-state">State</Label>
                          <Input
                            id="new-hh-state"
                            value={newHouseholdState}
                            onChange={(e) => setNewHouseholdState(e.target.value)}
                            placeholder="CO"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-hh-zip">Zip Code</Label>
                          <Input
                            id="new-hh-zip"
                            value={newHouseholdPostalCode}
                            onChange={(e) => setNewHouseholdPostalCode(e.target.value)}
                            placeholder="80202"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Relationship & Primary Contact (both modes) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Select value={relationship} onValueChange={(v: HouseholdRelationship) => setRelationship(v)}>
                        <SelectTrigger className="w-full">
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
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={isPrimaryContact}
                          onCheckedChange={(checked) => setIsPrimaryContact(checked === true)}
                        />
                        Primary contact
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {duplicateMatches && pendingFormData && (
        <DuplicateInterceptModal
          open={true}
          onClose={() => {
            setDuplicateMatches(null);
            setPendingFormData(null);
          }}
          entityType="person"
          matches={duplicateMatches}
          pendingRecord={pendingFormData as unknown as Record<string, unknown>}
          projectSlug={projectSlug}
          onCreateAnyway={() => {
            setDuplicateMatches(null);
            submitWithOptions(pendingFormData, true);
          }}
          onMerged={() => {
            setDuplicateMatches(null);
            setPendingFormData(null);
            reset();
            resetHouseholdState();
            onOpenChange(false);
          }}
          isCreating={isLoading}
        />
      )}
    </Dialog>
  );
}
