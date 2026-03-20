import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncProgramSession } from '@/lib/assistant/calendar-bridge';
import { createAdminClient } from '@/lib/supabase/admin';
import { createEvent, ensureFreshToken } from '@/lib/calendar/google-calendar';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/calendar/google-calendar', () => ({
  createEvent: vi.fn(),
  ensureFreshToken: vi.fn(),
}));

function createCalendarAdminClient(overrides?: {
  program?: Record<string, unknown> | null;
  project?: Record<string, unknown> | null;
  integration?: Record<string, unknown> | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === 'programs') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: overrides?.program ?? {
                id: 'program-1',
                project_id: 'project-1',
                name: 'ESL Class',
                description: 'Weekly class',
                location_name: 'Community Hall',
                schedule: null,
                start_date: '2026-03-20',
                end_date: '2026-03-20',
              },
            }),
          })),
        })),
      };
    }

    if (table === 'projects') {
      return {
        select: vi.fn((columns: string) => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: columns === 'owner_id'
                ? { owner_id: 'owner-1' }
                : overrides?.project ?? { calendar_sync_enabled: true },
            }),
          })),
        })),
      };
    }

    if (table === 'project_memberships') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'owner-1' }], error: null }),
        })),
      };
    }

    if (table === 'calendar_integrations') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: overrides?.integration ? [overrides.integration] : [{
                      id: 'integration-1',
                      user_id: 'owner-1',
                      calendar_id: 'primary',
                    }],
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      };
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    };
  });

  return { from };
}

describe('calendar bridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips syncing when a program does not have structured time bounds', async () => {
    vi.mocked(createAdminClient).mockReturnValue(createCalendarAdminClient() as never);

    const result = await syncProgramSession('program-1');

    expect(result.synced).toBe(false);
    expect(result.reason).toContain('structured start and end times');
  });

  it('creates a Google Calendar event when structured schedule times exist', async () => {
    vi.mocked(createAdminClient).mockReturnValue(createCalendarAdminClient({
      program: {
        id: 'program-1',
        project_id: 'project-1',
        name: 'ESL Class',
        description: 'Weekly class',
        location_name: 'Community Hall',
        schedule: {
          session_start: '2026-03-20T18:00:00',
          session_end: '2026-03-20T20:00:00',
        },
        start_date: '2026-03-20',
        end_date: '2026-03-20',
      },
    }) as never);
    vi.mocked(ensureFreshToken).mockResolvedValue('google-token');
    vi.mocked(createEvent).mockResolvedValue({
      id: 'event-1',
      start: { dateTime: '2026-03-20T18:00:00' },
      end: { dateTime: '2026-03-20T20:00:00' },
    });

    const result = await syncProgramSession('program-1');

    expect(ensureFreshToken).toHaveBeenCalledWith('integration-1');
    expect(createEvent).toHaveBeenCalled();
    expect(result.synced).toBe(true);
    expect(result.eventId).toBe('event-1');
  });
});

