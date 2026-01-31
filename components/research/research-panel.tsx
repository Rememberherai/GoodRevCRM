'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, History, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import type { EntityType } from '@/types/custom-field';
import type { ResearchJob, ResearchStatus } from '@/types/research';
import { ResearchSettingsDialog } from './research-settings-dialog';

interface ResearchPanelProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  onResearchComplete?: (job: ResearchJob) => void;
}

export function ResearchPanel({ entityType, entityId, entityName, onResearchComplete }: ResearchPanelProps) {
  const params = useParams();
  const slug = params?.slug as string;
  const [isResearching, setIsResearching] = useState(false);
  const [lastJob, setLastJob] = useState<ResearchJob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ResearchJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const startResearch = useCallback(async () => {
    if (!slug || isResearching) return;

    setIsResearching(true);
    try {
      const response = await fetch(`/api/projects/${slug}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          include_custom_fields: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start research');
      }

      setLastJob(data.job);

      if (data.job.status === 'completed') {
        toast.success('Research completed successfully');
        onResearchComplete?.(data.job);
      } else if (data.job.status === 'failed') {
        toast.error('Research failed: ' + (data.job.error ?? 'Unknown error'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start research';
      toast.error(message);
    } finally {
      setIsResearching(false);
    }
  }, [slug, entityType, entityId, isResearching, onResearchComplete]);

  const loadHistory = useCallback(async () => {
    if (!slug || isLoadingHistory) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/projects/${slug}/research?entity_type=${entityType}&entity_id=${entityId}&limit=10`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load history');
      }

      setHistory(data.jobs ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load history';
      toast.error(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [slug, entityType, entityId, isLoadingHistory]);

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  const getStatusBadge = (status: ResearchStatus) => {
    const colors: Record<ResearchStatus, string> = {
      pending: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    const labels: Record<ResearchStatus, string> = {
      pending: 'Pending',
      running: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    };

    return (
      <Badge variant="outline" className={colors[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Research</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              onClick={startResearch}
              disabled={isResearching}
              size="sm"
            >
              {isResearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Research {entityName}
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          Use AI to research and enrich {entityType} data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastJob && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Latest Research</span>
              {getStatusBadge(lastJob.status)}
            </div>
            <div className="text-sm text-muted-foreground">
              {lastJob.status === 'completed' ? (
                <span>Completed {formatDate(lastJob.completed_at)}</span>
              ) : lastJob.status === 'failed' ? (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{lastJob.error ?? 'Unknown error'}</span>
                </div>
              ) : (
                <span>Started {formatDate(lastJob.started_at)}</span>
              )}
            </div>
            {lastJob.status === 'completed' && lastJob.result && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResearchComplete?.(lastJob)}
              >
                View & Apply Results
              </Button>
            )}
          </div>
        )}

        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHistory}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Research History
              </div>
              {showHistory ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No research history yet
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      <span className="text-muted-foreground">
                        {formatDate(job.created_at)}
                      </span>
                    </div>
                    {job.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResearchComplete?.(job)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <ResearchSettingsDialog
        slug={slug}
        entityType={entityType}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </Card>
  );
}
