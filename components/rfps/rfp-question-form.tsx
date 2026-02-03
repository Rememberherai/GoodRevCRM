'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRfpQuestions } from '@/hooks/use-rfp-questions';
import { createRfpQuestionSchema, type CreateRfpQuestionInput } from '@/lib/validators/rfp-question';
import type { z } from 'zod';

type FormInput = z.input<typeof createRfpQuestionSchema>;
import {
  QUESTION_STATUS_LABELS,
  RFP_QUESTION_STATUSES,
  QUESTION_PRIORITIES,
  PRIORITY_LABELS,
} from '@/types/rfp-question';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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

interface RfpQuestionFormProps {
  rfpId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function RfpQuestionForm({ rfpId, open, onOpenChange, onCreated }: RfpQuestionFormProps) {
  const { create } = useRfpQuestions(rfpId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(createRfpQuestionSchema),
    defaultValues: {
      question_text: '',
      section_name: '',
      question_number: '',
      status: 'unanswered',
      priority: undefined,
      notes: '',
    },
  });

  const onSubmit = async (data: FormInput) => {
    try {
      // zodResolver applies defaults, so status is always set after validation
      await create(data as CreateRfpQuestionInput);
      reset();
      onCreated();
    } catch {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="question_text">Question Text *</Label>
            <Textarea
              id="question_text"
              {...register('question_text')}
              placeholder="Enter the RFP question or requirement..."
              rows={3}
              className="mt-1"
            />
            {errors.question_text && (
              <p className="text-sm text-destructive mt-1">{errors.question_text.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="section_name">Section</Label>
              <Input
                id="section_name"
                {...register('section_name')}
                placeholder="e.g., Technical Requirements"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="question_number">Question Number</Label>
              <Input
                id="question_number"
                {...register('question_number')}
                placeholder="e.g., 3.2.1"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as FormInput['status'])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RFP_QUESTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {QUESTION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={watch('priority') ?? 'none'}
                onValueChange={(v) => setValue('priority', v === 'none' ? undefined : v as FormInput['priority'])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {QUESTION_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Internal notes..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Question'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
