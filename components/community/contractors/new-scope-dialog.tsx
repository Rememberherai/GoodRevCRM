'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  contractorId: string;
  onCreated?: () => void;
}

export function NewScopeDialog({ open, onOpenChange, projectSlug, contractorId, onCreated }: NewScopeDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceCategories, setServiceCategories] = useState('');
  const [compensationTerms, setCompensationTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/contractor-scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          title: title.trim(),
          description: description.trim() || null,
          service_categories: serviceCategories
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          compensation_terms: compensationTerms.trim() || null,
        }),
      });

      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to create scope');

      toast.success('Scope created');
      setTitle('');
      setDescription('');
      setServiceCategories('');
      setCompensationTerms('');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create scope');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Contractor Scope</DialogTitle>
          <DialogDescription>
            Define the scope of work, service categories, and compensation terms.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scope-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scope-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. General Plumbing Services"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-description">Description</Label>
              <Textarea
                id="scope-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope of work..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-categories">Service Categories</Label>
              <Input
                id="scope-categories"
                value={serviceCategories}
                onChange={(e) => setServiceCategories(e.target.value)}
                placeholder="plumbing, electrical, hvac (comma-separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-compensation">Compensation Terms</Label>
              <Input
                id="scope-compensation"
                value={compensationTerms}
                onChange={(e) => setCompensationTerms(e.target.value)}
                placeholder="e.g. $45/hr, Net 30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Scope'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
