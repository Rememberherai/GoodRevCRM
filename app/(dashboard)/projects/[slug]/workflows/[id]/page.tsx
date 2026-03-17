'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/stores/workflow-store';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';

export default function WorkflowEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const { loadWorkflow, clearWorkflow, setIsLoading, isLoading } = useWorkflowStore();

  useEffect(() => {
    async function fetchWorkflow() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects/${slug}/workflows/${id}`);
        const data = await res.json();
        if (data.workflow) {
          loadWorkflow(data.workflow);
        }
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkflow();
    return () => clearWorkflow();
  }, [slug, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <WorkflowEditor projectSlug={slug} />;
}
