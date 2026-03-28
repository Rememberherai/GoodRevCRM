import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supabase = SupabaseClient<Database>;

export interface DateRangeFilter {
  from: string;
  to: string;
}

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

export interface GrantPipelineReport {
  by_status: { status: string; count: number; total_amount: number }[];
  compliance: {
    grant_id: string;
    grant_name: string;
    status: string;
    amount_awarded: number | null;
    total_spend: number;
    budget_utilization_pct: number;
  }[];
}

export interface EngagementTrendsReport {
  monthly_attendance: { month: string; count: number; hours: number }[];
  monthly_households: { month: string; count: number }[];
  monthly_contributions: { month: string; type: string; value: number; count: number }[];
}

export interface RiskReferralReport {
  risk_tiers: { tier: string; count: number }[];
  risk_factors: { factor: string; count: number }[];
  referrals_by_status: { status: string; count: number }[];
  referrals_by_service: { service_type: string; count: number }[];
}

// ============================================================
// Event Reports
// ============================================================

export interface EventOverviewReport {
  total_events: number;
  total_registrations: number;
  total_check_ins: number;
  avg_attendance_rate: number;
  unduplicated_event_participants: number;
  new_attendees: number;
  returning_attendees: number;
  unlinked_registrations: number;
  by_status: { status: string; count: number }[];
  by_source: { source: string; count: number }[];
  by_category: { category: string; count: number }[];
  top_events_by_attendance: {
    event_id: string;
    title: string;
    starts_at: string;
    registrations: number;
    checked_in: number;
    attendance_rate: number;
    capacity: number | null;
    capacity_utilization: number | null;
    series_id: string | null;
  }[];
  monthly_events: { month: string; count: number; registrations: number; check_ins: number }[];
  new_vs_returning_by_month: { month: string; new_attendees: number; returning_attendees: number; unique_attendees: number }[];
  by_category_stats: {
    category: string;
    event_count: number;
    registrations: number;
    check_ins: number;
    attendance_rate: number;
    unique_participants: number;
    new_attendees: number;
    returning_attendees: number;
  }[];
}

export interface IndividualEventReport {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  capacity: number | null;
  registration_funnel: {
    total_registered: number;
    confirmed: number;
    checked_in: number;
    cancelled: number;
    waitlisted: number;
    pending_approval: number;
    pending_waiver: number;
  };
  registration_timeline: { date: string; cumulative: number }[];
  source_breakdown: { source: string; count: number }[];
  ticket_type_breakdown: { ticket_type: string; count: number; revenue_cents: number }[];
  waiver_completion_rate: number | null;
  new_attendees: number;
  returning_attendees: number;
  unlinked_registrations: number;
  notes: {
    id: string;
    category: string | null;
    content: string;
    is_pinned: boolean;
    created_at: string;
    created_by_name: string;
  }[];
}

export interface SeriesReport {
  series_id: string;
  title: string;
  recurrence_frequency: string;
  total_instances: number;
  total_series_registrations: number;
  new_to_series: number;
  returning_in_series: number;
  attendance_trend: {
    event_id: string;
    title: string;
    starts_at: string;
    registrations: number;
    checked_in: number;
    attendance_rate: number;
    new_to_series: number;
    returning_in_series: number;
  }[];
  retention: {
    instance_number: number;
    title: string;
    series_registrants_present: number;
    total_series_registrants: number;
    retention_rate: number;
  }[];
  notes_summary: {
    total_notes: number;
    by_category: { category: string; count: number }[];
    recent_notes: {
      event_title: string;
      content: string;
      category: string | null;
      created_at: string;
    }[];
    all_notes: {
      event_title: string;
      content: string;
      category: string | null;
      created_at: string;
    }[];
  };
}

export async function getProgramPerformanceReport(
  supabase: Supabase,
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<ProgramPerformanceReport[]> {
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, status')
    .eq('project_id', projectId);

  if (!programs?.length) return [];

  const results: ProgramPerformanceReport[] = [];

  for (const program of programs) {
    let enrollmentQuery = supabase
      .from('program_enrollments')
      .select('status, person_id')
      .eq('program_id', program.id);
    if (dateRange) {
      enrollmentQuery = enrollmentQuery.gte('enrolled_at', dateRange.from).lte('enrolled_at', dateRange.to);
    }

    let attendanceQuery = supabase
      .from('program_attendance')
      .select('person_id, hours, status')
      .eq('program_id', program.id);
    if (dateRange) {
      attendanceQuery = attendanceQuery.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const [enrollments, attendance] = await Promise.all([
      enrollmentQuery,
      attendanceQuery,
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
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<ContributionSummaryReport> {
  let query = supabase
    .from('contributions')
    .select('type, status, value, hours, dimension_ids')
    .eq('project_id', projectId);
  if (dateRange) {
    query = query.gte('date', dateRange.from).lte('date', dateRange.to);
  }

  const { data: contributions } = await query;
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
  const allDimIds = new Set<string>();
  for (const c of items) {
    for (const id of c.dimension_ids ?? []) allDimIds.add(id);
  }
  const dimensionIds = [...allDimIds];
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
    for (const dimId of c.dimension_ids ?? []) {
      const entry = dimAgg.get(dimId) ?? {
        label: dimensionMap.get(dimId) ?? 'Unknown',
        count: 0,
        total_value: 0,
      };
      entry.count++;
      entry.total_value += Number(c.value ?? 0);
      dimAgg.set(dimId, entry);
    }
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
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<HouseholdDemographicsReport> {
  let query = supabase
    .from('households')
    .select('id, address_city, household_size')
    .eq('project_id', projectId)
    .is('deleted_at', null);
  if (dateRange) {
    query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
  }

  const { data: households } = await query;
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
  hourlyRate = 33.49,
  dateRange?: DateRangeFilter
): Promise<VolunteerImpactReport> {
  let query = supabase
    .from('contributions')
    .select('hours, donor_person_id, program_id')
    .eq('project_id', projectId)
    .in('type', ['volunteer_hours', 'service']);
  if (dateRange) {
    query = query.gte('date', dateRange.from).lte('date', dateRange.to);
  }

  const { data: contributions } = await query;
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
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<number> {
  const { data: programs } = await supabase
    .from('programs')
    .select('id')
    .eq('project_id', projectId);

  if (!programs?.length) return 0;

  const programIds = programs.map((p) => p.id);

  let query = supabase
    .from('program_enrollments')
    .select('person_id')
    .in('program_id', programIds);
  if (dateRange) {
    query = query.gte('enrolled_at', dateRange.from).lte('enrolled_at', dateRange.to);
  }

  const { data: enrollments } = await query;
  const unique = new Set((enrollments ?? []).map((e) => e.person_id).filter(Boolean));
  return unique.size;
}

export async function getContractorHoursReport(
  supabase: Supabase,
  projectId: string,
  dateRange?: DateRangeFilter
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

  let timeQuery = supabase
    .from('job_time_entries')
    .select('job_id, duration_minutes, started_at, ended_at')
    .in('job_id', jobIds);
  if (dateRange) {
    timeQuery = timeQuery.gte('started_at', dateRange.from).lte('started_at', dateRange.to);
  }

  const [{ data: timeEntries }, { data: contractors }] = await Promise.all([
    timeQuery,
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
    const job = entry.job_id ? jobById.get(entry.job_id) : undefined;
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

// --- Phase 3 query functions ---

export async function getGrantPipelineReport(
  supabase: Supabase,
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<GrantPipelineReport> {
  let query = supabase
    .from('grants')
    .select('id, name, status, amount_requested, amount_awarded')
    .eq('project_id', projectId);
  if (dateRange) {
    query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
  }

  const { data: grants } = await query;
  const items = grants ?? [];

  // By status
  const statusMap = new Map<string, { count: number; total_amount: number }>();
  for (const g of items) {
    const s = g.status ?? 'unknown';
    const entry = statusMap.get(s) ?? { count: 0, total_amount: 0 };
    entry.count++;
    entry.total_amount += Number(g.amount_awarded ?? g.amount_requested ?? 0);
    statusMap.set(s, entry);
  }

  // Compliance for awarded/active grants
  const awardedGrants = items.filter((g) => ['awarded', 'active'].includes(g.status ?? ''));
  const compliance: GrantPipelineReport['compliance'] = [];

  for (const g of awardedGrants) {
    const { data: contributions } = await supabase
      .from('contributions')
      .select('value')
      .eq('project_id', projectId)
      .eq('grant_id', g.id);

    const totalSpend = (contributions ?? []).reduce((sum, c) => sum + Number(c.value ?? 0), 0);
    const awarded = Number(g.amount_awarded ?? 0);

    compliance.push({
      grant_id: g.id,
      grant_name: g.name,
      status: g.status ?? 'unknown',
      amount_awarded: g.amount_awarded,
      total_spend: totalSpend,
      budget_utilization_pct: awarded > 0 ? Math.round((totalSpend / awarded) * 100) : 0,
    });
  }

  const statusOrder = ['researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined', 'not_a_fit'];

  return {
    by_status: [...statusMap.entries()]
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)),
    compliance,
  };
}

export async function getEngagementTrendsReport(
  supabase: Supabase,
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<EngagementTrendsReport> {
  // Get program IDs for this project
  const { data: programs } = await supabase
    .from('programs')
    .select('id')
    .eq('project_id', projectId);
  const programIds = (programs ?? []).map((p) => p.id);

  // Attendance
  let attendanceQuery = supabase
    .from('program_attendance')
    .select('date, hours, status')
    .in('program_id', programIds.length ? programIds : ['__none__']);
  if (dateRange) {
    attendanceQuery = attendanceQuery.gte('date', dateRange.from).lte('date', dateRange.to);
  }

  // Households
  let householdQuery = supabase
    .from('households')
    .select('created_at')
    .eq('project_id', projectId)
    .is('deleted_at', null);
  if (dateRange) {
    householdQuery = householdQuery.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
  }

  // Contributions
  let contribQuery = supabase
    .from('contributions')
    .select('date, type, value')
    .eq('project_id', projectId);
  if (dateRange) {
    contribQuery = contribQuery.gte('date', dateRange.from).lte('date', dateRange.to);
  }

  const [{ data: attendance }, { data: households }, { data: contributions }] = await Promise.all([
    attendanceQuery,
    householdQuery,
    contribQuery,
  ]);

  // Bucket attendance by month
  const attendanceByMonth = new Map<string, { count: number; hours: number }>();
  for (const a of attendance ?? []) {
    if (a.status !== 'present' || !a.date) continue;
    const month = a.date.substring(0, 7); // YYYY-MM
    const entry = attendanceByMonth.get(month) ?? { count: 0, hours: 0 };
    entry.count++;
    entry.hours += a.hours ?? 0;
    attendanceByMonth.set(month, entry);
  }

  // Bucket households by month
  const householdsByMonth = new Map<string, number>();
  for (const h of households ?? []) {
    if (!h.created_at) continue;
    const month = h.created_at.substring(0, 7);
    householdsByMonth.set(month, (householdsByMonth.get(month) ?? 0) + 1);
  }

  // Bucket contributions by month+type
  const contribByMonthType = new Map<string, { value: number; count: number }>();
  for (const c of contributions ?? []) {
    if (!c.date) continue;
    const month = c.date.substring(0, 7);
    const type = c.type ?? 'unknown';
    const key = `${month}|${type}`;
    const entry = contribByMonthType.get(key) ?? { value: 0, count: 0 };
    entry.value += Number(c.value ?? 0);
    entry.count++;
    contribByMonthType.set(key, entry);
  }

  return {
    monthly_attendance: [...attendanceByMonth.entries()]
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    monthly_households: [...householdsByMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    monthly_contributions: [...contribByMonthType.entries()]
      .map(([key, data]) => {
        const parts = key.split('|');
        return { month: parts[0] ?? '', type: parts[1] ?? '', ...data };
      })
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export async function getRiskReferralReport(
  supabase: Supabase,
  projectId: string
): Promise<RiskReferralReport> {
  // Get all households with their signals for risk scoring
  const { data: households } = await supabase
    .from('households')
    .select('id, name')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  const householdItems = households ?? [];
  const householdIds = householdItems.map((h) => h.id);

  // Gather signals for risk computation
  const [enrollmentsRes, relationshipsRes, referralsRes, activityRes] = await Promise.all([
    householdIds.length > 0
      ? supabase
          .from('program_enrollments')
          .select('household_id, status')
          .in('household_id', householdIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [] }),
    householdIds.length > 0
      ? supabase
          .from('relationships')
          .select('person_a_id, person_b_id')
          .eq('project_id', projectId)
      : Promise.resolve({ data: [] }),
    supabase
      .from('referrals')
      .select('status, service_type, household_id')
      .eq('project_id', projectId),
    householdIds.length > 0
      ? supabase
          .from('activity_log')
          .select('entity_id, created_at')
          .eq('project_id', projectId)
          .eq('entity_type', 'household')
          .in('entity_id', householdIds)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ data: [] }),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const relationships = relationshipsRes.data ?? [];
  const referrals = referralsRes.data ?? [];
  const recentActivity = activityRes.data ?? [];

  // Build household signal maps
  const activeEnrollmentsByHousehold = new Map<string, number>();
  for (const e of enrollments) {
    if (!e.household_id) continue;
    activeEnrollmentsByHousehold.set(e.household_id, (activeEnrollmentsByHousehold.get(e.household_id) ?? 0) + 1);
  }

  // Get person-to-household mapping for relationship counting
  const { data: members } = householdIds.length > 0
    ? await supabase
        .from('household_members')
        .select('person_id, household_id')
        .in('household_id', householdIds)
    : { data: [] };
  const personToHousehold = new Map<string, string>();
  for (const m of members ?? []) {
    if (m.person_id && m.household_id) personToHousehold.set(m.person_id, m.household_id);
  }

  const relationshipsByHousehold = new Map<string, number>();
  for (const r of relationships) {
    const hA = personToHousehold.get(r.person_a_id);
    const hB = personToHousehold.get(r.person_b_id);
    if (hA) relationshipsByHousehold.set(hA, (relationshipsByHousehold.get(hA) ?? 0) + 1);
    if (hB) relationshipsByHousehold.set(hB, (relationshipsByHousehold.get(hB) ?? 0) + 1);
  }

  const unresolvedRefsByHousehold = new Map<string, number>();
  for (const r of referrals) {
    if (!r.household_id || ['completed', 'closed'].includes(r.status)) continue;
    unresolvedRefsByHousehold.set(r.household_id, (unresolvedRefsByHousehold.get(r.household_id) ?? 0) + 1);
  }

  const recentEngagementByHousehold = new Set<string>();
  for (const a of recentActivity) {
    if (a.entity_id) recentEngagementByHousehold.add(a.entity_id);
  }

  // Compute risk tiers
  const { computeHouseholdRiskScore } = await import('@/lib/community/risk-index');
  const tierCounts = { low: 0, medium: 0, high: 0 };
  const factorCounts: Record<string, number> = {
    'No active program enrollments': 0,
    'No social relationships recorded': 0,
    'Open referrals unresolved': 0,
    'No recent engagement recorded': 0,
  };

  for (const h of householdItems) {
    const score = computeHouseholdRiskScore({
      householdId: h.id,
      householdName: h.name,
      activeProgramEnrollments: activeEnrollmentsByHousehold.get(h.id) ?? 0,
      relationshipCount: relationshipsByHousehold.get(h.id) ?? 0,
      unresolvedReferrals: unresolvedRefsByHousehold.get(h.id) ?? 0,
      recentEngagementCount: recentEngagementByHousehold.has(h.id) ? 1 : 0,
    });

    tierCounts[score.tier]++;
    for (const c of score.contributions) {
      if (c.active && c.label in factorCounts) {
        factorCounts[c.label] = (factorCounts[c.label] ?? 0) + 1;
      }
    }
  }

  // Referrals aggregation
  const refStatusMap = new Map<string, number>();
  const refServiceMap = new Map<string, number>();
  for (const r of referrals) {
    refStatusMap.set(r.status, (refStatusMap.get(r.status) ?? 0) + 1);
    if (r.service_type) {
      refServiceMap.set(r.service_type, (refServiceMap.get(r.service_type) ?? 0) + 1);
    }
  }

  return {
    risk_tiers: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
    risk_factors: Object.entries(factorCounts)
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count),
    referrals_by_status: [...refStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    referrals_by_service: [...refServiceMap.entries()]
      .map(([service_type, count]) => ({ service_type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ============================================================
// Event Reports
// ============================================================

/**
 * Fetches the earliest checked_in_at for each person across all project events.
 * Returns Map<person_id, earliest_checked_in_at>.
 * Scopes through events table since event_registrations has no project_id.
 */
async function getProjectAttendanceHistory(
  supabase: Supabase,
  projectEventIds: string[],
  personIds: string[]
): Promise<Map<string, string>> {
  if (personIds.length === 0 || projectEventIds.length === 0) return new Map();

  const result = new Map<string, string>();
  const PERSON_CHUNK_SIZE = 500;
  const EVENT_CHUNK_SIZE = 200;

  for (let personIndex = 0; personIndex < personIds.length; personIndex += PERSON_CHUNK_SIZE) {
    const personChunk = personIds.slice(personIndex, personIndex + PERSON_CHUNK_SIZE);

    for (let eventIndex = 0; eventIndex < projectEventIds.length; eventIndex += EVENT_CHUNK_SIZE) {
      const eventChunk = projectEventIds.slice(eventIndex, eventIndex + EVENT_CHUNK_SIZE);
      const { data, error } = await supabase
        .from('event_registrations')
        .select('person_id, checked_in_at')
        .in('event_id', eventChunk)
        .in('person_id', personChunk)
        .not('checked_in_at', 'is', null)
        .neq('status', 'cancelled');

      if (error) {
        throw new Error(`Failed to load attendance history: ${error.message}`);
      }

      if (!data) continue;

      for (const r of data) {
        if (!r.person_id || !r.checked_in_at) continue;
        const existing = result.get(r.person_id);
        if (!existing || r.checked_in_at < existing) {
          result.set(r.person_id, r.checked_in_at);
        }
      }
    }
  }

  return result;
}

export async function getEventOverviewReport(
  supabase: Supabase,
  projectId: string,
  dateRange?: DateRangeFilter
): Promise<EventOverviewReport> {
  let eventsQuery = supabase
    .from('events')
    .select('id, title, starts_at, status, category, total_capacity, series_id')
    .eq('project_id', projectId);
  if (dateRange) {
    eventsQuery = eventsQuery.gte('starts_at', dateRange.from).lte('starts_at', dateRange.to);
  }

  const { data: events } = await eventsQuery;
  const eventList = events ?? [];

  if (eventList.length === 0) {
    return {
      total_events: 0,
      total_registrations: 0,
      total_check_ins: 0,
      avg_attendance_rate: 0,
      unduplicated_event_participants: 0,
      new_attendees: 0,
      returning_attendees: 0,
      unlinked_registrations: 0,
      by_status: [],
      by_source: [],
      by_category: [],
      top_events_by_attendance: [],
      monthly_events: [],
      new_vs_returning_by_month: [],
      by_category_stats: [],
    };
  }

  const eventIds = eventList.map((e) => e.id);

  // Fetch all registrations for these events (non-cancelled only for counts)
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('id, event_id, person_id, status, checked_in_at, source')
    .in('event_id', eventIds);
  const regList = registrations ?? [];

  // Aggregate by status
  const statusMap = new Map<string, number>();
  for (const e of eventList) {
    const s = e.status ?? 'draft';
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }

  // Aggregate registrations by source
  const sourceMap = new Map<string, number>();
  for (const r of regList) {
    const s = r.source ?? 'web';
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
  }

  // Aggregate by category
  const categoryMap = new Map<string, number>();
  for (const e of eventList) {
    const c = e.category ?? 'uncategorized';
    categoryMap.set(c, (categoryMap.get(c) ?? 0) + 1);
  }

  // Per-event aggregation
  const eventRegMap = new Map<string, { registrations: number; checkedIn: number }>();
  for (const r of regList) {
    if (r.status === 'cancelled') continue;
    const entry = eventRegMap.get(r.event_id) ?? { registrations: 0, checkedIn: 0 };
    entry.registrations++;
    if (r.checked_in_at) entry.checkedIn++;
    eventRegMap.set(r.event_id, entry);
  }

  // Unduplicated participants
  const uniquePersonIds = new Set(regList.filter((r) => r.person_id && r.status !== 'cancelled').map((r) => r.person_id));

  // Totals
  const totalRegistrations = regList.filter((r) => r.status !== 'cancelled').length;
  const totalCheckIns = regList.filter((r) => r.checked_in_at && r.status !== 'cancelled').length;
  const avgAttendanceRate = totalRegistrations > 0 ? (totalCheckIns / totalRegistrations) * 100 : 0;

  // Top events by attendance
  const topEvents = eventList
    .map((e) => {
      const stats = eventRegMap.get(e.id) ?? { registrations: 0, checkedIn: 0 };
      const attendanceRate = stats.registrations > 0 ? (stats.checkedIn / stats.registrations) * 100 : 0;
      const capacityUtil = e.total_capacity ? (stats.registrations / e.total_capacity) * 100 : null;
      return {
        event_id: e.id,
        title: e.title,
        starts_at: e.starts_at,
        registrations: stats.registrations,
        checked_in: stats.checkedIn,
        attendance_rate: Math.round(attendanceRate * 10) / 10,
        capacity: e.total_capacity,
        capacity_utilization: capacityUtil !== null ? Math.round(capacityUtil * 10) / 10 : null,
        series_id: e.series_id ?? null,
      };
    })
    .sort((a, b) => b.checked_in - a.checked_in)
    .slice(0, 10);

  // Monthly events
  const monthlyMap = new Map<string, { count: number; registrations: number; check_ins: number }>();
  for (const e of eventList) {
    const month = e.starts_at?.slice(0, 7) ?? 'unknown';
    const entry = monthlyMap.get(month) ?? { count: 0, registrations: 0, check_ins: 0 };
    entry.count++;
    const stats = eventRegMap.get(e.id);
    if (stats) {
      entry.registrations += stats.registrations;
      entry.check_ins += stats.checkedIn;
    }
    monthlyMap.set(month, entry);
  }

  // --- New/Returning attendee analysis ---
  // Collect checked-in person_ids from current scope
  const checkedInPersonIds = new Set<string>();
  const unlinkedCheckedIn = regList.filter((r) => r.checked_in_at && !r.person_id && r.status !== 'cancelled').length;
  for (const r of regList) {
    if (r.checked_in_at && r.person_id && r.status !== 'cancelled') {
      checkedInPersonIds.add(r.person_id);
    }
  }

  // Fetch all project event IDs (for history scope — may include events outside date range)
  let allProjectEventIds = eventIds;
  if (dateRange) {
    const { data: allEvents } = await supabase
      .from('events')
      .select('id')
      .eq('project_id', projectId);
    allProjectEventIds = (allEvents ?? []).map((e) => e.id);
  }

  // Get attendance history for all checked-in people
  const attendanceHistory = await getProjectAttendanceHistory(supabase, allProjectEventIds, [...checkedInPersonIds]);

  // Determine the scope boundary for new/returning
  const scopeStart = dateRange?.from ?? eventList.reduce((min, e) => (e.starts_at < min ? e.starts_at : min), eventList[0]!.starts_at);

  let newAttendees = 0;
  let returningAttendees = 0;
  // Map person_id -> new/returning for reuse in category stats
  const personClassification = new Map<string, 'new' | 'returning'>();
  for (const pid of checkedInPersonIds) {
    const firstCheckedIn = attendanceHistory.get(pid);
    if (!firstCheckedIn || firstCheckedIn >= scopeStart) {
      newAttendees++;
      personClassification.set(pid, 'new');
    } else {
      returningAttendees++;
      personClassification.set(pid, 'returning');
    }
  }

  // Build event-to-category lookup
  const eventCategoryMap = new Map(eventList.map((e) => [e.id, e.category ?? 'uncategorized']));
  const eventMonthMap = new Map(eventList.map((e) => [e.id, e.starts_at?.slice(0, 7) ?? 'unknown']));

  // Build by_category_stats
  const categoryStatsMap = new Map<string, {
    event_count: number;
    registrations: number;
    check_ins: number;
    personIds: Set<string>;
    newAttendees: number;
    returningAttendees: number;
  }>();
  for (const e of eventList) {
    const cat = e.category ?? 'uncategorized';
    if (!categoryStatsMap.has(cat)) {
      categoryStatsMap.set(cat, { event_count: 0, registrations: 0, check_ins: 0, personIds: new Set(), newAttendees: 0, returningAttendees: 0 });
    }
    const entry = categoryStatsMap.get(cat)!;
    entry.event_count++;
    const stats = eventRegMap.get(e.id);
    if (stats) {
      entry.registrations += stats.registrations;
      entry.check_ins += stats.checkedIn;
    }
  }
  // Assign people to categories based on which events they checked into
  for (const r of regList) {
    if (r.status === 'cancelled' || !r.checked_in_at || !r.person_id) continue;
    const cat = eventCategoryMap.get(r.event_id) ?? 'uncategorized';
    const entry = categoryStatsMap.get(cat);
    if (entry) {
      entry.personIds.add(r.person_id);
    }
  }
  // Classify new/returning per category (project-global definition)
  for (const [, entry] of categoryStatsMap) {
    for (const pid of entry.personIds) {
      const classification = personClassification.get(pid);
      if (classification === 'new') entry.newAttendees++;
      else if (classification === 'returning') entry.returningAttendees++;
    }
  }

  const byCategoryStats = [...categoryStatsMap.entries()]
    .map(([category, s]) => ({
      category,
      event_count: s.event_count,
      registrations: s.registrations,
      check_ins: s.check_ins,
      attendance_rate: s.registrations > 0 ? Math.round((s.check_ins / s.registrations) * 100 * 10) / 10 : 0,
      unique_participants: s.personIds.size,
      new_attendees: s.newAttendees,
      returning_attendees: s.returningAttendees,
    }))
    .sort((a, b) => b.check_ins - a.check_ins);

  // Build new_vs_returning_by_month (deduplicated by person_id per month)
  const monthlyNR = new Map<string, { newPids: Set<string>; returningPids: Set<string> }>();
  for (const r of regList) {
    if (r.status === 'cancelled' || !r.checked_in_at || !r.person_id) continue;
    const month = eventMonthMap.get(r.event_id) ?? 'unknown';
    if (!monthlyNR.has(month)) monthlyNR.set(month, { newPids: new Set(), returningPids: new Set() });
    const entry = monthlyNR.get(month)!;
    const firstCheckedIn = attendanceHistory.get(r.person_id);
    const firstAttendanceMonth = firstCheckedIn?.slice(0, 7) ?? month;
    if (firstAttendanceMonth === month) {
      entry.newPids.add(r.person_id);
      entry.returningPids.delete(r.person_id);
    } else {
      if (!entry.newPids.has(r.person_id)) {
        entry.returningPids.add(r.person_id);
      }
    }
  }
  const newVsReturningByMonth = [...monthlyNR.entries()]
    .map(([month, s]) => ({
      month,
      new_attendees: s.newPids.size,
      returning_attendees: s.returningPids.size,
      unique_attendees: new Set([...s.newPids, ...s.returningPids]).size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total_events: eventList.length,
    total_registrations: totalRegistrations,
    total_check_ins: totalCheckIns,
    avg_attendance_rate: Math.round(avgAttendanceRate * 10) / 10,
    unduplicated_event_participants: uniquePersonIds.size,
    new_attendees: newAttendees,
    returning_attendees: returningAttendees,
    unlinked_registrations: unlinkedCheckedIn,
    by_status: [...statusMap.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    by_source: [...sourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    by_category: [...categoryMap.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    top_events_by_attendance: topEvents,
    monthly_events: [...monthlyMap.entries()]
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    new_vs_returning_by_month: newVsReturningByMonth,
    by_category_stats: byCategoryStats,
  };
}

export async function getIndividualEventReport(
  supabase: Supabase,
  projectId: string,
  eventId: string
): Promise<IndividualEventReport | null> {
  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, status, total_capacity')
    .eq('id', eventId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!event) return null;

  // Registrations
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('id, person_id, status, checked_in_at, source, created_at, waiver_status')
    .eq('event_id', eventId);
  const regList = registrations ?? [];

  // Registration funnel
  const funnel = {
    total_registered: regList.length,
    confirmed: regList.filter((r) => r.status === 'confirmed').length,
    checked_in: regList.filter((r) => r.checked_in_at).length,
    cancelled: regList.filter((r) => r.status === 'cancelled').length,
    waitlisted: regList.filter((r) => r.status === 'waitlisted').length,
    pending_approval: regList.filter((r) => r.status === 'pending_approval').length,
    pending_waiver: regList.filter((r) => r.status === 'pending_waiver').length,
  };

  // Registration timeline (cumulative by day, excluding cancelled)
  const activeRegs = regList
    .filter((r) => r.status !== 'cancelled' && r.created_at)
    .sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1));
  const timelineMap = new Map<string, number>();
  let cumulative = 0;
  for (const r of activeRegs) {
    const day = r.created_at!.slice(0, 10);
    cumulative++;
    timelineMap.set(day, cumulative);
  }
  const timeline = [...timelineMap.entries()].map(([date, cum]) => ({ date, cumulative: cum }));

  // Source breakdown
  const sourceMap = new Map<string, number>();
  for (const r of regList) {
    if (r.status === 'cancelled') continue;
    const s = r.source ?? 'web';
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
  }

  // Ticket type breakdown
  const regIds = regList.map((r) => r.id);
  let ticketBreakdown: { ticket_type: string; count: number; revenue_cents: number }[] = [];
  if (regIds.length > 0) {
    const { data: tickets } = await supabase
      .from('event_registration_tickets')
      .select('ticket_type_id')
      .in('registration_id', regIds);

    if (tickets && tickets.length > 0) {
      const { data: ticketTypes } = await supabase
        .from('event_ticket_types')
        .select('id, name, price_cents')
        .eq('event_id', eventId);
      const typeMap = new Map((ticketTypes ?? []).map((t) => [t.id, t]));

      const ticketCountMap = new Map<string, { count: number; revenue_cents: number }>();
      for (const t of tickets) {
        const tt = typeMap.get(t.ticket_type_id);
        const name = tt?.name ?? 'Unknown';
        const entry = ticketCountMap.get(name) ?? { count: 0, revenue_cents: 0 };
        entry.count++;
        entry.revenue_cents += tt?.price_cents ?? 0;
        ticketCountMap.set(name, entry);
      }
      ticketBreakdown = [...ticketCountMap.entries()]
        .map(([ticket_type, data]) => ({ ticket_type, ...data }))
        .sort((a, b) => b.count - a.count);
    }
  }

  // Waiver completion rate
  const { data: waivers } = await supabase
    .from('event_waivers')
    .select('id')
    .eq('event_id', eventId);
  let waiverCompletionRate: number | null = null;
  if (waivers && waivers.length > 0) {
    const activeRegCount = regList.filter((r) => r.status !== 'cancelled').length;
    const signedCount = regList.filter((r) => r.status !== 'cancelled' && r.waiver_status === 'signed').length;
    waiverCompletionRate = activeRegCount > 0 ? Math.round((signedCount / activeRegCount) * 100 * 10) / 10 : 0;
  }

  // Notes with author info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const { data: notes } = await supabaseAny
    .from('notes')
    .select('id, category, content, is_pinned, created_at, author:users!notes_created_by_fkey(full_name, email)')
    .eq('project_id', projectId)
    .eq('event_id', eventId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  const notesList = (notes ?? []).map((n: {
    id: string;
    category: string | null;
    content: string;
    is_pinned: boolean;
    created_at: string;
    author?: { full_name?: string; email?: string } | null;
  }) => ({
    id: n.id,
    category: n.category,
    content: n.content,
    is_pinned: n.is_pinned ?? false,
    created_at: n.created_at,
    created_by_name: n.author?.full_name ?? n.author?.email ?? 'Unknown',
  }));

  // --- New/Returning attendee analysis ---
  const checkedInPersonIds = new Set<string>();
  let unlinkedRegs = 0;
  for (const r of regList) {
    if (r.status === 'cancelled' || !r.checked_in_at) continue;
    if (r.person_id) checkedInPersonIds.add(r.person_id);
    else unlinkedRegs++;
  }

  let newAttendeesCount = 0;
  let returningAttendeesCount = 0;

  if (checkedInPersonIds.size > 0) {
    // Get all project event IDs for scoping
    const { data: projectEvents } = await supabase
      .from('events')
      .select('id')
      .eq('project_id', projectId);
    const projectEventIds = (projectEvents ?? []).map((e) => e.id);

    // Get attendance history
    const history = await getProjectAttendanceHistory(supabase, projectEventIds, [...checkedInPersonIds]);

    for (const pid of checkedInPersonIds) {
      const firstCheckedIn = history.get(pid);
      // If their first check-in is at or after this event's start, they're new
      if (!firstCheckedIn || firstCheckedIn >= event.starts_at) {
        newAttendeesCount++;
      } else {
        returningAttendeesCount++;
      }
    }
  }

  return {
    event_id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status: event.status ?? 'draft',
    capacity: event.total_capacity,
    registration_funnel: funnel,
    registration_timeline: timeline,
    source_breakdown: [...sourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    ticket_type_breakdown: ticketBreakdown,
    waiver_completion_rate: waiverCompletionRate,
    new_attendees: newAttendeesCount,
    returning_attendees: returningAttendeesCount,
    unlinked_registrations: unlinkedRegs,
    notes: notesList,
  };
}

export async function getSeriesReport(
  supabase: Supabase,
  projectId: string,
  seriesId: string
): Promise<SeriesReport | null> {
  const { data: series } = await supabase
    .from('event_series')
    .select('id, title, recurrence_frequency')
    .eq('id', seriesId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!series) return null;

  // Get all events in this series
  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, series_index')
    .eq('series_id', seriesId)
    .eq('project_id', projectId)
    .order('starts_at', { ascending: true });
  const eventList = events ?? [];

  // Series registrations
  const { data: seriesRegs } = await supabase
    .from('event_series_registrations')
    .select('id, person_id, status')
    .eq('series_id', seriesId);
  const activeSeriesRegs = (seriesRegs ?? []).filter((r) => r.status === 'active');
  const seriesPersonIds = new Set(activeSeriesRegs.map((r) => r.person_id).filter(Boolean));

  if (eventList.length === 0) {
    return {
      series_id: series.id,
      title: series.title,
      recurrence_frequency: series.recurrence_frequency ?? 'weekly',
      total_instances: 0,
      total_series_registrations: activeSeriesRegs.length,
      new_to_series: 0,
      returning_in_series: 0,
      attendance_trend: [],
      retention: [],
      notes_summary: { total_notes: 0, by_category: [], recent_notes: [], all_notes: [] },
    };
  }

  const eventIds = eventList.map((e) => e.id);

  // Fetch all registrations for series events
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('id, event_id, person_id, status, checked_in_at')
    .in('event_id', eventIds);
  const regList = registrations ?? [];

  // Per-event aggregation
  const eventRegMap = new Map<string, { registrations: number; checkedIn: number; checkedInPersonIds: Set<string> }>();
  for (const r of regList) {
    if (r.status === 'cancelled') continue;
    const entry = eventRegMap.get(r.event_id) ?? { registrations: 0, checkedIn: 0, checkedInPersonIds: new Set() };
    entry.registrations++;
    if (r.checked_in_at) {
      entry.checkedIn++;
      if (r.person_id) entry.checkedInPersonIds.add(r.person_id);
    }
    eventRegMap.set(r.event_id, entry);
  }

  // Attendance trend, retention, and new-to-series tracking
  const attendanceTrend: SeriesReport['attendance_trend'] = [];
  const retention: SeriesReport['retention'] = [];
  const cumulativeSeriesAttendees = new Set<string>(); // tracks people seen in earlier instances
  const allSeriesAttendees = new Set<string>(); // all unique people across entire series
  const multiInstanceAttendees = new Set<string>(); // people who attended 2+ instances

  for (let i = 0; i < eventList.length; i++) {
    const e = eventList[i]!;
    const stats = eventRegMap.get(e.id) ?? { registrations: 0, checkedIn: 0, checkedInPersonIds: new Set<string>() };
    const attendanceRate = stats.registrations > 0 ? Math.round((stats.checkedIn / stats.registrations) * 100 * 10) / 10 : 0;

    // New-to-series vs returning-in-series for this instance
    let newToSeriesCount = 0;
    let returningInSeriesCount = 0;
    for (const pid of stats.checkedInPersonIds) {
      if (cumulativeSeriesAttendees.has(pid)) {
        returningInSeriesCount++;
        multiInstanceAttendees.add(pid);
      } else {
        newToSeriesCount++;
      }
    }

    attendanceTrend.push({
      event_id: e.id,
      title: e.title,
      starts_at: e.starts_at,
      registrations: stats.registrations,
      checked_in: stats.checkedIn,
      attendance_rate: attendanceRate,
      new_to_series: newToSeriesCount,
      returning_in_series: returningInSeriesCount,
    });

    // Retention: if series registrants exist, track how many attend each instance.
    // Otherwise, fall back to cumulative attendee retention (of everyone who has
    // ever checked in to a prior instance, how many returned to this one).
    // Must calculate BEFORE adding this instance's attendees to cumulative set.
    let retentionBase: number;
    let retentionPresent: number;
    if (seriesPersonIds.size > 0) {
      retentionBase = seriesPersonIds.size;
      retentionPresent = 0;
      for (const pid of seriesPersonIds) {
        if (pid && stats.checkedInPersonIds.has(pid)) retentionPresent++;
      }
    } else {
      // Fallback: cumulative attendees from prior instances is the base
      retentionBase = cumulativeSeriesAttendees.size; // only has prior instances
      retentionPresent = returningInSeriesCount; // already counted above
    }
    retention.push({
      instance_number: i + 1,
      title: e.title,
      series_registrants_present: retentionPresent,
      total_series_registrants: retentionBase,
      retention_rate: retentionBase > 0
        ? Math.round((retentionPresent / retentionBase) * 100 * 10) / 10
        : 0,
    });

    // Add this instance's attendees to cumulative set AFTER retention calculation
    for (const pid of stats.checkedInPersonIds) {
      cumulativeSeriesAttendees.add(pid);
      allSeriesAttendees.add(pid);
    }
  }

  // Notes summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const { data: notes } = await supabaseAny
    .from('notes')
    .select('id, event_id, category, content, created_at')
    .eq('project_id', projectId)
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })
    .limit(500);
  const noteList: { id: string; event_id: string; category: string | null; content: string; created_at: string }[] = notes ?? [];

  const noteCategoryMap = new Map<string, number>();
  for (const n of noteList) {
    const c = n.category ?? 'general';
    noteCategoryMap.set(c, (noteCategoryMap.get(c) ?? 0) + 1);
  }

  const eventTitleMap = new Map(eventList.map((e) => [e.id, e.title]));
  const allNotes = noteList.map((n) => ({
    event_title: eventTitleMap.get(n.event_id) ?? 'Unknown',
    content: n.content,
    category: n.category,
    created_at: n.created_at,
  }));
  const recentNotes = allNotes.slice(0, 5);

  return {
    series_id: series.id,
    title: series.title,
    recurrence_frequency: series.recurrence_frequency ?? 'weekly',
    total_instances: eventList.length,
    total_series_registrations: activeSeriesRegs.length,
    new_to_series: allSeriesAttendees.size,
    returning_in_series: multiInstanceAttendees.size,
    attendance_trend: attendanceTrend,
    retention,
    notes_summary: {
      total_notes: noteList.length,
      by_category: [...noteCategoryMap.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      recent_notes: recentNotes,
      all_notes: allNotes,
    },
  };
}
