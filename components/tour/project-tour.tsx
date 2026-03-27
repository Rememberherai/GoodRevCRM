'use client';

import { useEffect, useState, useCallback } from 'react';
import { Joyride, STATUS, type EventData, type Controls, type Step } from 'react-joyride';
import { useTourStore } from '@/stores/tour';
import { getVisibleTourSteps } from '@/lib/tour/steps';
import type { ProjectType } from '@/types/project';

interface ProjectTourProps {
  projectId: string;
  projectType: ProjectType;
}

export function ProjectTour({ projectId, projectType }: ProjectTourProps) {
  const { isActive, startTour, endTour, hasSeen } = useTourStore();
  const [steps, setSteps] = useState<Step[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  // Check if we're on desktop (sidebar visible at md breakpoint)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-launch on first visit (desktop only)
  useEffect(() => {
    if (!isDesktop || hasSeen(projectId)) return;
    // Small delay to ensure sidebar is rendered
    const timer = setTimeout(() => {
      setSteps(getVisibleTourSteps(projectType));
      startTour();
    }, 500);
    return () => clearTimeout(timer);
  }, [isDesktop, projectId, projectType, hasSeen, startTour]);

  // When tour is triggered externally (e.g. from settings replay),
  // rebuild steps from current DOM
  useEffect(() => {
    if (isActive && steps.length === 0) {
      setSteps(getVisibleTourSteps(projectType));
    }
  }, [isActive, steps.length, projectType]);

  const handleEvent = useCallback(
    (data: EventData, _controls: Controls) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        endTour(projectId);
        setSteps([]);
      }
    },
    [endTour, projectId]
  );

  if (!isDesktop || !isActive || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={isActive}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        showProgress: true,
        skipBeacon: true,
        zIndex: 10000,
        primaryColor: 'hsl(222.2 47.4% 11.2%)',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        backgroundColor: 'hsl(0 0% 100%)',
        textColor: 'hsl(222.2 47.4% 11.2%)',
        buttons: ['back', 'primary', 'skip'],
      }}
      styles={{
        tooltipTitle: {
          fontSize: '1rem',
          fontWeight: 600,
        },
        tooltipContent: {
          fontSize: '0.875rem',
        },
        buttonPrimary: {
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
        },
        buttonBack: {
          fontSize: '0.875rem',
        },
        buttonSkip: {
          fontSize: '0.875rem',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}
