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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

  const submitWithOptions = async (data: CreatePersonInput, forceCreate = false) => {
    try {
      await create({ ...data, force_create: forceCreate });
      reset();
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
      <DialogContent className="sm:max-w-[500px]">
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
            onOpenChange(false);
          }}
          isCreating={isLoading}
        />
      )}
    </Dialog>
  );
}
