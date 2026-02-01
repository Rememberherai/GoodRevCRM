'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Building2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ResearchJob } from '@/types/research';
import { createFieldMappings } from '@/types/research';

interface BulkResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationIds: string[];
  onComplete?: () => void;
}

interface ResearchResult {
  organizationId: string;
  organizationName: string;
  status: 'success' | 'failed' | 'skipped';
  fieldsUpdated?: number;
  error?: string;
}

interface ResearchProgress {
  status: 'idle' | 'processing' | 'completed' | 'cancelled';
  current: number;
  total: number;
  completed: number;
  failed: number;
  results: ResearchResult[];
  currentOrgName?: string;
}

const DELAY_BETWEEN_REQUESTS = 500; // ms

export function BulkResearchDialog({
  open,
  onOpenChange,
  organizationIds,
  onComplete,
}: BulkResearchDialogProps) {
  const params = useParams();
  const slug = params?.slug as string;
  const [progress, setProgress] = useState<ResearchProgress>({
    status: 'idle',
    current: 0,
    total: organizationIds.length,
    completed: 0,
    failed: 0,
    results: [],
  });
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const abortRef = useRef(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setProgress({
        status: 'idle',
        current: 0,
        total: organizationIds.length,
        completed: 0,
        failed: 0,
        results: [],
      });
      abortRef.current = false;
    }
  }, [open, organizationIds.length]);

  const handleStartResearch = async () => {
    if (!slug || organizationIds.length === 0) return;

    setProgress(prev => ({ ...prev, status: 'processing' }));
    abortRef.current = false;

    const results: ResearchResult[] = [];

    for (let i = 0; i < organizationIds.length; i++) {
      if (abortRef.current) {
        setProgress(prev => ({ ...prev, status: 'cancelled' }));
        break;
      }

      const orgId = organizationIds[i]!;

      // First, fetch organization details
      let orgName = `Organization ${i + 1}`;
      let orgData: Record<string, unknown> = {};
      try {
        const orgResponse = await fetch(`/api/projects/${slug}/organizations/${orgId}`);
        if (orgResponse.ok) {
          const org = await orgResponse.json();
          orgName = org.name || orgName;
          orgData = org;
        }
      } catch {
        // Continue with default name
      }

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentOrgName: orgName,
      }));

      try {
        // Start research
        const researchResponse = await fetch(`/api/projects/${slug}/research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: 'organization',
            entity_id: orgId,
            include_custom_fields: true,
          }),
        });

        const researchData = await researchResponse.json();

        if (!researchResponse.ok) {
          throw new Error(researchData.error ?? 'Research failed');
        }

        const job: ResearchJob = researchData.job;

        if (job.status !== 'completed' || !job.result) {
          throw new Error(job.error ?? 'Research did not complete');
        }

        // Auto-apply results
        const fieldsUpdated = await applyResearchResults(
          job,
          orgData,
          overwriteExisting
        );

        results.push({
          organizationId: orgId,
          organizationName: orgName,
          status: 'success',
          fieldsUpdated,
        });

        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          results: [...results],
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          organizationId: orgId,
          organizationName: orgName,
          status: 'failed',
          error: errorMessage,
        });

        setProgress(prev => ({
          ...prev,
          failed: prev.failed + 1,
          results: [...results],
        }));
      }

      // Delay between requests to avoid rate limiting
      if (i < organizationIds.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    if (!abortRef.current) {
      setProgress(prev => ({ ...prev, status: 'completed' }));
      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'failed').length;

      if (successCount > 0 && failCount === 0) {
        toast.success(`Successfully researched ${successCount} organizations`);
      } else if (successCount > 0) {
        toast.info(`Researched ${successCount} organizations, ${failCount} failed`);
      } else {
        toast.error('All research jobs failed');
      }
    }
  };

  const applyResearchResults = async (
    job: ResearchJob,
    currentEntity: Record<string, unknown>,
    overwrite: boolean
  ): Promise<number> => {
    if (!job.result) return 0;

    // Get custom field names from the current entity
    const customFieldNames = Object.keys(
      (currentEntity.custom_fields as Record<string, unknown>) ?? {}
    );

    // Create field mappings
    const mappings = createFieldMappings(
      job.result,
      'organization',
      currentEntity,
      customFieldNames
    );

    // Filter based on overwrite setting
    const fieldsToApply = mappings.filter(mapping => {
      // Skip null values
      if (mapping.is_null || mapping.value === null || mapping.value === undefined) {
        return false;
      }

      // If not overwriting, skip fields that have values
      if (!overwrite && mapping.current_value !== null && mapping.current_value !== undefined && mapping.current_value !== '') {
        return false;
      }

      return true;
    });

    if (fieldsToApply.length === 0) return 0;

    // Apply the fields
    const response = await fetch(`/api/projects/${slug}/research/${job.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        field_updates: fieldsToApply.map(m => ({
          field_name: m.target_field,
          is_custom: m.target_is_custom,
          value: m.value,
        })),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to apply research results');
    }

    const data = await response.json();
    return data.fields_updated ?? 0;
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  const handleClose = () => {
    if (progress.status === 'processing') {
      // Don't close while processing, let them cancel first
      return;
    }
    if (progress.status === 'completed' || progress.status === 'cancelled') {
      onComplete?.();
    }
    onOpenChange(false);
  };

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const totalFieldsUpdated = progress.results
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + (r.fieldsUpdated ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk Research Organizations
          </DialogTitle>
          <DialogDescription>
            Research {organizationIds.length} selected{' '}
            {organizationIds.length === 1 ? 'organization' : 'organizations'} using AI
            to find company information.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {progress.status === 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{organizationIds.length} organizations selected</p>
                  <p className="text-sm text-muted-foreground">
                    AI will research each organization to find details like industry,
                    employee count, description, and more.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="overwrite-switch">Overwrite existing values</Label>
                  <p className="text-sm text-muted-foreground">
                    {overwriteExisting
                      ? 'Will replace existing field values with new data'
                      : 'Will only fill in empty fields'}
                  </p>
                </div>
                <Switch
                  id="overwrite-switch"
                  checked={overwriteExisting}
                  onCheckedChange={setOverwriteExisting}
                />
              </div>
            </div>
          )}

          {progress.status === 'processing' && (
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Researching: {progress.currentOrgName}
                </div>
                <span className="text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {progress.completed} completed
                </span>
                {progress.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {progress.failed} failed
                  </span>
                )}
              </div>
            </div>
          )}

          {(progress.status === 'completed' || progress.status === 'cancelled') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {progress.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {progress.status === 'completed' ? 'Research Complete' : 'Research Cancelled'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{progress.completed}</p>
                  <p className="text-muted-foreground">Successful</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{progress.failed}</p>
                  <p className="text-muted-foreground">Failed</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalFieldsUpdated}</p>
                  <p className="text-muted-foreground">Fields Updated</p>
                </div>
              </div>

              {progress.results.some(r => r.status === 'failed') && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Failed Organizations:</p>
                  <ScrollArea className="h-24 rounded-md border p-2">
                    {progress.results
                      .filter(r => r.status === 'failed')
                      .map(r => (
                        <div key={r.organizationId} className="flex items-start gap-2 py-1 text-sm">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{r.organizationName}</span>
                            <span className="text-muted-foreground">: {r.error}</span>
                          </div>
                        </div>
                      ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {progress.status === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartResearch}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Research
              </Button>
            </>
          )}
          {progress.status === 'processing' && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {(progress.status === 'completed' || progress.status === 'cancelled') && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
