'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BugReportModal } from './bug-report-modal';

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
            >
              <Bug className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Report a bug</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <BugReportModal
        open={open}
        onOpenChange={setOpen}
        pageUrl={pathname}
      />
    </>
  );
}
