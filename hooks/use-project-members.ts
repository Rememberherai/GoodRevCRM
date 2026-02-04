'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ProjectMember } from '@/types/entity-comment';

export function useProjectMembers() {
  const params = useParams();
  const projectSlug = params.slug as string;

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectSlug) return;

    async function fetchMembers() {
      try {
        const response = await fetch(
          `/api/projects/${projectSlug}/members?limit=100`
        );

        if (!response.ok) return;

        const data = await response.json();
        const mapped = (data.members ?? [])
          .filter((m: any) => m.user)
          .map((m: any) => ({
            id: m.user.id,
            full_name: m.user.full_name,
            email: m.user.email,
            avatar_url: m.user.avatar_url,
            role: m.role,
          }));
        setMembers(mapped);
      } catch {
        // Silently fail - autocomplete just won't show members
      } finally {
        setIsLoading(false);
      }
    }

    fetchMembers();
  }, [projectSlug]);

  return { members, isLoading };
}
