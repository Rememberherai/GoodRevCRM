'use client';

import { cn } from '@/lib/utils';
import type { EnrollmentStatus } from '@/types/sequence';
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS,
} from '@/types/sequence';

interface EnrollmentStatusBadgeProps {
  status: EnrollmentStatus;
  className?: string;
}

export function EnrollmentStatusBadge({
  status,
  className,
}: EnrollmentStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        ENROLLMENT_STATUS_COLORS[status],
        className
      )}
    >
      {ENROLLMENT_STATUS_LABELS[status]}
    </span>
  );
}
