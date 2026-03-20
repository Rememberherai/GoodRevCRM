'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { personSchema, type CreatePersonInput } from '@/lib/validators/person';
import { createPerson, updatePersonApi, DuplicateDetectedError } from '@/stores/person';
import { useDispositions } from '@/hooks/use-dispositions';
import { DISPOSITION_COLOR_MAP, type DispositionColor } from '@/types/disposition';
import { useEmailValidation } from '@/hooks/use-email-validation';
import { DuplicateInterceptModal } from '@/components/deduplication/duplicate-intercept-modal';
import type { Person } from '@/types/person';
import type { DetectionMatch } from '@/types/deduplication';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PersonFormProps {
  person?: Person;
  organizationId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PersonForm({ person, organizationId, onSuccess, onCancel }: PersonFormProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DetectionMatch[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<CreatePersonInput | null>(null);
  const [dispositionId, setDispositionId] = useState<string | null>(person?.disposition_id ?? null);
  const { dispositions } = useDispositions('person');
  const { validate: validateEmail, validating: emailValidating, result: emailResult } = useEmailValidation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      first_name: person?.first_name ?? '',
      last_name: person?.last_name ?? '',
      email: person?.email ?? '',
      phone: person?.phone ?? '',
      mobile_phone: person?.mobile_phone ?? '',
      linkedin_url: person?.linkedin_url ?? '',
      twitter_handle: person?.twitter_handle ?? '',
      avatar_url: person?.avatar_url ?? '',
      job_title: person?.job_title ?? '',
      department: person?.department ?? '',
      notes: person?.notes ?? '',
      timezone: person?.timezone ?? '',
      preferred_contact_method: person?.preferred_contact_method ?? '',
      address_street: person?.address_street ?? '',
      address_city: person?.address_city ?? '',
      address_state: person?.address_state ?? '',
      address_postal_code: person?.address_postal_code ?? '',
      address_country: person?.address_country ?? '',
    },
  });

  const emailRegister = register('email');
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    emailRegister.onBlur(e);
    validateEmail(e.target.value, person ? { personId: person.id, projectSlug } : undefined);
  };

  const submitWithOptions = async (data: CreatePersonInput, forceCreate = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const submitData = { ...data, disposition_id: dispositionId };
      if (person) {
        await updatePersonApi(projectSlug, person.id, submitData);
      } else {
        await createPerson(projectSlug, { ...submitData, organization_id: organizationId, force_create: forceCreate });
      }
      setDuplicateMatches(null);
      setPendingFormData(null);
      onSuccess?.();
    } catch (err) {
      if (err instanceof DuplicateDetectedError) {
        setDuplicateMatches(err.matches);
        setPendingFormData(data);
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: CreatePersonInput) => {
    await submitWithOptions(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                {...register('first_name')}
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                {...register('last_name')}
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                {...register('job_title')}
                placeholder="Senior Engineer"
              />
              {errors.job_title && (
                <p className="text-sm text-destructive">{errors.job_title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                {...register('department')}
                placeholder="Engineering"
              />
              {errors.department && (
                <p className="text-sm text-destructive">{errors.department.message}</p>
              )}
            </div>
          </div>

          {dispositions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="disposition">Disposition</Label>
              <Select
                value={dispositionId ?? 'none'}
                onValueChange={(v) => setDispositionId(v === 'none' ? null : v)}
              >
                <SelectTrigger id="disposition">
                  <SelectValue placeholder="Select disposition..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No disposition</SelectItem>
                  {dispositions.map((d) => {
                    const colors = DISPOSITION_COLOR_MAP[d.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray;
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`} />
                          {d.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              type="url"
              {...register('avatar_url')}
              placeholder="https://example.com/photo.jpg"
            />
            {errors.avatar_url && (
              <p className="text-sm text-destructive">{errors.avatar_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Notes about this person..."
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile_phone">Mobile Phone</Label>
              <Input
                id="mobile_phone"
                {...register('mobile_phone')}
                placeholder="+1 (555) 987-6543"
              />
              {errors.mobile_phone && (
                <p className="text-sm text-destructive">{errors.mobile_phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
            <Input
              id="preferred_contact_method"
              {...register('preferred_contact_method')}
              placeholder="email, phone, etc."
            />
            {errors.preferred_contact_method && (
              <p className="text-sm text-destructive">{errors.preferred_contact_method.message}</p>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                type="url"
                {...register('linkedin_url')}
                placeholder="https://linkedin.com/in/johndoe"
              />
              {errors.linkedin_url && (
                <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitter_handle">Twitter Handle</Label>
              <Input
                id="twitter_handle"
                {...register('twitter_handle')}
                placeholder="johndoe"
              />
              {errors.twitter_handle && (
                <p className="text-sm text-destructive">{errors.twitter_handle.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_street">Street Address</Label>
            <Input
              id="address_street"
              {...register('address_street')}
              placeholder="123 Main St"
            />
            {errors.address_street && (
              <p className="text-sm text-destructive">{errors.address_street.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address_city">City</Label>
              <Input
                id="address_city"
                {...register('address_city')}
                placeholder="San Francisco"
              />
              {errors.address_city && (
                <p className="text-sm text-destructive">{errors.address_city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_state">State / Region</Label>
              <Input
                id="address_state"
                {...register('address_state')}
                placeholder="California"
              />
              {errors.address_state && (
                <p className="text-sm text-destructive">{errors.address_state.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address_postal_code">Postal Code</Label>
              <Input
                id="address_postal_code"
                {...register('address_postal_code')}
                placeholder="94105"
              />
              {errors.address_postal_code && (
                <p className="text-sm text-destructive">{errors.address_postal_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_country">Country</Label>
              <Input
                id="address_country"
                {...register('address_country')}
                placeholder="United States"
              />
              {errors.address_country && (
                <p className="text-sm text-destructive">{errors.address_country.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              {...register('timezone')}
              placeholder="America/Los_Angeles"
            />
            {errors.timezone && (
              <p className="text-sm text-destructive">{errors.timezone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : person ? 'Save Changes' : 'Create Person'}
        </Button>
      </div>

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
            onSuccess?.();
          }}
          isCreating={isLoading}
        />
      )}
    </form>
  );
}
