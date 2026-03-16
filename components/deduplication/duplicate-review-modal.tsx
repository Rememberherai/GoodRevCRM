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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { MatchReason, DeduplicationEntityType } from '@/types/deduplication';

interface DuplicateReviewModalProps {
  open: boolean;
  onClose: () => void;
  entityType: DeduplicationEntityType;
  sourceRecord: Record<string, unknown>;
  targetRecord: Record<string, unknown>;
  matchScore: number;
  matchReasons: MatchReason[];
  candidateId?: string;
  projectSlug: string;
  onResolved?: () => void;
}

const PERSON_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'mobile_phone', label: 'Mobile Phone' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'department', label: 'Department' },
  { key: 'linkedin_url', label: 'LinkedIn' },
];

const ORG_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'domain', label: 'Domain' },
  { key: 'website', label: 'Website' },
  { key: 'industry', label: 'Industry' },
  { key: 'phone', label: 'Phone' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'address_street', label: 'Street' },
  { key: 'address_city', label: 'City' },
  { key: 'address_state', label: 'State' },
  { key: 'address_country', label: 'Country' },
];

export function DuplicateReviewModal({
  open,
  onClose,
  entityType,
  sourceRecord,
  targetRecord,
  matchScore,
  matchReasons,
  candidateId,
  projectSlug,
  onResolved,
}: DuplicateReviewModalProps) {
  const [survivorId, setSurvivorId] = useState<string>(targetRecord.id as string);
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fields = entityType === 'person' ? PERSON_FIELDS : ORG_FIELDS;
  const scorePercent = Math.round(matchScore * 100);

  const selectField = (fieldKey: string, recordId: string) => {
    setFieldSelections(prev => ({ ...prev, [fieldKey]: recordId }));
  };

  const handleAllow = async () => {
    if (!candidateId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/duplicates/${candidateId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'allow' }),
      });
      if (res.ok) {
        onResolved?.();
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    setIsLoading(true);
    try {
      const mergeId = survivorId === (sourceRecord.id as string)
        ? targetRecord.id as string
        : sourceRecord.id as string;

      if (candidateId) {
        const res = await fetch(`/api/projects/${projectSlug}/duplicates/${candidateId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'merge',
            survivor_id: survivorId,
            field_selections: fieldSelections,
          }),
        });
        if (res.ok) {
          onResolved?.();
          onClose();
        }
      } else {
        const res = await fetch(`/api/projects/${projectSlug}/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: entityType,
            survivor_id: survivorId,
            merge_ids: [mergeId],
            field_selections: fieldSelections,
          }),
        });
        if (res.ok) {
          onResolved?.();
          onClose();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Potential Duplicate</DialogTitle>
          <DialogDescription>
            These records may be the same {entityType === 'person' ? 'person' : 'organization'}.
            Select which values to keep for the merged record.
          </DialogDescription>
        </DialogHeader>

        {/* Match Score */}
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Match Score</span>
            <span className="font-bold">{scorePercent}%</span>
          </div>
          <Progress value={scorePercent} className="h-2" />
          <div className="flex flex-wrap gap-1">
            {matchReasons.map((reason, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {reason.field} ({reason.match_type})
              </Badge>
            ))}
          </div>
        </div>

        {/* Survivor selection */}
        <div className="py-2 border-t">
          <Label className="text-sm font-medium mb-2 block">Keep which record as primary?</Label>
          <RadioGroup
            value={survivorId}
            onValueChange={setSurvivorId}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={targetRecord.id as string} id="survivor-target" />
              <Label htmlFor="survivor-target" className="cursor-pointer">
                Existing record
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={sourceRecord.id as string} id="survivor-source" />
              <Label htmlFor="survivor-source" className="cursor-pointer">
                Incoming record
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Field-by-field comparison */}
        <div className="flex-1 overflow-y-auto border-t py-3 space-y-1">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2">
            <span>Field</span>
            <span>Existing</span>
            <span>Incoming</span>
          </div>
          {fields.map(({ key, label }) => {
            const sourceVal = sourceRecord[key] as string | null;
            const targetVal = targetRecord[key] as string | null;
            if (!sourceVal && !targetVal) return null;

            const selectedId = fieldSelections[key] || survivorId;

            return (
              <div key={key} className="grid grid-cols-[1fr_1fr_1fr] gap-2 py-2 border-b items-center">
                <span className="text-sm font-medium">{label}</span>
                <button
                  type="button"
                  className={`text-sm text-left p-2 rounded border transition-colors ${
                    selectedId === (targetRecord.id as string)
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                  onClick={() => selectField(key, targetRecord.id as string)}
                >
                  {targetVal || <span className="text-muted-foreground italic">empty</span>}
                </button>
                <button
                  type="button"
                  className={`text-sm text-left p-2 rounded border transition-colors ${
                    selectedId === (sourceRecord.id as string)
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                  onClick={() => selectField(key, sourceRecord.id as string)}
                >
                  {sourceVal || <span className="text-muted-foreground italic">empty</span>}
                </button>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
          {candidateId && (
            <Button variant="outline" onClick={handleAllow} disabled={isLoading}>
              Not a Duplicate
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Merge Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
