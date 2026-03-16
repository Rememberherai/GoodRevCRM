'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import type { DetectionMatch, DeduplicationEntityType, MatchReason } from '@/types/deduplication';

interface DuplicateInterceptModalProps {
  open: boolean;
  onClose: () => void;
  entityType: DeduplicationEntityType;
  matches: DetectionMatch[];
  pendingRecord: Record<string, unknown>;
  projectSlug: string;
  onCreateAnyway: () => void;
  onMerged?: () => void;
  isCreating?: boolean;
}

export function DuplicateInterceptModal({
  open,
  onClose,
  entityType,
  matches,
  pendingRecord,
  projectSlug,
  onCreateAnyway,
  onMerged,
  isCreating = false,
}: DuplicateInterceptModalProps) {
  const [merging, setMerging] = useState<string | null>(null);

  const getDisplayName = (record: Record<string, unknown>): string => {
    if (entityType === 'person') {
      return [record.first_name, record.last_name].filter(Boolean).join(' ') || 'Unknown';
    }
    return (record.name as string) || 'Unknown';
  };

  const getSubtext = (record: Record<string, unknown>): string => {
    if (entityType === 'person') {
      const parts = [record.email, record.job_title].filter(Boolean);
      return parts.join(' - ');
    }
    return [record.domain, record.industry].filter(Boolean).join(' - ');
  };

  const handleUpdateExisting = async (match: DetectionMatch) => {
    // The pending record hasn't been created yet, so we can't do a full merge.
    // Instead, update the existing record with non-empty fields from the pending record.
    setMerging(match.target_id);
    try {
      const table = entityType === 'person' ? 'people' : 'organizations';
      const res = await fetch(`/api/projects/${projectSlug}/${table}/${match.target_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingRecord),
      });
      if (res.ok) {
        onMerged?.();
        onClose();
      }
    } finally {
      setMerging(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Potential Duplicates Found</DialogTitle>
          <DialogDescription>
            We found {matches.length} existing record{matches.length !== 1 ? 's' : ''} that may match
            the {entityType} you&apos;re creating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {matches.map((match) => (
            <div
              key={match.target_id}
              className="border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{getDisplayName(match.record)}</p>
                  <p className="text-sm text-muted-foreground truncate">{getSubtext(match.record)}</p>
                </div>
                <Badge variant={match.score >= 0.85 ? 'destructive' : 'secondary'}>
                  {Math.round(match.score * 100)}% match
                </Badge>
              </div>
              <Progress value={match.score * 100} className="h-1.5" />
              <div className="flex flex-wrap gap-1">
                {match.reasons.map((reason: MatchReason, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {reason.field}
                  </Badge>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleUpdateExisting(match)}
                disabled={merging === match.target_id}
              >
                {merging === match.target_id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Existing Record
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onCreateAnyway} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
