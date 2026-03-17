'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  GitBranch,
  Play,
  Pause,
  MoreHorizontal,
  Copy,
  Trash2,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workflow } from '@/types/workflow';

export default function WorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, [slug]);

  async function fetchWorkflows() {
    try {
      const res = await fetch(`/api/projects/${slug}/workflows`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createWorkflow() {
    try {
      const res = await fetch(`/api/projects/${slug}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Untitled Workflow',
          trigger_type: 'manual',
          definition: {
            schema_version: '1.0.0',
            nodes: [
              {
                id: 'start-1',
                type: 'start',
                position: { x: 250, y: 50 },
                data: { label: 'Start', config: {} },
              },
              {
                id: 'end-1',
                type: 'end',
                position: { x: 250, y: 400 },
                data: { label: 'End', config: {} },
              },
            ],
            edges: [],
          },
        }),
      });
      const data = await res.json();
      if (data.workflow) {
        router.push(`/projects/${slug}/workflows/${data.workflow.id}`);
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  }

  async function duplicateWorkflow(id: string) {
    try {
      await fetch(`/api/projects/${slug}/workflows/${id}/duplicate`, { method: 'POST' });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await fetch(`/api/projects/${slug}/workflows/${id}`, { method: 'DELETE' });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function toggleActive(id: string) {
    try {
      await fetch(`/api/projects/${slug}/workflows/${id}/activate`, { method: 'POST' });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to toggle active:', error);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Workflows
          </h1>
          <p className="text-muted-foreground mt-1">
            Design and manage multi-step workflow orchestrations
          </p>
        </div>
        <Button onClick={createWorkflow} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first workflow to automate complex multi-step processes
          </p>
          <Button onClick={createWorkflow} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="border rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors group"
              onClick={() => router.push(`/projects/${slug}/workflows/${wf.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{wf.name}</h3>
                  {wf.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {wf.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => toggleActive(wf.id)}>
                      {wf.is_active ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      {wf.is_active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateWorkflow(wf.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteWorkflow(wf.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={wf.is_active ? 'default' : 'secondary'}>
                  {wf.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {wf.trigger_type}
                </Badge>
                {wf.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {wf.execution_count} runs
                </span>
                {wf.last_executed_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(wf.last_executed_at).toLocaleDateString()}
                  </span>
                )}
                <span>v{wf.current_version}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
