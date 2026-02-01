'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { rfpSchema, type CreateRfpInput } from '@/lib/validators/rfp';
import { STATUS_LABELS, RFP_STATUSES } from '@/types/rfp';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface AddRfpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onRfpAdded: () => void;
}

export function AddRfpDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onRfpAdded,
}: AddRfpDialogProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRfpInput>({
    resolver: zodResolver(rfpSchema),
    defaultValues: {
      title: '',
      status: 'identified',
      currency: 'USD',
    },
  });

  const currentStatus = watch('status');

  const onSubmit = async (data: CreateRfpInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const cleanedData = {
        ...data,
        organization_id: organizationId,
        estimated_value: data.estimated_value || null,
        due_date: data.due_date || null,
      };

      const response = await fetch(`/api/projects/${projectSlug}/rfps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create RFP');
      }

      reset();
      onOpenChange(false);
      onRfpAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFP');
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
          <DialogTitle>Add RFP for {organizationName}</DialogTitle>
          <DialogDescription>
            Track a new Request for Proposal linked to this organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rfp-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rfp-title"
              {...register('title')}
              placeholder="IT Infrastructure Modernization RFP"
              autoFocus
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rfp-status">Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(value) => setValue('status', value as CreateRfpInput['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {RFP_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfp-rfp_number">RFP Number</Label>
              <Input
                id="rfp-rfp_number"
                {...register('rfp_number')}
                placeholder="RFP-2024-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfp-due_date">Due Date</Label>
            <Input
              id="rfp-due_date"
              type="datetime-local"
              {...register('due_date')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rfp-estimated_value">Estimated Value</Label>
              <Input
                id="rfp-estimated_value"
                type="number"
                step="0.01"
                min="0"
                {...register('estimated_value', { valueAsNumber: true })}
                placeholder="500000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfp-currency">Currency</Label>
              <Input
                id="rfp-currency"
                {...register('currency')}
                placeholder="USD"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Add RFP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
