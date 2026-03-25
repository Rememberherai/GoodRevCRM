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
    .select('type, status, value, hours, dimension_id')
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

  const statusOrder = ['researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined'];

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
