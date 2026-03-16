'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { createPersonSchema, type CreatePersonInput } from '@/lib/validators/person';
import { createPerson, DuplicateDetectedError } from '@/stores/person';
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
import { useEmailValidation } from '@/hooks/use-email-validation';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DuplicateInterceptModal } from '@/components/deduplication/duplicate-intercept-modal';
import type { DetectionMatch } from '@/types/deduplication';

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
  const { validate: validateEmail, validating: emailValidating, result: emailResult, clear: clearEmailValidation } = useEmailValidation();
  const [duplicateMatches, setDuplicateMatches] = useState<DetectionMatch[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<CreatePersonInput | null>(null);

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

  const onSubmit = async (data: CreatePersonInput, forceCreate = false) => {
    setIsLoading(true);
    setError(null);
    try {
      await createPerson(projectSlug, {
        ...data,
        organization_id: organizationId,
        ...(forceCreate ? { force_create: true } : {}),
      });
      reset();
      setDuplicateMatches(null);
      setPendingFormData(null);
      onOpenChange(false);
      onPersonAdded();
    } catch (err) {
      if (err instanceof DuplicateDetectedError) {
        setDuplicateMatches(err.matches);
        setPendingFormData(data);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create person');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setDuplicateMatches(null);
    setPendingFormData(null);
    clearEmailValidation();
    onOpenChange(false);
  };

  const emailRegister = register('email');
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    emailRegister.onBlur(e);
    validateEmail(e.target.value);
  };

  if (duplicateMatches && pendingFormData) {
    return (
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
          onSubmit(pendingFormData, true);
        }}
        onMerged={() => {
          setDuplicateMatches(null);
          setPendingFormData(null);
          reset();
          onOpenChange(false);
          onPersonAdded();
        }}
        isCreating={isLoading}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Person to {organizationName}</DialogTitle>
          <DialogDescription>
            Create a new contact for this organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => onSubmit(data))}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <div className="relative">
                  <Input
                    id="add-email"
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
                <Label htmlFor="add-phone">Phone</Label>
                <Input
                  id="add-phone"
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
