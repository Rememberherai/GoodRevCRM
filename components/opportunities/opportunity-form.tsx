'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOpportunities } from '@/hooks/use-opportunities';
import { opportunitySchema, type CreateOpportunityInput } from '@/lib/validators/opportunity';
import { STAGE_LABELS, OPPORTUNITY_STAGES, type Opportunity } from '@/types/opportunity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OpportunityFormProps {
  opportunity?: Opportunity;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function OpportunityForm({ opportunity, onSuccess, onCancel }: OpportunityFormProps) {
  const { create, update, isLoading } = useOpportunities();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOpportunityInput>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: opportunity?.name ?? '',
      description: opportunity?.description ?? '',
      stage: opportunity?.stage ?? 'prospecting',
      amount: opportunity?.amount ?? undefined,
      currency: opportunity?.currency ?? 'USD',
      probability: opportunity?.probability ?? undefined,
      expected_close_date: opportunity?.expected_close_date ?? '',
      actual_close_date: opportunity?.actual_close_date ?? '',
      organization_id: opportunity?.organization_id ?? undefined,
      primary_contact_id: opportunity?.primary_contact_id ?? undefined,
      lost_reason: opportunity?.lost_reason ?? '',
      won_reason: opportunity?.won_reason ?? '',
      competitor: opportunity?.competitor ?? '',
      source: opportunity?.source ?? '',
      campaign: opportunity?.campaign ?? '',
    },
  });

  const currentStage = watch('stage');

  const onSubmit = async (data: CreateOpportunityInput) => {
    try {
      // Clean up empty strings to null for optional fields
      const cleanedData = {
        ...data,
        amount: data.amount || null,
        probability: data.probability || null,
        expected_close_date: data.expected_close_date || null,
        actual_close_date: data.actual_close_date || null,
        organization_id: data.organization_id || null,
        primary_contact_id: data.primary_contact_id || null,
        lost_reason: data.lost_reason || null,
        won_reason: data.won_reason || null,
        competitor: data.competitor || null,
        source: data.source || null,
        campaign: data.campaign || null,
      };

      if (opportunity) {
        await update(opportunity.id, cleanedData);
      } else {
        await create(cleanedData);
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
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enterprise Deal - Acme Corp"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Details about this opportunity..."
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
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
              {errors.stage && (
                <p className="text-sm text-destructive">{errors.stage.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                {...register('probability', { valueAsNumber: true })}
                placeholder="50"
              />
              {errors.probability && (
                <p className="text-sm text-destructive">{errors.probability.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deal Value</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                {...register('amount', { valueAsNumber: true })}
                placeholder="100000"
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                {...register('currency')}
                placeholder="USD"
              />
              {errors.currency && (
                <p className="text-sm text-destructive">{errors.currency.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expected_close_date">Expected Close Date</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...register('expected_close_date')}
              />
              {errors.expected_close_date && (
                <p className="text-sm text-destructive">{errors.expected_close_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual_close_date">Actual Close Date</Label>
              <Input
                id="actual_close_date"
                type="date"
                {...register('actual_close_date')}
              />
              {errors.actual_close_date && (
                <p className="text-sm text-destructive">{errors.actual_close_date.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                {...register('source')}
                placeholder="Referral, Website, Trade Show..."
              />
              {errors.source && (
                <p className="text-sm text-destructive">{errors.source.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Input
                id="campaign"
                {...register('campaign')}
                placeholder="Q1 Outbound, Product Launch..."
              />
              {errors.campaign && (
                <p className="text-sm text-destructive">{errors.campaign.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitor">Competitor</Label>
            <Input
              id="competitor"
              {...register('competitor')}
              placeholder="Main competitor for this deal..."
            />
            {errors.competitor && (
              <p className="text-sm text-destructive">{errors.competitor.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {(currentStage === 'closed_won' || currentStage === 'closed_lost') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStage === 'closed_won' ? 'Won Details' : 'Lost Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStage === 'closed_won' && (
              <div className="space-y-2">
                <Label htmlFor="won_reason">Won Reason</Label>
                <Textarea
                  id="won_reason"
                  {...register('won_reason')}
                  placeholder="Why did we win this deal?"
                  rows={3}
                />
                {errors.won_reason && (
                  <p className="text-sm text-destructive">{errors.won_reason.message}</p>
                )}
              </div>
            )}

            {currentStage === 'closed_lost' && (
              <div className="space-y-2">
                <Label htmlFor="lost_reason">Lost Reason</Label>
                <Textarea
                  id="lost_reason"
                  {...register('lost_reason')}
                  placeholder="Why did we lose this deal?"
                  rows={3}
                />
                {errors.lost_reason && (
                  <p className="text-sm text-destructive">{errors.lost_reason.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : opportunity ? 'Save Changes' : 'Create Opportunity'}
        </Button>
      </div>
    </form>
  );
}
