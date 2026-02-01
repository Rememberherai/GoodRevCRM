'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { opportunitySchema, type CreateOpportunityInput } from '@/lib/validators/opportunity';
import { STAGE_LABELS, OPPORTUNITY_STAGES } from '@/types/opportunity';
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

interface AddOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onOpportunityAdded: () => void;
}

export function AddOpportunityDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onOpportunityAdded,
}: AddOpportunityDialogProps) {
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
  } = useForm<CreateOpportunityInput>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: '',
      stage: 'prospecting',
      currency: 'USD',
    },
  });

  const currentStage = watch('stage');

  const onSubmit = async (data: CreateOpportunityInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const cleanedData = {
        ...data,
        organization_id: organizationId,
        amount: data.amount || null,
        probability: data.probability || null,
        expected_close_date: data.expected_close_date || null,
      };

      const response = await fetch(`/api/projects/${projectSlug}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create opportunity');
      }

      reset();
      onOpenChange(false);
      onOpportunityAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create opportunity');
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
          <DialogTitle>Add Opportunity for {organizationName}</DialogTitle>
          <DialogDescription>
            Create a new opportunity linked to this organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="opp-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="opp-name"
              {...register('name')}
              placeholder="Enterprise Deal"
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opp-stage">Stage</Label>
              <Select
                value={currentStage}
                onValueChange={(value) => setValue('stage', value as CreateOpportunityInput['stage'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opp-probability">Probability (%)</Label>
              <Input
                id="opp-probability"
                type="number"
                min="0"
                max="100"
                {...register('probability', { valueAsNumber: true })}
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opp-amount">Amount</Label>
              <Input
                id="opp-amount"
                type="number"
                step="0.01"
                min="0"
                {...register('amount', { valueAsNumber: true })}
                placeholder="100000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opp-currency">Currency</Label>
              <Input
                id="opp-currency"
                {...register('currency')}
                placeholder="USD"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-expected_close_date">Expected Close Date</Label>
            <Input
              id="opp-expected_close_date"
              type="date"
              {...register('expected_close_date')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Add Opportunity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
