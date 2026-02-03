'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewSequenceDialog } from '@/components/sequences';
import type { Sequence, SequenceStatus } from '@/types/sequence';
import { SEQUENCE_STATUS_LABELS, SEQUENCE_STATUS_COLORS } from '@/types/sequence';
import type { CompanyContext } from '@/lib/validators/project';

interface SequenceWithCounts extends Sequence {
  steps?: { count: number }[];
  enrollments?: { count: number }[];
}

interface OrgSequencesTabProps {
  projectSlug: string;
  organizationId: string;
  organizationName: string;
  organizationDomain?: string | null;
  organizationDescription?: string | null;
  projectCompanyContext?: CompanyContext;
}

export function OrgSequencesTab({
  projectSlug,
  organizationId,
  organizationName,
  organizationDomain,
  organizationDescription,
  projectCompanyContext,
}: OrgSequencesTabProps) {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadSequences = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences?organization_id=${organizationId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSequences(data.sequences);
      }
    } catch (error) {
      console.error('Error loading sequences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, organizationId]);

  useEffect(() => {
    loadSequences();
  }, [loadSequences]);

  const handleCreated = (sequence: { id: string }) => {
    router.push(`/projects/${projectSlug}/sequences/${sequence.id}`);
    router.refresh();
  };

  const getStatusBadge = (status: SequenceStatus) => {
    return (
      <Badge className={SEQUENCE_STATUS_COLORS[status]}>
        {SEQUENCE_STATUS_LABELS[status]}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sequences</h3>
          <p className="text-sm text-muted-foreground">
            Email sequences specific to {organizationName}
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sequences yet</h3>
              <p className="text-muted-foreground mb-4">
                Create email sequences tailored specifically for {organizationName}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first sequence
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sequences.map((sequence) => {
            const stepCount = sequence.steps?.[0]?.count ?? 0;
            const enrollmentCount = sequence.enrollments?.[0]?.count ?? 0;

            return (
              <Link
                key={sequence.id}
                href={`/projects/${projectSlug}/sequences/${sequence.id}`}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{sequence.name}</div>
                  {sequence.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {sequence.description}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {stepCount} steps
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {enrollmentCount} enrolled
                  </div>
                  {getStatusBadge(sequence.status)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewSequenceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectSlug={projectSlug}
        onCreated={handleCreated}
        initialCompanyContext={projectCompanyContext}
        organizationId={organizationId}
        organizationContext={{
          name: organizationName,
          domain: organizationDomain,
          description: organizationDescription,
        }}
      />
    </div>
  );
}
