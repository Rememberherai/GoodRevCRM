'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createReportSchema, type CreateReportInput } from '@/lib/validators/report';
import { reportTypeLabels, type ReportType } from '@/types/report';

interface SaveReportDialogProps {
  projectSlug: string;
  defaultReportType?: ReportType;
  onSaved?: () => void;
  children?: React.ReactNode;
}

export function SaveReportDialog({
  projectSlug,
  defaultReportType = 'custom',
  onSaved,
  children,
}: SaveReportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const form = useForm<CreateReportInput>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      name: '',
      description: '',
      report_type: defaultReportType,
      is_public: false,
      schedule: null,
    },
  });

  async function onSubmit(data: CreateReportInput) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save report');
      }

      toast.success('Report saved successfully');
      setOpen(false);
      form.reset();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
            <DialogDescription>
              Save this report configuration for quick access later
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 Pipeline Review"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="A brief description..."
                {...form.register('description')}
              />
            </div>

            <div className="grid gap-2">
              <Label>Report Type</Label>
              <Select
                value={form.watch('report_type')}
                onValueChange={(v) => form.setValue('report_type', v as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Schedule (optional)</Label>
              <Select
                value={form.watch('schedule') ?? '__none__'}
                onValueChange={(v) =>
                  form.setValue('schedule', v === '__none__' ? null : (v as 'daily' | 'weekly' | 'monthly' | 'quarterly'))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No schedule</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={form.watch('is_public') ?? false}
                onChange={(e) => form.setValue('is_public', e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="is_public">Make public to team</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
