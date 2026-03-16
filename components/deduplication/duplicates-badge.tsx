'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface DuplicatesBadgeProps {
  projectSlug: string;
  entityType?: 'person' | 'organization';
  className?: string;
}

export function DuplicatesBadge({ projectSlug, entityType, className }: DuplicatesBadgeProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ status: 'pending', limit: '1' });
    if (entityType) params.set('entity_type', entityType);

    fetch(`/api/projects/${projectSlug}/duplicates?${params}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.pagination?.total) {
          setCount(data.pagination.total);
        }
      })
      .catch(() => {});
  }, [projectSlug, entityType]);

  if (count === 0) return null;

  return (
    <Badge variant="destructive" className={className}>
      {count}
    </Badge>
  );
}
