import { CCF_DIMENSIONS } from '@/lib/community/frameworks';
import type { ProjectRole } from '@/types/user';
import { computeMapCenter, type HouseholdMapPoint } from '@/lib/community/map';

export interface CommunityDashboardDimension {
  id: string;
  key: string;
  label: string;
  color: string;
  icon: string;
  value: number;
}

export interface CommunityDashboardMetrics {
  totalHouseholds: number;
  activePrograms: number;
  volunteerHours: number;
  contributionsValue: number;
  attendanceCount: number;
  uniqueVisitors: number;
}

export interface CommunityDashboardProgram {
  id: string;
  name: string;
  status: string;
  enrollmentCount: number;
  capacity: number | null;
}

export interface CommunityDashboardActivityItem {
  id: string;
  type: 'household' | 'enrollment' | 'contribution';
  title: string;
  description: string;
  createdAt: string;
}

export interface CommunityDashboardData {
  dimensions: CommunityDashboardDimension[];
  metrics: CommunityDashboardMetrics;
  programs: CommunityDashboardProgram[];
  recentActivity: CommunityDashboardActivityItem[];
  miniMap: {
    center: {
      latitude: number;
      longitude: number;
      zoom: number;
    };
    points: Array<Pick<HouseholdMapPoint, 'id' | 'latitude' | 'longitude'>>;
  };
  populationImpact: {
    servedPeople: number;
    denominator: number | null;
    percentage: number | null;
  };
  householdImpact: {
    registeredHouseholds: number;
    denominator: number | null;
    percentage: number | null;
  };
}

const ZERO_METRICS: CommunityDashboardMetrics = {
  totalHouseholds: 0,
  activePrograms: 0,
  volunteerHours: 0,
  contributionsValue: 0,
  attendanceCount: 0,
  uniqueVisitors: 0,
};

function fallbackDimensions(): CommunityDashboardDimension[] {
  return CCF_DIMENSIONS.map((dimension) => ({
    id: dimension.key,
    key: dimension.key,
    label: dimension.label,
    color: dimension.color,
    icon: dimension.icon,
    value: 0,
  }));
}

export interface CommunityDashboardDateRange {
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
}

export async function getCommunityDashboardData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  role: ProjectRole,
  dateRange?: CommunityDashboardDateRange
): Promise<CommunityDashboardData> {
  const canSeeDetail = role !== 'board_viewer' && role !== 'contractor';

  // Build date-filtered contribution queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyDateFilter(query: any) {
    if (dateRange) {
      return query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
    }
    return query;
  }

  const [
    householdsResult,
    activeProgramsResult,
    programsResult,
    volunteerHoursResult,
    contributionsValueResult,
    recentHouseholdsResult,
    recentContributionsResult,
    projectResult,
    miniMapHouseholdsResult,
  ] = await Promise.all([
    supabase.from('households').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'active'),
    supabase.from('programs').select('id, name, status, capacity').eq('project_id', projectId).order('created_at', { ascending: false }).limit(canSeeDetail ? 5 : 200),
    applyDateFilter(supabase.from('contributions').select('hours').eq('project_id', projectId).eq('type', 'volunteer_hours')),
    applyDateFilter(supabase.from('contributions').select('value').eq('project_id', projectId)),
    canSeeDetail
      ? supabase.from('households').select('id, name, created_at').eq('project_id', projectId).is('deleted_at', null).order('created_at', { ascending: false }).limit(3)
      : Promise.resolve({ data: [], error: null }),
    canSeeDetail
      ? supabase.from('contributions').select('id, type, description, value, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(3)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('projects').select('impact_framework_id, settings').eq('id', projectId).single(),
    supabase
      .from('households')
      .select('id, latitude, longitude')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(200),
  ]);

  let dimensions = fallbackDimensions();

  const impactFrameworkId = projectResult?.data?.impact_framework_id as string | null | undefined;
  if (impactFrameworkId) {
    const dimensionResult = await supabase
      .from('impact_dimensions')
      .select('id, key, label, color, icon')
      .eq('framework_id', impactFrameworkId)
      .order('sort_order', { ascending: true });

    if (!dimensionResult.error && Array.isArray(dimensionResult.data) && dimensionResult.data.length > 0) {
      dimensions = dimensionResult.data.map((dimension: { id: string; key: string; label: string; color: string; icon: string }) => ({
        id: dimension.id,
        key: dimension.key,
        label: dimension.label,
        color: dimension.color,
        icon: dimension.icon,
        value: 0,
      }));
    }
  }

  const volunteerHours = !volunteerHoursResult.error && Array.isArray(volunteerHoursResult.data)
    ? volunteerHoursResult.data.reduce((sum: number, row: { hours: number | null }) => sum + (Number(row.hours) || 0), 0)
    : 0;

  const contributionsValue = !contributionsValueResult.error && Array.isArray(contributionsValueResult.data)
    ? contributionsValueResult.data.reduce((sum: number, row: { value: number | null }) => sum + (Number(row.value) || 0), 0)
    : 0;

  const programRows = !programsResult.error && Array.isArray(programsResult.data)
    ? programsResult.data as Array<{ id: string; name: string; status: string; capacity: number | null }>
    : [];
  const programIds = programRows.map((program) => program.id);

  const [enrollmentsResult, attendanceResult, recentEnrollmentsResult] = programIds.length > 0
    ? await Promise.all([
        supabase.from('program_enrollments').select('program_id').in('program_id', programIds),
        (() => {
          let q = supabase.from('program_attendance').select('id, person_id').in('program_id', programIds);
          if (dateRange) {
            q = q.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
          }
          return q;
        })(),
        canSeeDetail
          ? supabase.from('program_enrollments').select('id, program_id, created_at').in('program_id', programIds).order('created_at', { ascending: false }).limit(3)
          : Promise.resolve({ data: [], error: null }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const attendanceRows = !attendanceResult.error && Array.isArray(attendanceResult.data)
    ? attendanceResult.data as Array<{ id: string; person_id: string | null }>
    : [];

  const attendanceCount = attendanceRows.length;
  const uniqueVisitors = new Set(
    attendanceRows
      .map((row) => row.person_id)
      .filter((personId: string | null | undefined): personId is string => Boolean(personId))
  ).size;

  const enrollmentsByProgram = new Map<string, number>();
  if (!enrollmentsResult.error && Array.isArray(enrollmentsResult.data)) {
    for (const row of enrollmentsResult.data as Array<{ program_id: string | null }>) {
      if (!row.program_id) continue;
      enrollmentsByProgram.set(row.program_id, (enrollmentsByProgram.get(row.program_id) ?? 0) + 1);
    }
  }

  const programs = canSeeDetail
    ? programRows.slice(0, 5).map((program) => ({
        id: program.id,
        name: program.name,
        status: program.status,
        capacity: program.capacity,
        enrollmentCount: enrollmentsByProgram.get(program.id) ?? 0,
      }))
    : [];

  const recentActivity: CommunityDashboardActivityItem[] = [];

  if (!recentHouseholdsResult.error && Array.isArray(recentHouseholdsResult.data)) {
    for (const household of recentHouseholdsResult.data as Array<{ id: string; name: string; created_at: string }>) {
      recentActivity.push({
        id: `household-${household.id}`,
        type: 'household',
        title: household.name,
        description: 'New household added',
        createdAt: household.created_at,
      });
    }
  }

  if (!recentEnrollmentsResult.error && Array.isArray(recentEnrollmentsResult.data)) {
    for (const enrollment of recentEnrollmentsResult.data as Array<{ id: string; program_id: string | null; created_at: string }>) {
      recentActivity.push({
        id: `enrollment-${enrollment.id}`,
        type: 'enrollment',
        title: 'New enrollment',
        description: enrollment.program_id ? `Program ${enrollment.program_id}` : 'Program enrollment recorded',
        createdAt: enrollment.created_at,
      });
    }
  }

  if (!recentContributionsResult.error && Array.isArray(recentContributionsResult.data)) {
    for (const contribution of recentContributionsResult.data as Array<{ id: string; type: string; description: string | null; value: number | null; created_at: string }>) {
      recentActivity.push({
        id: `contribution-${contribution.id}`,
        type: 'contribution',
        title: contribution.description || contribution.type,
        description: contribution.value ? `$${Number(contribution.value).toFixed(2)} recorded` : 'Contribution logged',
        createdAt: contribution.created_at,
      });
    }
  }

  recentActivity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const miniMapPoints = !miniMapHouseholdsResult.error && Array.isArray(miniMapHouseholdsResult.data)
    ? miniMapHouseholdsResult.data.map((row: { id: string; latitude: number; longitude: number }) => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
      }))
    : [];

  const projectSettings = (projectResult?.data?.settings ?? {}) as {
    default_map_center?: { latitude?: number; longitude?: number; zoom?: number };
    community_population_denominator?: number;
    household_denominator_override?: number;
    census_total_households?: number;
  };
  const denominator = typeof projectSettings.community_population_denominator === 'number'
    ? projectSettings.community_population_denominator
    : null;
  const percentage = denominator && denominator > 0
    ? (uniqueVisitors / denominator) * 100
    : null;

  // Household impact
  const totalHouseholds = householdsResult.error ? 0 : (householdsResult.count ?? 0);
  const householdDenominator =
    typeof projectSettings.household_denominator_override === 'number'
      ? projectSettings.household_denominator_override
      : typeof projectSettings.census_total_households === 'number'
        ? projectSettings.census_total_households
        : null;
  const householdPercentage =
    householdDenominator && householdDenominator > 0
      ? (totalHouseholds / householdDenominator) * 100
      : null;

  return {
    dimensions,
    metrics: {
      totalHouseholds,
      activePrograms: activeProgramsResult.error ? ZERO_METRICS.activePrograms : (activeProgramsResult.count ?? 0),
      volunteerHours,
      contributionsValue,
      attendanceCount,
      uniqueVisitors,
    },
    programs: canSeeDetail ? programs : [],
    recentActivity: canSeeDetail ? recentActivity.slice(0, 6) : [],
    miniMap: {
      center: computeMapCenter([miniMapPoints], projectSettings.default_map_center),
      points: miniMapPoints,
    },
    populationImpact: {
      servedPeople: uniqueVisitors,
      denominator,
      percentage,
    },
    householdImpact: {
      registeredHouseholds: totalHouseholds,
      denominator: householdDenominator,
      percentage: householdPercentage,
    },
  };
}
