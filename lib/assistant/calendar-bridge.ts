import { createAdminClient } from '@/lib/supabase/admin';
import { createEvent, ensureFreshToken } from '@/lib/calendar/google-calendar';

const DEFAULT_TIME_ZONE = 'America/Denver';

function resolveProgramTimes(schedule: Record<string, unknown> | null | undefined, fallbackDate: string | null) {
  const sessionStart = typeof schedule?.session_start === 'string' ? schedule.session_start : null;
  const sessionEnd = typeof schedule?.session_end === 'string' ? schedule.session_end : null;

  if (sessionStart && sessionEnd) {
    return { startAt: sessionStart, endAt: sessionEnd };
  }

  if (fallbackDate?.includes('T')) {
    const startAt = fallbackDate;
    const endAt = sessionEnd ?? startAt;
    return { startAt, endAt };
  }

  return null;
}

async function findProjectCalendarIntegration(projectId: string, preferredUserId?: string | null) {
  const admin = createAdminClient();
  const candidateIds = new Set<string>();

  if (preferredUserId) {
    candidateIds.add(preferredUserId);
  }

  const { data: project } = await admin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single();

  if (project?.owner_id) {
    candidateIds.add(project.owner_id);
  }

  const { data: memberships } = await admin
    .from('project_memberships')
    .select('user_id')
    .eq('project_id', projectId);

  for (const membership of memberships ?? []) {
    candidateIds.add(membership.user_id);
  }

  const userIds = [...candidateIds];
  if (userIds.length === 0) return null;

  const { data: integrations } = await admin
    .from('calendar_integrations')
    .select('id, user_id, calendar_id, push_enabled, status')
    .in('user_id', userIds)
    .eq('status', 'connected')
    .eq('push_enabled', true)
    .order('is_primary', { ascending: false })
    .limit(1);

  return integrations?.[0] ?? null;
}

export async function syncProgramSession(programId: string) {
  const admin = createAdminClient();
  const { data: program } = await admin
    .from('programs')
    .select('id, project_id, name, description, location_name, schedule, start_date, end_date')
    .eq('id', programId)
    .single();

  if (!program) {
    throw new Error('Program not found');
  }

  const { data: project } = await admin
    .from('projects')
    .select('calendar_sync_enabled')
    .eq('id', program.project_id)
    .single();

  if (!project?.calendar_sync_enabled) {
    return { synced: false, reason: 'Calendar sync is disabled for this project' };
  }

  const times = resolveProgramTimes(program.schedule as Record<string, unknown> | null, program.start_date);
  if (!times) {
    return { synced: false, reason: 'Program needs structured start and end times before it can sync to Google Calendar' };
  }

  const integration = await findProjectCalendarIntegration(program.project_id);
  if (!integration) {
    return { synced: false, reason: 'No connected Google Calendar integration is available for this project' };
  }

  const accessToken = await ensureFreshToken(integration.id);
  const event = await createEvent(accessToken, integration.calendar_id ?? 'primary', {
    summary: program.name,
    description: program.description ?? undefined,
    location: program.location_name ?? undefined,
    start: { dateTime: times.startAt, timeZone: DEFAULT_TIME_ZONE },
    end: { dateTime: times.endAt, timeZone: DEFAULT_TIME_ZONE },
  });

  return {
    synced: true,
    eventId: event.id,
    integrationId: integration.id,
  };
}

export async function syncJobAssignment(jobId: string) {
  const admin = createAdminClient();
  // Pre-migration generated types do not include community people.user_id yet.
  const { data: job } = await (admin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { single: () => Promise<{ data: Record<string, unknown> | null }> };
      };
    };
  })
    .from('jobs')
    .select('id, project_id, title, description, desired_start, deadline, contractor_id, service_address')
    .eq('id', jobId)
    .single();

  if (!job) {
    throw new Error('Job not found');
  }

  const { data: project } = await admin
    .from('projects')
    .select('calendar_sync_enabled')
    .eq('id', job.project_id as string)
    .single();

  if (!project?.calendar_sync_enabled) {
    return { synced: false, reason: 'Calendar sync is disabled for this project' };
  }

  if (typeof job.desired_start !== 'string' || typeof job.deadline !== 'string') {
    return { synced: false, reason: 'Job needs both a desired start and deadline before it can sync' };
  }

  let preferredUserId: string | null = null;
  if (typeof job.contractor_id === 'string') {
    const { data: contractor } = await (admin as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { user_id?: string | null } | null }> };
        };
      };
    })
      .from('people')
      .select('user_id')
      .eq('id', job.contractor_id)
      .maybeSingle();

    preferredUserId = contractor?.user_id ?? null;
  }

  const integration = await findProjectCalendarIntegration(job.project_id as string, preferredUserId);
  if (!integration) {
    return { synced: false, reason: 'No connected Google Calendar integration is available for this assignment' };
  }

  const accessToken = await ensureFreshToken(integration.id);
  const event = await createEvent(accessToken, integration.calendar_id ?? 'primary', {
    summary: typeof job.title === 'string' ? job.title : 'Assigned job',
    description: typeof job.description === 'string' ? job.description : undefined,
    location: typeof job.service_address === 'string' ? job.service_address : undefined,
    start: { dateTime: job.desired_start, timeZone: DEFAULT_TIME_ZONE },
    end: { dateTime: job.deadline, timeZone: DEFAULT_TIME_ZONE },
  });

  return {
    synced: true,
    eventId: event.id,
    integrationId: integration.id,
  };
}

export async function syncGrantDeadline(grantId: string, deadlineType: 'loi' | 'application' | 'report', date: string) {
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('grants')
    .select('id, project_id, name, assigned_to')
    .eq('id', grantId)
    .single();

  if (!grant) {
    throw new Error('Grant not found');
  }

  const { data: project } = await admin
    .from('projects')
    .select('calendar_sync_enabled')
    .eq('id', grant.project_id)
    .single();

  if (!project?.calendar_sync_enabled) {
    return { synced: false, reason: 'Calendar sync is disabled for this project' };
  }

  const integration = await findProjectCalendarIntegration(grant.project_id, grant.assigned_to);
  if (!integration) {
    return { synced: false, reason: 'No connected Google Calendar integration is available for this project' };
  }

  const typeLabels: Record<string, string> = {
    loi: 'LOI Deadline',
    application: 'Application Deadline',
    report: 'Report Deadline',
  };

  const accessToken = await ensureFreshToken(integration.id);
  const event = await createEvent(accessToken, integration.calendar_id ?? 'primary', {
    summary: `${typeLabels[deadlineType] ?? 'Deadline'}: ${grant.name}`,
    description: `Grant deadline for "${grant.name}" — ${typeLabels[deadlineType] ?? deadlineType}`,
    start: { dateTime: `${date}T09:00:00`, timeZone: DEFAULT_TIME_ZONE },
    end: { dateTime: `${date}T10:00:00`, timeZone: DEFAULT_TIME_ZONE },
  });

  return {
    synced: true,
    eventId: event.id,
    integrationId: integration.id,
  };
}
