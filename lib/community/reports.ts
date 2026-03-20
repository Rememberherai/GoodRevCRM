import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supabase = SupabaseClient<Database>;

export interface ProgramPerformanceReport {
  program_id: string;
  program_name: string;
  status: string;
  total_enrolled: number;
  active_enrolled: number;
  completed: number;
  withdrawn: number;
  total_attendance_records: number;
  total_hours: number;
  unique_participants: number;
}

export interface ContributionSummaryReport {
  by_type: { type: string; count: number; total_value: number; total_hours: number }[];
  by_dimension: { dimension_id: string; dimension_label: string; count: number; total_value: number }[];
  by_status: { status: string; count: number; total_value: number }[];
}

export interface HouseholdDemographicsReport {
  total_households: number;
  total_members: number;
  avg_household_size: number;
  by_city: { city: string; count: number }[];
}

export interface VolunteerImpactReport {
  total_volunteers: number;
  total_hours: number;
  estimated_value: number;
  by_program: { program_id: string; program_name: string; hours: number; volunteers: number }[];
}

export interface ContractorHoursReport {
  total_contractors: number;
  total_hours: number;
  by_contractor: {
    contractor_id: string;
    contractor_name: string;
    hours: number;
    jobs: number;
    out_of_scope_jobs: number;
  }[];
}

export async function getProgramPerformanceReport(
  supabase: Supabase,
  projectId: string
): Promise<ProgramPerformanceReport[]> {
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, status')
    .eq('project_id', projectId);

  if (!programs?.length) return [];

  const results: ProgramPerformanceReport[] = [];

  for (const program of programs) {
    const [enrollments, attendance] = await Promise.all([
      supabase
        .from('program_enrollments')
        .select('status, person_id')
        .eq('program_id', program.id),
      supabase
        .from('program_attendance')
        .select('person_id, hours, status')
        .eq('program_id', program.id),
    ]);

    const enrolled = enrollments.data ?? [];
    const attended = attendance.data ?? [];

    const uniqueParticipants = new Set([
      ...enrolled.map((e) => e.person_id).filter(Boolean),
      ...attended.map((a) => a.person_id).filter(Boolean),
    ]);

    results.push({
      program_id: program.id,
      program_name: program.name,
      status: program.status ?? 'planning',
      total_enrolled: enrolled.length,
      active_enrolled: enrolled.filter((e) => e.status === 'active').length,
      completed: enrolled.filter((e) => e.status === 'completed').length,
      withdrawn: enrolled.filter((e) => e.status === 'withdrawn').length,
      total_attendance_records: attended.filter((a) => a.status === 'present').length,
      total_hours: attended.reduce((sum, a) => sum + (a.hours ?? 0), 0),
      unique_participants: uniqueParticipants.size,
    });
  }

  return results;
}

export async function getContributionSummaryReport(
  supabase: Supabase,
  projectId: string
): Promise<ContributionSummaryReport> {
  const { data: contributions } = await supabase
    .from('contributions')
    .select('type, status, value, hours, dimension_id')
    .eq('project_id', projectId);

  const items = contributions ?? [];

  // By type
  const typeMap = new Map<string, { count: number; total_value: number; total_hours: number }>();
  for (const c of items) {
    const t = c.type ?? 'unknown';
    const entry = typeMap.get(t) ?? { count: 0, total_value: 0, total_hours: 0 };
    entry.count++;
    entry.total_value += Number(c.value ?? 0);
    entry.total_hours += Number(c.hours ?? 0);
    typeMap.set(t, entry);
  }

  // By dimension — need dimension labels
  const dimensionIds = [...new Set(items.map((c) => c.dimension_id).filter(Boolean))] as string[];
  let dimensionMap = new Map<string, string>();
  if (dimensionIds.length) {
    const { data: dims } = await supabase
      .from('impact_dimensions')
      .select('id, label')
      .in('id', dimensionIds);
    dimensionMap = new Map((dims ?? []).map((d) => [d.id, d.label]));
  }

  const dimAgg = new Map<string, { label: string; count: number; total_value: number }>();
  for (const c of items) {
    if (!c.dimension_id) continue;
    const entry = dimAgg.get(c.dimension_id) ?? {
      label: dimensionMap.get(c.dimension_id) ?? 'Unknown',
      count: 0,
      total_value: 0,
    };
    entry.count++;
    entry.total_value += Number(c.value ?? 0);
    dimAgg.set(c.dimension_id, entry);
  }

  // By status
  const statusMap = new Map<string, { count: number; total_value: number }>();
  for (const c of items) {
    const s = c.status ?? 'unknown';
    const entry = statusMap.get(s) ?? { count: 0, total_value: 0 };
    entry.count++;
    entry.total_value += Number(c.value ?? 0);
    statusMap.set(s, entry);
  }

  return {
    by_type: [...typeMap.entries()].map(([type, data]) => ({ type, ...data })),
    by_dimension: [...dimAgg.entries()].map(([dimension_id, data]) => ({
      dimension_id,
      dimension_label: data.label,
      count: data.count,
      total_value: data.total_value,
    })),
    by_status: [...statusMap.entries()].map(([status, data]) => ({ status, ...data })),
  };
}

export async function getHouseholdDemographicsReport(
  supabase: Supabase,
  projectId: string
): Promise<HouseholdDemographicsReport> {
  const { data: households } = await supabase
    .from('households')
    .select('id, address_city, household_size')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  const items = households ?? [];

  const cityMap = new Map<string, number>();
  let totalSize = 0;
  for (const h of items) {
    const city = h.address_city ?? 'Unknown';
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    totalSize += h.household_size ?? 0;
  }

  const householdIds = items.map((h) => h.id);
  const memberCount = householdIds.length === 0
    ? 0
    : (
        await supabase
          .from('household_members')
          .select('id', { count: 'exact', head: true })
          .in('household_id', householdIds)
      ).count ?? 0;

  return {
    total_households: items.length,
    total_members: memberCount ?? 0,
    avg_household_size: items.length > 0 ? totalSize / items.length : 0,
    by_city: [...cityMap.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getVolunteerImpactReport(
  supabase: Supabase,
  projectId: string,
  hourlyRate = 33.49
): Promise<VolunteerImpactReport> {
  const { data: contributions } = await supabase
    .from('contributions')
    .select('hours, donor_person_id, program_id')
    .eq('project_id', projectId)
    .in('type', ['volunteer_hours', 'service']);

  const items = contributions ?? [];
  const totalHours = items.reduce((sum, c) => sum + Number(c.hours ?? 0), 0);
  const uniqueVolunteers = new Set(items.map((c) => c.donor_person_id).filter(Boolean));

  // By program
  const programMap = new Map<string, { hours: number; volunteers: Set<string> }>();
  for (const c of items) {
    if (!c.program_id) continue;
    const entry = programMap.get(c.program_id) ?? { hours: 0, volunteers: new Set<string>() };
    entry.hours += Number(c.hours ?? 0);
    if (c.donor_person_id) entry.volunteers.add(c.donor_person_id);
    programMap.set(c.program_id, entry);
  }

  // Get program names
  const programIds = [...programMap.keys()];
  let programNames = new Map<string, string>();
  if (programIds.length) {
    const { data: programs } = await supabase
      .from('programs')
      .select('id, name')
      .in('id', programIds);
    programNames = new Map((programs ?? []).map((p) => [p.id, p.name]));
  }

  return {
    total_volunteers: uniqueVolunteers.size,
    total_hours: totalHours,
    estimated_value: totalHours * hourlyRate,
    by_program: [...programMap.entries()].map(([program_id, data]) => ({
      program_id,
      program_name: programNames.get(program_id) ?? 'Unknown',
      hours: data.hours,
      volunteers: data.volunteers.size,
    })),
  };
}

/**
 * Unduplicated participant count across all programs in a project.
 * Same person enrolled in 2 programs = counted once.
 */
export async function getUnduplicatedParticipantCount(
  supabase: Supabase,
  projectId: string
): Promise<number> {
  const { data: programs } = await supabase
    .from('programs')
    .select('id')
    .eq('project_id', projectId);

  if (!programs?.length) return 0;

  const programIds = programs.map((p) => p.id);

  const { data: enrollments } = await supabase
    .from('program_enrollments')
    .select('person_id')
    .in('program_id', programIds);

  const unique = new Set((enrollments ?? []).map((e) => e.person_id).filter(Boolean));
  return unique.size;
}

export async function getContractorHoursReport(
  supabase: Supabase,
  projectId: string
): Promise<ContractorHoursReport> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, contractor_id, title, is_out_of_scope')
    .eq('project_id', projectId);

  const jobItems = jobs ?? [];
  if (jobItems.length === 0) {
    return {
      total_contractors: 0,
      total_hours: 0,
      by_contractor: [],
    };
  }

  const jobIds = jobItems.map((job) => job.id);
  const contractorIds = [...new Set(jobItems.map((job) => job.contractor_id).filter(Boolean))] as string[];

  const [{ data: timeEntries }, { data: contractors }] = await Promise.all([
    supabase
      .from('job_time_entries')
      .select('job_id, duration_minutes, started_at, ended_at')
      .in('job_id', jobIds),
    contractorIds.length > 0
      ? supabase
          .from('people')
          .select('id, first_name, last_name')
          .in('id', contractorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const jobById = new Map(jobItems.map((job) => [job.id, job]));
  const nameById = new Map(
    (contractors ?? []).map((contractor) => [
      contractor.id,
      [contractor.first_name, contractor.last_name].filter(Boolean).join(' ') || 'Unknown contractor',
    ])
  );

  const contractorMap = new Map<string, { hours: number; jobs: Set<string>; outOfScopeJobs: number }>();
  for (const entry of timeEntries ?? []) {
    const job = jobById.get(entry.job_id);
    if (!job?.contractor_id) continue;

    const durationMinutes = entry.duration_minutes ?? (
      entry.ended_at
        ? (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000
        : 0
    );

    const aggregate = contractorMap.get(job.contractor_id) ?? {
      hours: 0,
      jobs: new Set<string>(),
      outOfScopeJobs: 0,
    };

    aggregate.hours += Math.max(0, Number(durationMinutes) / 60);
    if (!aggregate.jobs.has(job.id) && job.is_out_of_scope) {
      aggregate.outOfScopeJobs += 1;
    }
    aggregate.jobs.add(job.id);
    contractorMap.set(job.contractor_id, aggregate);
  }

  const byContractor = [...contractorMap.entries()]
    .map(([contractorId, data]) => ({
      contractor_id: contractorId,
      contractor_name: nameById.get(contractorId) ?? 'Unknown contractor',
      hours: data.hours,
      jobs: data.jobs.size,
      out_of_scope_jobs: data.outOfScopeJobs,
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    total_contractors: byContractor.length,
    total_hours: byContractor.reduce((sum, item) => sum + item.hours, 0),
    by_contractor: byContractor,
  };
}
