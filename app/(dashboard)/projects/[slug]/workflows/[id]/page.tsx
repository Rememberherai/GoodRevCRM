'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/stores/workflow-store';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';

export default function WorkflowEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const { workflowId, isLoading } = useWorkflowStore();

  useEffect(() => {
    let cancelled = false;
    const store = useWorkflowStore.getState();
    store.setIsLoading(true);

    async function fetchWorkflow() {
      try {
        const res = await fetch(`/api/projects/${slug}/workflows/${id}`);
        const data = await res.json();
        console.log('[WorkflowPage] API response:', { hasWorkflow: !!data.workflow, nodeCount: data.workflow?.definition?.nodes?.length, definition: data.workflow?.definition });
        if (!cancelled && data.workflow) {
          useWorkflowStore.getState().loadWorkflow(data.workflow);
          console.log('[WorkflowPage] After loadWorkflow, store nodes:', useWorkflowStore.getState().nodes.length);
        }
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
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

  if (isLoading || !workflowId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <WorkflowEditor projectSlug={slug} />;
}
