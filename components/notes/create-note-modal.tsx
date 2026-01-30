'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const createNoteFormSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
  is_pinned: z.boolean(),
});

type CreateNoteFormData = z.infer<typeof createNoteFormSchema>;

interface CreateNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
  rfpId?: string;
  onSuccess?: () => void;
}

export function CreateNoteModal({
  open,
  onOpenChange,
  projectSlug,
  personId,
  organizationId,
  opportunityId,
  rfpId,
  onSuccess,
}: CreateNoteModalProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<CreateNoteFormData>({
    resolver: zodResolver(createNoteFormSchema),
    defaultValues: {
      content: '',
      is_pinned: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        content: '',
        is_pinned: false,
      });
    }
  }, [open, form]);

  const onSubmit = async (data: CreateNoteFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          person_id: personId,
          organization_id: organizationId,
          opportunity_id: opportunityId,
          rfp_id: rfpId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to create note');
      }

      toast.success('Note added successfully');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Add a note to keep track of important information
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your note..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_pinned"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Pin this note</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Note'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
