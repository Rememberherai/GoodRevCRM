'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ResearchJob, FieldMapping } from '@/types/research';

interface ResearchResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ResearchJob | null;
  onApplied?: () => void;
}

export function ResearchResultsDialog({
  open,
  onOpenChange,
  job,
  onApplied,
}: ResearchResultsDialogProps) {
  const params = useParams();
  const slug = params?.slug as string;
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch field mappings when dialog opens
  useEffect(() => {
    if (open && job && job.status === 'completed') {
      fetchFieldMappings();
    }
  }, [open, job]);

  const fetchFieldMappings = async () => {
    if (!job || !slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${slug}/research/${job.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch research results');
      }

      const mappings = data.field_mappings ?? [];
      setFieldMappings(mappings);

      // Pre-select fields that should be updated
      const preSelectedKeys = mappings
        .filter((m: FieldMapping) => m.should_update && m.confidence >= 0.5)
        .map((m: FieldMapping) => `${m.target_field}-${m.target_is_custom}`);
      setSelectedFields(new Set<string>(preSelectedKeys));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch research results';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleField = (mapping: FieldMapping) => {
    const key = `${mapping.target_field}-${mapping.target_is_custom}`;
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  const selectAll = () => {
    setSelectedFields(
      new Set(fieldMappings.map((m) => `${m.target_field}-${m.target_is_custom}`))
    );
  };

  const selectNone = () => {
    setSelectedFields(new Set());
  };

  const applyResults = async () => {
    if (!job || !slug || selectedFields.size === 0) return;

    setIsApplying(true);
    try {
      const fieldUpdates = fieldMappings
        .filter((m) => selectedFields.has(`${m.target_field}-${m.target_is_custom}`))
        .map((m) => ({
          field_name: m.target_field,
          is_custom: m.target_is_custom,
          value: m.value,
        }));

      const response = await fetch(`/api/projects/${slug}/research/${job.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          field_updates: fieldUpdates,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to apply research results');
      }

      toast.success(`Applied ${data.fields_updated} fields`);
      onApplied?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply research results';
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800">High</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Low</Badge>;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Research Results</DialogTitle>
          <DialogDescription>
            Review the researched data and select which fields to update.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        ) : fieldMappings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No field mappings available
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">
                {selectedFields.size} of {fieldMappings.length} fields selected
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Clear All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {fieldMappings.map((mapping) => {
                  const key = `${mapping.target_field}-${mapping.target_is_custom}`;
                  const isSelected = selectedFields.has(key);
                  const hasCurrentValue = mapping.current_value !== null && mapping.current_value !== undefined;

                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={key}
                          checked={isSelected}
                          onCheckedChange={() => toggleField(mapping)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={key} className="font-medium cursor-pointer">
                              {mapping.target_field}
                            </Label>
                            {mapping.target_is_custom && (
                              <Badge variant="secondary" className="text-xs">
                                Custom
                              </Badge>
                            )}
                            {getConfidenceBadge(mapping.confidence)}
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">New Value</p>
                              <p className="font-medium truncate" title={formatValue(mapping.value)}>
                                {formatValue(mapping.value)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Current Value</p>
                              <p className={`truncate ${hasCurrentValue ? '' : 'text-muted-foreground'}`} title={formatValue(mapping.current_value)}>
                                {hasCurrentValue ? formatValue(mapping.current_value) : '(empty)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={applyResults}
            disabled={isApplying || selectedFields.size === 0}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Apply {selectedFields.size} Fields
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
