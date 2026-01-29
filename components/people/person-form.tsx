'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePeople } from '@/hooks/use-people';
import { personSchema, type CreatePersonInput } from '@/lib/validators/person';
import type { Person } from '@/types/person';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PersonFormProps {
  person?: Person;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PersonForm({ person, onSuccess, onCancel }: PersonFormProps) {
  const { create, update, isLoading } = usePeople();

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

  const onSubmit = async (data: CreatePersonInput) => {
    try {
      if (person) {
        await update(person.id, data);
      } else {
        await create(data);
      }
      onSuccess?.();
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
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
    </form>
  );
}
