'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRfps } from '@/hooks/use-rfps';
import { rfpSchema, type CreateRfpInput } from '@/lib/validators/rfp';
import { STATUS_LABELS, RFP_STATUSES, type Rfp } from '@/types/rfp';
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

interface RfpFormProps {
  rfp?: Rfp;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RfpForm({ rfp, onSuccess, onCancel }: RfpFormProps) {
  const { create, update, isLoading } = useRfps();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRfpInput>({
    resolver: zodResolver(rfpSchema),
    defaultValues: {
      title: rfp?.title ?? '',
      description: rfp?.description ?? '',
      status: rfp?.status ?? 'identified',
      rfp_number: rfp?.rfp_number ?? '',
      currency: rfp?.currency ?? 'USD',
      estimated_value: rfp?.estimated_value ?? undefined,
      budget_range: rfp?.budget_range ?? '',
      issue_date: rfp?.issue_date ?? '',
      due_date: rfp?.due_date ? rfp.due_date.split('T')[0] : '',
      questions_due_date: rfp?.questions_due_date ? rfp.questions_due_date.split('T')[0] : '',
      decision_date: rfp?.decision_date ?? '',
      submission_method: rfp?.submission_method as CreateRfpInput['submission_method'] ?? undefined,
      submission_portal_url: rfp?.submission_portal_url ?? '',
      submission_email: rfp?.submission_email ?? '',
      submission_instructions: rfp?.submission_instructions ?? '',
      win_probability: rfp?.win_probability ?? undefined,
      go_no_go_decision: rfp?.go_no_go_decision as CreateRfpInput['go_no_go_decision'] ?? undefined,
      go_no_go_date: rfp?.go_no_go_date ?? '',
      go_no_go_notes: rfp?.go_no_go_notes ?? '',
      outcome_reason: rfp?.outcome_reason ?? '',
      feedback: rfp?.feedback ?? '',
      awarded_to: rfp?.awarded_to ?? '',
      rfp_document_url: rfp?.rfp_document_url ?? '',
      response_document_url: rfp?.response_document_url ?? '',
    },
  });

  const currentStatus = watch('status');
  const currentGoNoGo = watch('go_no_go_decision');
  const currentSubmissionMethod = watch('submission_method');

  const onSubmit = async (data: CreateRfpInput) => {
    try {
      // Clean up empty strings to null for optional fields
      const cleanedData = {
        ...data,
        estimated_value: data.estimated_value || null,
        win_probability: data.win_probability || null,
        issue_date: data.issue_date || null,
        due_date: data.due_date || null,
        questions_due_date: data.questions_due_date || null,
        decision_date: data.decision_date || null,
        go_no_go_date: data.go_no_go_date || null,
        rfp_number: data.rfp_number || null,
        budget_range: data.budget_range || null,
        submission_portal_url: data.submission_portal_url || null,
        submission_email: data.submission_email || null,
        submission_instructions: data.submission_instructions || null,
        go_no_go_notes: data.go_no_go_notes || null,
        outcome_reason: data.outcome_reason || null,
        feedback: data.feedback || null,
        awarded_to: data.awarded_to || null,
        rfp_document_url: data.rfp_document_url || null,
        response_document_url: data.response_document_url || null,
      };

      if (rfp) {
        await update(rfp.id, cleanedData);
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Details about this RFP..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                {...register('issue_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                {...register('due_date')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="questions_due_date">Questions Due Date</Label>
              <Input
                id="questions_due_date"
                type="datetime-local"
                {...register('questions_due_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="decision_date">Decision Date</Label>
              <Input
                id="decision_date"
                type="date"
                {...register('decision_date')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Value & Probability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
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

            <div className="space-y-2">
              <Label htmlFor="win_probability">Win Probability (%)</Label>
              <Input
                id="win_probability"
                type="number"
                min="0"
                max="100"
                {...register('win_probability', { valueAsNumber: true })}
                placeholder="50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_range">Budget Range</Label>
            <Input
              id="budget_range"
              {...register('budget_range')}
              placeholder="$500K - $750K"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="submission_method">Submission Method</Label>
              <Select
                value={currentSubmissionMethod ?? ''}
                onValueChange={(value) => setValue('submission_method', value as CreateRfpInput['submission_method'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="submission_email">Submission Email</Label>
              <Input
                id="submission_email"
                type="email"
                {...register('submission_email')}
                placeholder="rfps@organization.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="submission_portal_url">Submission Portal URL</Label>
            <Input
              id="submission_portal_url"
              type="url"
              {...register('submission_portal_url')}
              placeholder="https://portal.organization.com/rfp"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="submission_instructions">Submission Instructions</Label>
            <Textarea
              id="submission_instructions"
              {...register('submission_instructions')}
              placeholder="Specific instructions for submission..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Go/No-Go Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="go_no_go_decision">Decision</Label>
              <Select
                value={currentGoNoGo ?? ''}
                onValueChange={(value) => setValue('go_no_go_decision', value as CreateRfpInput['go_no_go_decision'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="no_go">No Go</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="go_no_go_date">Decision Date</Label>
              <Input
                id="go_no_go_date"
                type="date"
                {...register('go_no_go_date')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="go_no_go_notes">Decision Notes</Label>
            <Textarea
              id="go_no_go_notes"
              {...register('go_no_go_notes')}
              placeholder="Notes about the go/no-go decision..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rfp_document_url">RFP Document URL</Label>
            <Input
              id="rfp_document_url"
              type="url"
              {...register('rfp_document_url')}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="response_document_url">Response Document URL</Label>
            <Input
              id="response_document_url"
              type="url"
              {...register('response_document_url')}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {(currentStatus === 'won' || currentStatus === 'lost') && (
        <Card>
          <CardHeader>
            <CardTitle>Outcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outcome_reason">Outcome Reason</Label>
              <Textarea
                id="outcome_reason"
                {...register('outcome_reason')}
                placeholder="Why was this RFP won/lost?"
                rows={3}
              />
            </div>

            {currentStatus === 'lost' && (
              <div className="space-y-2">
                <Label htmlFor="awarded_to">Awarded To</Label>
                <Input
                  id="awarded_to"
                  {...register('awarded_to')}
                  placeholder="Name of winning vendor"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                {...register('feedback')}
                placeholder="Any feedback received..."
                rows={3}
              />
            </div>
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
          {isLoading ? 'Saving...' : rfp ? 'Save Changes' : 'Create RFP'}
        </Button>
      </div>
    </form>
  );
}
