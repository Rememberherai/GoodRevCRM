'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminModeBannerProps {
  projectId: string;
  projectName: string;
}

export function AdminModeBanner({ projectId, projectName }: AdminModeBannerProps) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const handleExit = async () => {
    setExiting(true);
    try {
      await fetch(`/api/admin/projects/${projectId}/exit`, { method: 'POST' });
      router.push('/admin/projects');
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between z-30">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          System Admin Mode — {projectName}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        disabled={exiting}
        className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
      >
        {exiting ? 'Exiting...' : 'Exit Project'}
      </Button>
    </div>
  );
}
