'use client';

import { useState } from 'react';
import { useRfpQuestions } from '@/hooks/use-rfp-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CreateRfpQuestionInput } from '@/lib/validators/rfp-question';

interface RfpQuestionsBulkAddProps {
  rfpId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function RfpQuestionsBulkAdd({
  rfpId,
  open,
  onOpenChange,
  onCreated,
}: RfpQuestionsBulkAddProps) {
  const { bulkCreate } = useRfpQuestions(rfpId);
  const [text, setText] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseQuestions = (rawText: string): CreateRfpQuestionInput[] => {
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      // Try to detect question number prefix (e.g., "3.2.1 What is your...")
      const match = line.match(/^([\d.]+)\s+(.+)$/);
      if (match) {
        return {
          question_text: match[2]!,
          question_number: match[1]!,
          section_name: sectionName || null,
          status: 'unanswered' as const,
        };
      }

      // Try numbered list (e.g., "1. What is your..." or "1) What is your...")
      const numberedMatch = line.match(/^\d+[.)]\s*(.+)$/);
      if (numberedMatch) {
        return {
          question_text: numberedMatch[1]!,
          section_name: sectionName || null,
          status: 'unanswered' as const,
        };
      }

      // Plain text
      return {
        question_text: line,
        section_name: sectionName || null,
        status: 'unanswered' as const,
      };
    });
  };

  const parsedQuestions = text.trim() ? parseQuestions(text) : [];

  const handleSubmit = async () => {
    if (parsedQuestions.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await bulkCreate(parsedQuestions);
      setText('');
      setSectionName('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add questions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Add Questions</DialogTitle>
          <DialogDescription>
            Paste multiple questions, one per line. Numbered prefixes (e.g., &quot;3.2.1&quot;) will be
            detected as question numbers automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="section">Section Name (optional)</Label>
            <Input
              id="section"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g., Technical Requirements"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="questions">Questions (one per line)</Label>
            <Textarea
              id="questions"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`3.2.1 Describe your approach to data encryption at rest
3.2.2 What compliance certifications do you hold?
3.2.3 Describe your disaster recovery plan`}
              rows={12}
              className="mt-1 font-mono text-sm"
            />
          </div>

          {parsedQuestions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {parsedQuestions.length} question{parsedQuestions.length !== 1 ? 's' : ''} detected
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || parsedQuestions.length === 0}
            >
              {isSubmitting
                ? 'Adding...'
                : `Add ${parsedQuestions.length} Question${parsedQuestions.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
