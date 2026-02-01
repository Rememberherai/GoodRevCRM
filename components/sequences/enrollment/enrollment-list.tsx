'use client';

import {
  MoreHorizontal,
  Pause,
  Play,
  X,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EnrollmentStatusBadge } from './enrollment-status-badge';
import type { SequenceEnrollment, EnrollmentStatus } from '@/types/sequence';

interface EnrollmentWithPerson extends SequenceEnrollment {
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface EnrollmentListProps {
  enrollments: EnrollmentWithPerson[];
  onPause?: (enrollment: EnrollmentWithPerson) => void;
  onResume?: (enrollment: EnrollmentWithPerson) => void;
  onCancel?: (enrollment: EnrollmentWithPerson) => void;
  onViewPerson?: (personId: string) => void;
}

export function EnrollmentList({
  enrollments,
  onPause,
  onResume,
  onCancel,
  onViewPerson,
}: EnrollmentListProps) {
  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No enrollments yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enroll people to start sending them this sequence.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPersonName = (person: EnrollmentWithPerson['person']) => {
    if (!person) return 'Unknown';
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
    return name || person.email || 'Unknown';
  };

  const canPause = (status: EnrollmentStatus) => status === 'active';
  const canResume = (status: EnrollmentStatus) => status === 'paused';
  const canCancel = (status: EnrollmentStatus) =>
    status === 'active' || status === 'paused';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Current Step</TableHead>
          <TableHead>Next Send</TableHead>
          <TableHead>Enrolled</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {enrollments.map((enrollment) => (
          <TableRow key={enrollment.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">
                  {getPersonName(enrollment.person)}
                </span>
                {enrollment.person?.email && (
                  <span className="text-sm text-muted-foreground">
                    {enrollment.person.email}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <EnrollmentStatusBadge status={enrollment.status} />
            </TableCell>
            <TableCell>
              <span className="text-sm">Step {enrollment.current_step}</span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {formatDate(enrollment.next_send_at)}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {formatDate(enrollment.created_at)}
              </span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onViewPerson && enrollment.person && (
                    <>
                      <DropdownMenuItem
                        onClick={() => onViewPerson(enrollment.person!.id)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        View Person
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {canPause(enrollment.status) && onPause && (
                    <DropdownMenuItem onClick={() => onPause(enrollment)}>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </DropdownMenuItem>
                  )}
                  {canResume(enrollment.status) && onResume && (
                    <DropdownMenuItem onClick={() => onResume(enrollment)}>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </DropdownMenuItem>
                  )}
                  {canCancel(enrollment.status) && onCancel && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onCancel(enrollment)}
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Enrollment
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
