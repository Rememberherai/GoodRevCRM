'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IncidentQueueButtonProps {
  projectSlug: string;
  projectType: string;
}

export function IncidentQueueButton({ projectSlug, projectType }: IncidentQueueButtonProps) {
  const pathname = usePathname();
  const [attentionCount, setAttentionCount] = useState<number | null>(null);

  const fetchAttentionCount = useCallback(async () => {
    if (projectType !== 'community') return;

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/incidents?status=open&unassigned=true&limit=1&offset=0`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        setAttentionCount(0);
        return;
      }

      const data = await response.json() as { pagination?: { total?: number } };
      setAttentionCount(data.pagination?.total ?? 0);
    } catch {
      setAttentionCount(0);
    }
  }, [projectSlug, projectType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAttentionCount();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAttentionCount, pathname]);

  useEffect(() => {
    if (projectType !== 'community') return;

    const handleFocus = () => {
      void fetchAttentionCount();
    };
    const handleIncidentQueueUpdated = () => {
      void fetchAttentionCount();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('incident-queue-updated', handleIncidentQueueUpdated);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('incident-queue-updated', handleIncidentQueueUpdated);
    };
  }, [fetchAttentionCount, projectType]);

  if (projectType !== 'community') {
    return null;
  }

  const badgeLabel = attentionCount && attentionCount > 99 ? '99+' : String(attentionCount ?? 0);
  const href = attentionCount && attentionCount > 0
    ? `/projects/${projectSlug}/incidents?status=open&unassigned=true`
    : `/projects/${projectSlug}/incidents`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href={href}>
              <AlertTriangle className={`h-5 w-5 ${attentionCount ? 'text-amber-600' : 'text-muted-foreground'}`} />
              {attentionCount ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 min-w-5 justify-center px-1 text-[10px] leading-none"
                >
                  {badgeLabel}
                </Badge>
              ) : null}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {attentionCount
              ? `${attentionCount} unassigned incident${attentionCount === 1 ? '' : 's'} need attention`
              : 'Incident queue'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
