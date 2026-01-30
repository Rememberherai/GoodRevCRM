'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, type CreateOrganizationInput } from '@/lib/validators/organization';
import {
  createOrganization,
  updateOrganizationApi,
  useOrganizationStore,
} from '@/stores/organization';
import type { Organization } from '@/types/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface OrganizationFormProps {
  organization?: Organization;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function OrganizationForm({ organization, onSuccess, onCancel }: OrganizationFormProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addOrganization = useOrganizationStore((s) => s.addOrganization);
  const updateOrganizationInStore = useOrganizationStore((s) => s.updateOrganization);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization?.name ?? '',
      domain: organization?.domain ?? '',
      website: organization?.website ?? '',
      industry: organization?.industry ?? '',
      employee_count: organization?.employee_count ?? undefined,
      annual_revenue: organization?.annual_revenue ?? undefined,
      description: organization?.description ?? '',
      logo_url: organization?.logo_url ?? '',
      linkedin_url: organization?.linkedin_url ?? '',
      phone: organization?.phone ?? '',
      address_street: organization?.address_street ?? '',
      address_city: organization?.address_city ?? '',
      address_state: organization?.address_state ?? '',
      address_postal_code: organization?.address_postal_code ?? '',
      address_country: organization?.address_country ?? '',
    },
  });

  const onSubmit = async (data: CreateOrganizationInput) => {
    setIsLoading(true);
    setError(null);
    try {
      if (organization) {
        const updated = await updateOrganizationApi(projectSlug, organization.id, data);
        updateOrganizationInStore(organization.id, updated);
      } else {
        const created = await createOrganization(projectSlug, data);
        addOrganization(created);
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
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
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Acme Corp"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                {...register('domain')}
                placeholder="acme.com"
              />
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                {...register('industry')}
                placeholder="Technology"
              />
              {errors.industry && (
                <p className="text-sm text-destructive">{errors.industry.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                {...register('website')}
                placeholder="https://acme.com"
              />
              {errors.website && (
                <p className="text-sm text-destructive">{errors.website.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Brief description of the organization..."
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee_count">Employee Count</Label>
              <Input
                id="employee_count"
                type="number"
                {...register('employee_count', { valueAsNumber: true })}
                placeholder="100"
              />
              {errors.employee_count && (
                <p className="text-sm text-destructive">{errors.employee_count.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="annual_revenue">Annual Revenue ($)</Label>
              <Input
                id="annual_revenue"
                type="number"
                {...register('annual_revenue', { valueAsNumber: true })}
                placeholder="1000000"
              />
              {errors.annual_revenue && (
                <p className="text-sm text-destructive">{errors.annual_revenue.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                type="url"
                {...register('logo_url')}
                placeholder="https://example.com/logo.png"
              />
              {errors.logo_url && (
                <p className="text-sm text-destructive">{errors.logo_url.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                type="url"
                {...register('linkedin_url')}
                placeholder="https://linkedin.com/company/acme"
              />
              {errors.linkedin_url && (
                <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="address_street">Street Address</Label>
            <Input
              id="address_street"
              {...register('address_street')}
              placeholder="123 Main Street"
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
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : organization ? 'Save Changes' : 'Create Organization'}
        </Button>
      </div>
    </form>
  );
}
