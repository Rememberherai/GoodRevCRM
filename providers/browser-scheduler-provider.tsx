'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useBrowserScheduler, type BrowserSchedulerState } from '@/hooks/use-browser-scheduler';

interface BrowserSchedulerContextType extends BrowserSchedulerState {
  providerEnabled: boolean;
}

const BrowserSchedulerContext = createContext<BrowserSchedulerContextType>({
  providerEnabled: false,
  isLeader: false,
  isRunning: false,
  activeJobCount: 0,
  lastRuns: {},
  refresh: () => {},
});

export function useBrowserSchedulerContext() {
  return useContext(BrowserSchedulerContext);
}

interface Props {
  slug: string;
  children: React.ReactNode;
}

/** Dispatch after saving scheduler provider config to trigger re-check */
export function notifySchedulerProviderChanged() {
  window.dispatchEvent(new CustomEvent('scheduler-provider-changed'));
}

/** Dispatch after creating/deleting/toggling/rescheduling a job */
export function notifySchedulerJobsChanged() {
  window.dispatchEvent(new CustomEvent('scheduler-jobs-changed'));
}

/**
 * Wraps the project layout with browser scheduler state.
 * Checks if the active scheduler provider is 'browser' on mount,
 * then runs the browser scheduler engine if so.
 */
export function BrowserSchedulerProvider({ slug, children }: Props) {
  const [providerEnabled, setProviderEnabled] = useState(false);
  const [checkCounter, setCheckCounter] = useState(0);

  // Re-check when the scheduler-provider-changed event fires
  useEffect(() => {
    const handler = () => setCheckCounter((c) => c + 1);
    window.addEventListener('scheduler-provider-changed', handler);
    return () => window.removeEventListener('scheduler-provider-changed', handler);
  }, []);

  // Check if the active provider is 'browser'
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/projects/${slug}/scheduler/jobs`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setProviderEnabled(data.providerType === 'browser' && data.configured === true);
      } catch {
        setProviderEnabled(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [slug, checkCounter]);

  const scheduler = useBrowserScheduler(slug, providerEnabled);

  return (
    <BrowserSchedulerContext.Provider
      value={{
        providerEnabled,
        ...scheduler,
      }}
    >
      {children}
    </BrowserSchedulerContext.Provider>
  );
}
