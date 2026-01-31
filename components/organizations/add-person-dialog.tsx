'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { createPersonSchema, type CreatePersonInput } from '@/lib/validators/person';
import { createPerson } from '@/stores/person';
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
import { useState } from 'react';

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onPersonAdded: () => void;
}

export function AddPersonDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onPersonAdded,
}: AddPersonDialogProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      job_title: '',
    },
  });

  const onSubmit = async (data: CreatePersonInput) => {
    setIsLoading(true);
    setError(null);
    try {
      await createPerson(projectSlug, {
        ...data,
        organization_id: organizationId,
      });
      reset();
      onOpenChange(false);
      onPersonAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create person');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Person to {organizationName}</DialogTitle>
          <DialogDescription>
            Create a new contact for this organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-first_name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-first_name"
                  {...register('first_name')}
                  placeholder="John"
                  autoFocus
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-last_name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-last_name"
                  {...register('last_name')}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                {...register('email')}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-job_title">Job Title</Label>
              <Input
                id="add-job_title"
                {...register('job_title')}
                placeholder="Senior Engineer"
              />
              {errors.job_title && (
                <p className="text-sm text-destructive">{errors.job_title.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Add Person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
