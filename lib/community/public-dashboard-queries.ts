import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/types/database';

type PublicDashboardConfig = Database['public']['Tables']['public_dashboard_configs']['Row'];

export interface PublicDashboardAggregateData {
  metrics: Array<{ label: string; value: number }>;
  programSummary: Array<{ name: string; status: string; enrollmentCount: number; attendanceCount: number }>;
  contributionSummary: Array<{ type: string; totalValue: number; count: number }>;
  dimensionBreakdown: Array<{ label: string; totalValue: number; count: number; color: string | null }>;
}

function minThreshold(config: PublicDashboardConfig, widgetThreshold?: number) {
  return Math.max(3, widgetThreshold ?? config.min_count_threshold ?? 5);
}

function suppressSmallGroups<T extends { count: number }>(groups: T[], threshold: number) {
  return groups.filter((group) => group.count >= threshold);
}

export async function getPublicDashboardAggregateData(
  config: PublicDashboardConfig
): Promise<PublicDashboardAggregateData> {
  const admin = createAdminClient();
  const widgets = Array.isArray(config.widgets) ? config.widgets as Array<{ type?: string; min_count_threshold?: number }> : [];
  const threshold = minThreshold(config, widgets[0]?.min_count_threshold);
  const { data: project } = await admin
    .from('projects')
    .select('impact_framework_id')
    .eq('id', config.project_id)
    .maybeSingle();
  const impactFrameworkId = project?.impact_framework_id ?? null;

  // Phase 1: fetch project-scoped data in parallel
  const [householdsResult, programsResult, contributionsResult, dimensionsResult] = await Promise.all([
    admin.from('households').select('id', { count: 'exact', head: true }).eq('project_id', config.project_id).is('deleted_at', null),
    admin.from('programs').select('id, name, status').eq('project_id', config.project_id),
    admin.from('contributions').select('type, value, dimension_id').eq('project_id', config.project_id),
    impactFrameworkId
      ? admin.from('impact_dimensions').select('id, label, color').eq('framework_id', impactFrameworkId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const programs = programsResult.data ?? [];
  const contributions = contributionsResult.data ?? [];
  const dimensions = dimensionsResult.data ?? [];

  // Phase 2: fetch enrollments/attendance scoped to this project's program IDs only
  const programIds = programs.map((p) => p.id);
  let enrollments: Array<{ program_id: string | null }> = [];
  let attendance: Array<{ program_id: string | null; person_id: string | null }> = [];

  if (programIds.length > 0) {
    const [enrollmentsResult, attendanceResult] = await Promise.all([
      admin.from('program_enrollments').select('program_id').in('program_id', programIds),
      admin.from('program_attendance').select('program_id, person_id').in('program_id', programIds),
    ]);
    enrollments = enrollmentsResult.data ?? [];
    attendance = attendanceResult.data ?? [];
  }

  const enrollmentCounts = new Map<string, number>();
  for (const row of enrollments) {
    if (!row.program_id) continue;
    enrollmentCounts.set(row.program_id, (enrollmentCounts.get(row.program_id) ?? 0) + 1);
  }

  const attendanceCounts = new Map<string, number>();
  for (const row of attendance) {
    if (!row.program_id) continue;
    attendanceCounts.set(row.program_id, (attendanceCounts.get(row.program_id) ?? 0) + 1);
  }

  const contributionGroups = new Map<string, { type: string; count: number; totalValue: number }>();
  for (const contribution of contributions) {
    const existing = contributionGroups.get(contribution.type);
    if (existing) {
      existing.count += 1;
      existing.totalValue += Number(contribution.value ?? 0);
    } else {
      contributionGroups.set(contribution.type, {
        type: contribution.type,
        count: 1,
        totalValue: Number(contribution.value ?? 0),
      });
    }
  }

  const dimensionGroups = new Map<string, { label: string; count: number; totalValue: number; color: string | null }>();
  for (const contribution of contributions) {
    if (!contribution.dimension_id) continue;
    const dimension = dimensions.find((item) => item.id === contribution.dimension_id);
    if (!dimension) continue;
    const existing = dimensionGroups.get(dimension.id);
    if (existing) {
      existing.count += 1;
      existing.totalValue += Number(contribution.value ?? 0);
    } else {
      dimensionGroups.set(dimension.id, {
        label: dimension.label,
        count: 1,
        totalValue: Number(contribution.value ?? 0),
        color: dimension.color,
      });
    }
  }

  return {
    metrics: [
      { label: 'Households Served', value: householdsResult.count ?? 0 },
      { label: 'Programs', value: programs.length },
      { label: 'Contributions', value: contributions.length },
      { label: 'Attendance Records', value: attendance.length },
    ],
    programSummary: suppressSmallGroups(programs.map((program) => ({
      name: program.name,
      status: program.status,
      enrollmentCount: enrollmentCounts.get(program.id) ?? 0,
      attendanceCount: attendanceCounts.get(program.id) ?? 0,
      count: Math.max(enrollmentCounts.get(program.id) ?? 0, attendanceCounts.get(program.id) ?? 0),
    })), threshold).map((item) => ({
      name: item.name,
      status: item.status,
      enrollmentCount: item.enrollmentCount,
      attendanceCount: item.attendanceCount,
    })),
    contributionSummary: suppressSmallGroups(Array.from(contributionGroups.values()), threshold),
    dimensionBreakdown: suppressSmallGroups(Array.from(dimensionGroups.values()), threshold),
  };
}

export function serializePublicDashboardPreviewData(data: PublicDashboardAggregateData): Json {
  return data as unknown as Json;
}
