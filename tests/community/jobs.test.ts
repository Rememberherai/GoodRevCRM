import { describe, expect, it } from 'vitest';
import { computeTimeEntryDurationMinutes, formatWorkPlanLines, sortJobsForWorkPlan } from '@/lib/community/jobs';

describe('Community job helpers', () => {
  it('computes rounded time entry durations in minutes', () => {
    expect(
      computeTimeEntryDurationMinutes('2026-03-20T10:00:00.000Z', '2026-03-20T11:29:29.000Z')
    ).toBe(89);
    expect(computeTimeEntryDurationMinutes('2026-03-20T10:00:00.000Z', null)).toBeNull();
  });

  it('sorts work plans by priority, deadline, then desired start', () => {
    const jobs = sortJobsForWorkPlan([
      { title: 'Low later', priority: 'low', deadline: '2026-03-22T10:00:00.000Z', desired_start: '2026-03-21T09:00:00.000Z' },
      { title: 'High first', priority: 'high', deadline: '2026-03-25T10:00:00.000Z', desired_start: '2026-03-21T12:00:00.000Z' },
      { title: 'Medium urgent', priority: 'medium', deadline: '2026-03-21T08:00:00.000Z', desired_start: '2026-03-21T07:00:00.000Z' },
    ]);

    expect(jobs.map((job) => job.title)).toEqual(['High first', 'Medium urgent', 'Low later']);
  });

  it('formats work plan lines with ordering and schedule metadata', () => {
    const lines = formatWorkPlanLines([
      { title: 'Patch drywall', priority: 'high', desired_start: '2026-03-20T14:00:00.000Z', deadline: '2026-03-21T18:00:00.000Z' },
      { title: 'Paint hallway', priority: 'medium', desired_start: '2026-03-22T09:00:00.000Z', deadline: '2026-03-23T17:00:00.000Z' },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('1. Patch drywall');
    expect(lines[0]).toContain('priority high');
    expect(lines[1]).toContain('2. Paint hallway');
  });
});
