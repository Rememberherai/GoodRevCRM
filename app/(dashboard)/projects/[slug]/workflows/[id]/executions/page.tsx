'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkflowExecution, WorkflowStepExecution } from '@/types/workflow';

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  running: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-gray-500', label: 'Cancelled' },
  paused: { icon: Pause, color: 'text-amber-500', label: 'Paused' },
};

export default function WorkflowExecutionsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExec, setSelectedExec] = useState<WorkflowExecution | null>(null);
  const [steps, setSteps] = useState<WorkflowStepExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchExecutions();
  }, [slug, id]);

  async function fetchExecutions() {
    try {
      const res = await fetch(`/api/projects/${slug}/workflows/${id}/executions`);
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadExecDetail(exec: WorkflowExecution) {
    setSelectedExec(exec);
    try {
      const res = await fetch(`/api/projects/${slug}/workflows/${id}/executions/${exec.id}`);
      const data = await res.json();
      setSteps(data.steps || []);
    } catch (error) {
      console.error('Failed to fetch execution detail:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/projects/${slug}/workflows/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Execution History</h1>
      </div>

      <div className="flex gap-6">
        {/* Execution list */}
        <div className="w-96 space-y-2">
          {executions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No executions yet</p>
          ) : (
            executions.map((exec) => {
              const cfg = statusConfig[exec.status] ?? statusConfig.running!;
              const Icon = cfg.icon;
              return (
                <div
                  key={exec.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedExec?.id === exec.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => loadExecDetail(exec)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${cfg.color} ${exec.status === 'running' ? 'animate-spin' : ''}`} />
                      <Badge variant="outline" className="text-xs">
                        {cfg.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">v{exec.workflow_version}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(exec.started_at).toLocaleString()}
                    {exec.completed_at && (
                      <span className="ml-2">
                        ({Math.round((new Date(exec.completed_at).getTime() - new Date(exec.started_at).getTime()) / 1000)}s)
                      </span>
                    )}
                  </div>
                  {exec.error_message && (
                    <p className="text-xs text-red-500 mt-1 truncate">{exec.error_message}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Step detail */}
        {selectedExec && (
          <div className="flex-1 border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Steps</h3>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No steps recorded</p>
            ) : (
              <div className="space-y-2">
                {steps.map((step) => {
                  const stepConfig = {
                    pending: { color: 'bg-gray-200', label: 'Pending' },
                    running: { color: 'bg-blue-400', label: 'Running' },
                    completed: { color: 'bg-emerald-400', label: 'Completed' },
                    failed: { color: 'bg-red-400', label: 'Failed' },
                    skipped: { color: 'bg-gray-300', label: 'Skipped' },
                    waiting: { color: 'bg-amber-400', label: 'Waiting' },
                  }[step.status] || { color: 'bg-gray-200', label: step.status };

                  return (
                    <div key={step.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                      <div className={`w-3 h-3 rounded-full mt-1 ${stepConfig.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.node_id}</span>
                          <Badge variant="outline" className="text-[10px]">{step.node_type}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{stepConfig.label}</Badge>
                        </div>
                        {step.error_message && (
                          <p className="text-xs text-red-500 mt-1">{step.error_message}</p>
                        )}
                        {step.output_data && (
                          <pre className="text-xs text-muted-foreground mt-1 bg-muted p-1 rounded overflow-x-auto max-h-24">
                            {JSON.stringify(step.output_data, null, 2)}
                          </pre>
                        )}
                      </div>
                      {step.retry_count > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          retry {step.retry_count}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
