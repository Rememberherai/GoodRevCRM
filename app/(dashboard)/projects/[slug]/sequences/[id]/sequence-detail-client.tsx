'use client';

import { useRouter } from 'next/navigation';
import { SequenceBuilder } from '@/components/sequences/sequence-builder';
import type { Sequence, SequenceStep, SequenceStatus } from '@/types/sequence';

interface SequenceDetailClientProps {
  sequence: Sequence & { steps: SequenceStep[] };
  projectSlug: string;
}

export function SequenceDetailClient({
  sequence,
  projectSlug,
}: SequenceDetailClientProps) {
  const router = useRouter();

  const handleSave = async (updates: Partial<Sequence>) => {
    const response = await fetch(
      `/api/projects/${projectSlug}/sequences/${sequence.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save sequence');
    }
  };

  const handleSaveStep = async (
    step: Partial<SequenceStep> & { id?: string }
  ): Promise<SequenceStep> => {
    if (step.id) {
      // Update existing step
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequence.id}/steps/${step.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(step),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update step');
      }

      return response.json();
    } else {
      // Create new step
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequence.id}/steps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(step),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create step');
      }

      return response.json();
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const response = await fetch(
      `/api/projects/${projectSlug}/sequences/${sequence.id}/steps/${stepId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete step');
    }
  };

  const handleStatusChange = async (status: SequenceStatus) => {
    const response = await fetch(
      `/api/projects/${projectSlug}/sequences/${sequence.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update status');
    }

    router.refresh();
  };

  return (
    <div className="h-[calc(100vh-64px)]">
      <SequenceBuilder
        sequence={sequence}
        projectSlug={projectSlug}
        onSave={handleSave}
        onSaveStep={handleSaveStep}
        onDeleteStep={handleDeleteStep}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
