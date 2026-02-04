'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { AutomationExecution } from '@/types/automation';

interface AutomationExecutionsProps {
  slug: string;
  automationId: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'partial_failure':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'skipped':
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'partial_failure':
      return 'Partial Failure';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'partial_failure':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function AutomationExecutions({ slug, automationId }: AutomationExecutionsProps) {
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${slug}/automations/${automationId}/executions?limit=50`
      );
      const data = await res.json();
      if (res.ok) {
        setExecutions(data.executions);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  }, [slug, automationId]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No executions yet. This automation hasn&apos;t been triggered.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {executions.map((execution) => (
        <Collapsible key={execution.id}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left w-full">
              <StatusIcon status={execution.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(execution.status)} className="text-xs">
                    {statusLabel(execution.status)}
                  </Badge>
                  {execution.entity_type && (
                    <span className="text-xs text-muted-foreground">
                      {execution.entity_type}
                    </span>
                  )}
                  {execution.duration_ms != null && (
                    <span className="text-xs text-muted-foreground">
                      {execution.duration_ms}ms
                    </span>
                  )}
                </div>
                {execution.error_message && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    {execution.error_message}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(execution.executed_at).toLocaleString()}
              </span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-7 p-3 text-xs space-y-2 bg-muted/50 rounded-b-lg">
              {execution.trigger_event && (
                <div>
                  <span className="font-medium">Trigger Event:</span>
                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(execution.trigger_event, null, 2)}
                  </pre>
                </div>
              )}
              {execution.actions_results &&
                Array.isArray(execution.actions_results) &&
                execution.actions_results.length > 0 && (
                  <div>
                    <span className="font-medium">Action Results:</span>
                    {execution.actions_results.map(
                      (
                        result: {
                          action_type: string;
                          success: boolean;
                          error?: string;
                          result?: Record<string, unknown>;
                        },
                        i: number
                      ) => (
                        <div
                          key={i}
                          className="mt-1 p-2 bg-background rounded flex items-center gap-2"
                        >
                          {result.success ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                          )}
                          <span>{result.action_type}</span>
                          {result.error && (
                            <span className="text-destructive">— {result.error}</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
