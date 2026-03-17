'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/stores/workflow-store';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';

export default function WorkflowEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const { workflowId, isLoading } = useWorkflowStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const store = useWorkflowStore.getState();
    store.setIsLoading(true);
    setError(null);

    async function fetchWorkflow() {
      try {
        const res = await fetch(`/api/projects/${slug}/workflows/${id}`);
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? 'Workflow not found' : `Failed to load (${res.status})`);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.workflow) {
          useWorkflowStore.getState().loadWorkflow(data.workflow);
        } else if (!cancelled) {
          setError('Workflow not found');
        }
      } catch (err) {
        console.error('Failed to fetch workflow:', err);
        if (!cancelled) setError('Failed to load workflow');
      } finally {
        if (!cancelled) {
          useWorkflowStore.getState().setIsLoading(false);
        }
      }
    }

    fetchWorkflow();
    return () => {
      cancelled = true;
      useWorkflowStore.getState().clearWorkflow();
    };
  }, [slug, id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-muted-foreground">{error}</p>
        <a href={`/projects/${slug}/workflows`} className="text-sm text-primary underline">
          Back to Workflows
        </a>
      </div>
    );
  }

  if (isLoading || !workflowId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <WorkflowEditor projectSlug={slug} />;
}
