'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRfps } from '@/hooks/use-rfps';
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
import { OrganizationCombobox } from '@/components/ui/organization-combobox';

interface NewRfpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRfpDialog({ open, onOpenChange }: NewRfpDialogProps) {
  const { create, isLoading } = useRfps();

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
      organization_id: null,
    },
  });

  const currentStatus = watch('status');
  const organizationId = watch('organization_id');

  const onSubmit = async (data: CreateRfpInput) => {
    try {
      // Clean up empty strings and NaN to null for optional fields
      const cleanedData = {
        ...data,
        estimated_value: data.estimated_value || null,
        due_date: data.due_date || null,
        organization_id: data.organization_id || null,
      };

      await create(cleanedData);
      reset();
      onOpenChange(false);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New RFP</DialogTitle>
          <DialogDescription>
            Track a new Request for Proposal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="IT Infrastructure Modernization RFP"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Organization</Label>
            <OrganizationCombobox
              value={organizationId ?? null}
              onValueChange={(value) => setValue('organization_id', value)}
              placeholder="Select organization (optional)"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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
              <Label htmlFor="rfp_number">RFP Number</Label>
              <Input
                id="rfp_number"
                {...register('rfp_number')}
                placeholder="RFP-2024-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="datetime-local"
              {...register('due_date')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="estimated_value">Estimated Value</Label>
              <Input
                id="estimated_value"
                type="number"
                step="0.01"
                min="0"
                {...register('estimated_value', { valueAsNumber: true })}
                placeholder="500000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
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
              {isLoading ? 'Creating...' : 'Create RFP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
