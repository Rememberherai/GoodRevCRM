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
  const [openCount, setOpenCount] = useState<number | null>(null);

  const fetchOpenCount = useCallback(async () => {
    if (projectType !== 'community') return;

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/incidents?status=open&limit=1&offset=0`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        setOpenCount(0);
        return;
      }

      const data = await response.json() as { pagination?: { total?: number } };
      setOpenCount(data.pagination?.total ?? 0);
    } catch {
      setOpenCount(0);
    }
  }, [projectSlug, projectType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchOpenCount();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchOpenCount, pathname]);

  useEffect(() => {
    if (projectType !== 'community') return;

    const handleFocus = () => {
      void fetchOpenCount();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchOpenCount, projectType]);

  if (projectType !== 'community') {
    return null;
  }

  const badgeLabel = openCount && openCount > 99 ? '99+' : String(openCount ?? 0);
  const href = openCount && openCount > 0
    ? `/projects/${projectSlug}/incidents?status=open`
    : `/projects/${projectSlug}/incidents`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href={href}>
              <AlertTriangle className={`h-5 w-5 ${openCount ? 'text-amber-600' : 'text-muted-foreground'}`} />
              {openCount ? (
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
            {openCount
              ? `${openCount} open incident${openCount === 1 ? '' : 's'}`
              : 'Incident queue'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
