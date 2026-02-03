'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SequenceList, NewSequenceDialog } from '@/components/sequences';
import type { Sequence, SequenceStatus } from '@/types/sequence';
import { SEQUENCE_STATUS_LABELS } from '@/types/sequence';
import type { CompanyContext } from '@/lib/validators/project';

interface SequenceWithCounts extends Sequence {
  steps?: { count: number }[];
  enrollments?: { count: number }[];
}

interface SequencesPageClientProps {
  projectSlug: string;
  initialSequences: SequenceWithCounts[];
  companyContext?: CompanyContext;
}

export function SequencesPageClient({
  projectSlug,
  initialSequences,
  companyContext,
}: SequencesPageClientProps) {
  const router = useRouter();
  const [sequences, setSequences] = useState(initialSequences);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SequenceStatus | 'all'>('all');

  const filteredSequences = statusFilter === 'all'
    ? sequences
    : sequences.filter((s) => s.status === statusFilter);

  const handleEdit = (sequence: SequenceWithCounts) => {
    router.push(`/projects/${projectSlug}/sequences/${sequence.id}`);
  };

  const handleCreated = (sequence: { id: string }) => {
    // Navigate to the new sequence
    router.push(`/projects/${projectSlug}/sequences/${sequence.id}`);
    router.refresh();
  };

  const handleStatusChange = async (
    sequence: SequenceWithCounts,
    newStatus: SequenceStatus
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequence.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) throw new Error('Failed to update sequence');

      // Update local state
      setSequences((prev) =>
        prev.map((s) =>
          s.id === sequence.id ? { ...s, status: newStatus } : s
        )
      );
    } catch (error) {
      console.error('Error updating sequence status:', error);
    }
  };

  const handleDelete = async (sequence: SequenceWithCounts) => {
    if (!confirm('Are you sure you want to delete this sequence? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequence.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete sequence');

      // Update local state
      setSequences((prev) => prev.filter((s) => s.id !== sequence.id));
    } catch (error) {
      console.error('Error deleting sequence:', error);
    }
  };

  const handleDuplicate = async (sequence: SequenceWithCounts) => {
    try {
      // Create a copy with a new name
      const response = await fetch(`/api/projects/${projectSlug}/sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${sequence.name} (Copy)`,
          description: sequence.description,
          settings: sequence.settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to duplicate sequence');

      const newSequence = await response.json();

      // TODO: Also copy the steps

      setSequences((prev) => [newSequence, ...prev]);
    } catch (error) {
      console.error('Error duplicating sequence:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Sequences</h2>
          <p className="text-muted-foreground">
            Automate your outreach with multi-step email sequences
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Sequence
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as SequenceStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sequences</SelectItem>
              {(Object.keys(SEQUENCE_STATUS_LABELS) as SequenceStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {SEQUENCE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <SequenceList
            sequences={filteredSequences}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onActivate={(s) => handleStatusChange(s, 'active')}
            onPause={(s) => handleStatusChange(s, 'paused')}
            onArchive={(s) => handleStatusChange(s, 'archived')}
          />
        </CardContent>
      </Card>

      <NewSequenceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectSlug={projectSlug}
        onCreated={handleCreated}
        initialCompanyContext={companyContext}
      />
    </div>
  );
}
