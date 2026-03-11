'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Mail, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewSequenceDialog } from '@/components/sequences';
import { EnrollInSequenceDialog } from '@/components/sequences/enrollment/enroll-in-sequence-dialog';
import { EnrollmentStatusBadge } from '@/components/sequences/enrollment/enrollment-status-badge';
import type { Sequence, SequenceStatus, EnrollmentStatus } from '@/types/sequence';
import { SEQUENCE_STATUS_LABELS, SEQUENCE_STATUS_COLORS } from '@/types/sequence';
import type { CompanyContext } from '@/lib/validators/project';

interface SequenceWithCounts extends Sequence {
  steps?: { count: number }[];
  enrollments?: { count: number }[];
}

interface PersonEnrollment {
  id: string;
  sequence_id: string;
  status: EnrollmentStatus;
  current_step: number;
  next_send_at: string | null;
  created_at: string;
  sequence?: {
    id: string;
    name: string;
    status: SequenceStatus;
    description: string | null;
  };
}

interface PersonSequencesTabProps {
  projectSlug: string;
  personId: string;
  personName: string;
  personEmail?: string | null;
  personJobTitle?: string | null;
  projectCompanyContext?: CompanyContext;
}

export function PersonSequencesTab({
  projectSlug,
  personId,
  personName,
  personEmail,
  personJobTitle,
  projectCompanyContext,
}: PersonSequencesTabProps) {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceWithCounts[]>([]);
  const [enrollments, setEnrollments] = useState<PersonEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [seqRes, enrollRes] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/sequences?person_id=${personId}`),
        fetch(`/api/projects/${projectSlug}/people/${personId}/enrollments`),
      ]);

      if (seqRes.ok) {
        const data = await seqRes.json();
        setSequences(data.sequences);
      }
      if (enrollRes.ok) {
        const data = await enrollRes.json();
        setEnrollments(data.enrollments || []);
      }
    } catch (error) {
      console.error('Error loading sequences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, personId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            Email sequences for {personName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsEnrollOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Enroll in Sequence
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Sequence
          </Button>
        </div>
      </div>

      {/* Active Enrollments */}
      {enrollments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Enrolled In</h4>
          <div className="grid gap-2">
            {enrollments.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/projects/${projectSlug}/sequences/${enrollment.sequence_id}`}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {enrollment.sequence?.name || 'Unknown Sequence'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Step {enrollment.current_step} · Next: {formatDate(enrollment.next_send_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <EnrollmentStatusBadge status={enrollment.status} />
                  {enrollment.sequence && getStatusBadge(enrollment.sequence.status)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Person-specific sequences */}
      {sequences.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Sequences Created for {personName}
          </h4>
          <div className="grid gap-2">
            {sequences.map((sequence) => {
              const stepCount = sequence.steps?.[0]?.count ?? 0;
              const enrollmentCount = sequence.enrollments?.[0]?.count ?? 0;

              return (
                <Link
                  key={sequence.id}
                  href={`/projects/${projectSlug}/sequences/${sequence.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{sequence.name}</div>
                    {sequence.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {sequence.description}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{stepCount} steps</span>
                    <span>{enrollmentCount} enrolled</span>
                    {getStatusBadge(sequence.status)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sequences.length === 0 && enrollments.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sequences yet</h3>
              <p className="text-muted-foreground mb-4">
                Enroll {personName} in a sequence or create one specifically for them.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setIsEnrollOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Enroll in Sequence
                </Button>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Sequence
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <NewSequenceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectSlug={projectSlug}
        onCreated={handleCreated}
        initialCompanyContext={projectCompanyContext}
        personId={personId}
        personContext={{
          name: personName,
          email: personEmail,
          jobTitle: personJobTitle,
        }}
      />

      <EnrollInSequenceDialog
        open={isEnrollOpen}
        onOpenChange={setIsEnrollOpen}
        projectSlug={projectSlug}
        personIds={[personId]}
        onEnrolled={() => loadData()}
      />
    </div>
  );
}
