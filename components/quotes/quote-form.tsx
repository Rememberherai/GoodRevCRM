'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';
import type { Quote } from '@/types/quote';

interface QuoteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => Promise<Quote>;
  quote?: Quote | null;
}

export function QuoteForm({ open, onOpenChange, onSave, quote }: QuoteFormProps) {
  const [title, setTitle] = useState(quote?.title ?? '');
  const [quoteNumber, setQuoteNumber] = useState(quote?.quote_number ?? '');
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? '');
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(quote?.title ?? '');
    setQuoteNumber(quote?.quote_number ?? '');
    setValidUntil(quote?.valid_until ?? '');
    setNotes(quote?.notes ?? '');
  }, [open, quote]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setIsSaving(true);
    try {
      const data: Record<string, unknown> = { title: title.trim() };
      if (quoteNumber.trim()) data.quote_number = quoteNumber.trim();
      if (validUntil) data.valid_until = validUntil;
      if (notes.trim()) data.notes = notes.trim();
      await onSave(data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{quote ? 'Edit Quote' : 'New Quote'}</DialogTitle>
          <DialogDescription>
            {quote ? 'Update quote details.' : 'Create a new quote for this opportunity.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="quote-title">Title *</Label>
            <Input
              id="quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Enterprise License Quote"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quote-number">Quote Number</Label>
              <Input
                id="quote-number"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="e.g., Q-2026-001"
              />
            </div>
            <div>
              <Label htmlFor="quote-valid">Valid Until</Label>
              <Input
                id="quote-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="quote-notes">Notes</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {quote ? 'Save Changes' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
