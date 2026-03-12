'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnrollmentList } from './enrollment-list';
import { toast } from 'sonner';
import type { SequenceEnrollment, EnrollmentStatus } from '@/types/sequence';

interface EnrollmentWithPerson extends SequenceEnrollment {
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface SequenceEnrollmentsPanelProps {
  projectSlug: string;
  sequenceId: string;
}

export function SequenceEnrollmentsPanel({
  projectSlug,
  sequenceId,
}: SequenceEnrollmentsPanelProps) {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<EnrollmentWithPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequenceId}/enrollments?limit=500`
      );
      if (response.ok) {
        const data = await response.json();
        setEnrollments(data.enrollments || []);
      }
    } catch (err) {
      console.error('Error fetching enrollments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, sequenceId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const updateEnrollmentStatus = async (
    enrollment: EnrollmentWithPerson,
    status: EnrollmentStatus
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequenceId}/enrollments/${enrollment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update enrollment');
      }

      toast.success(`Enrollment ${status === 'paused' ? 'paused' : 'resumed'}`);
      fetchEnrollments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const cancelEnrollment = async (enrollment: EnrollmentWithPerson) => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequenceId}/enrollments/${enrollment.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel enrollment');
      }

      toast.success('Enrollment cancelled');
      fetchEnrollments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = enrollments.filter((e) => e.status === 'active').length;
  const completedCount = enrollments.filter((e) => e.status === 'completed').length;
  const repliedCount = enrollments.filter((e) => e.status === 'replied').length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Enrollments ({enrollments.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            {activeCount} active · {completedCount} completed · {repliedCount} replied
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            fetchEnrollments();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <EnrollmentList
        enrollments={enrollments}
        onPause={(e) => updateEnrollmentStatus(e, 'paused')}
        onResume={(e) => updateEnrollmentStatus(e, 'active')}
        onCancel={cancelEnrollment}
        onViewPerson={(personId) =>
          router.push(`/projects/${projectSlug}/people/${personId}`)
        }
      />
    </div>
  );
}
