'use client';

import { useBrowserSchedulerContext } from '@/providers/browser-scheduler-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Small indicator in the project header showing browser scheduler status.
 * - Green pulsing dot: this tab is the leader, running jobs
 * - Amber dot: browser scheduler is enabled but running in another tab
 * - Hidden: browser scheduler not enabled
 */
export function BrowserSchedulerIndicator() {
  const { providerEnabled, isLeader, isRunning, activeJobCount } = useBrowserSchedulerContext();

  if (!providerEnabled) return null;

  const isActive = isRunning && isLeader;
  const inOtherTab = providerEnabled && !isLeader;

  const dotColor = isActive
    ? 'bg-green-500'
    : inOtherTab
      ? 'bg-amber-500'
      : 'bg-gray-400';

  const tooltipText = isActive
    ? `Browser scheduler active (${activeJobCount} job${activeJobCount !== 1 ? 's' : ''})`
    : inOtherTab
      ? 'Browser scheduler running in another tab'
      : 'Browser scheduler enabled (no jobs active)';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-1.5">
            <span className="relative flex h-2.5 w-2.5">
              {isActive && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`} />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {isActive ? 'Scheduler' : inOtherTab ? 'Other tab' : ''}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
