'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { useOrganizations } from '@/hooks/use-organizations';
import { DuplicateDetectedError } from '@/stores/organization';
import { DuplicateInterceptModal } from '@/components/deduplication/duplicate-intercept-modal';
import { createOrganizationSchema, type CreateOrganizationInput } from '@/lib/validators/organization';
import type { DetectionMatch } from '@/types/deduplication';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractDomain(url: string): string {
  try {
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }
    const hostname = new URL(fullUrl).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function NewOrganizationDialog({ open, onOpenChange }: NewOrganizationDialogProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const { create, isLoading } = useOrganizations();
  const [duplicateMatches, setDuplicateMatches] = useState<DetectionMatch[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<(CreateOrganizationInput & { domain?: string }) | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      industry: '',
      website: '',
    },
  });

  const submitWithOptions = async (data: CreateOrganizationInput, forceCreate = false) => {
    try {
      // Auto-extract domain from website
      const domain = data.website ? extractDomain(data.website) : undefined;
      await create({ ...data, domain, force_create: forceCreate });
      reset();
      setDuplicateMatches(null);
      setPendingFormData(null);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DuplicateDetectedError) {
        const domain = data.website ? extractDomain(data.website) : undefined;
        setDuplicateMatches(err.matches);
        setPendingFormData({ ...data, domain });
      }
      // Other errors handled by the hook
    }
  };

  const onSubmit = async (data: CreateOrganizationInput) => {
    await submitWithOptions(data);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Organization</DialogTitle>
          <DialogDescription>
            Create a new organization. You can add more details after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-name"
                {...register('name')}
                placeholder="Acme Corp"
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-website">Website</Label>
                <Input
                  id="new-website"
                  {...register('website')}
                  placeholder="acme.com"
                />
                {errors.website && (
                  <p className="text-sm text-destructive">{errors.website.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-industry">Industry</Label>
                <Input
                  id="new-industry"
                  {...register('industry')}
                  placeholder="Technology"
                />
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry.message}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Organization'}
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
          entityType="organization"
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
            onOpenChange(false);
          }}
          isCreating={isLoading}
        />
      )}
    </Dialog>
  );
}
