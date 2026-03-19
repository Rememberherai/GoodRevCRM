'use client';

import { useEffect } from 'react';
import {
  LAST_PROJECT_SLUG_COOKIE,
  LAST_PROJECT_SLUG_STORAGE_KEY,
} from '@/lib/project-navigation';

interface LastProjectTrackerProps {
  projectSlug: string;
}

export function LastProjectTracker({ projectSlug }: LastProjectTrackerProps) {
  useEffect(() => {
    localStorage.setItem(LAST_PROJECT_SLUG_STORAGE_KEY, projectSlug);
    document.cookie = `${LAST_PROJECT_SLUG_COOKIE}=${encodeURIComponent(projectSlug)}; path=/; max-age=31536000; samesite=lax`;
  }, [projectSlug]);

  return null;
}
