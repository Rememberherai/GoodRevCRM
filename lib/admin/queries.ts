import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminStats } from '@/types/admin';

/**
 * Fetches aggregate stats for the admin dashboard.
 * Uses admin client to bypass RLS and access all data.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createAdminClient();

  const [
    usersResult,
    projectsResult,
    activeProjectsResult,
    newUsersResult,
    projectsByTypeResult,
    missingApiKeyResult,
    openBugReportsResult,
    signupsByWeekResult,
    projectsByWeekResult,
  ] = await Promise.all([
    // Total users
    supabase.from('users').select('*', { count: 'exact', head: true }),
    // Total projects (non-deleted)
    supabase.from('projects').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    // Active projects (7d) — projects with activity_log entries in last 7 days
    supabase.rpc('count_active_projects_7d'),
    // New users (30d)
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Projects by type
    supabase.from('projects').select('project_type').is('deleted_at', null),
    // Projects missing API key
    supabase.rpc('count_projects_missing_api_key'),
    // Open bug reports
    supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    // Signups by week (last 12 weeks)
    supabase.rpc('signups_by_week'),
    // Projects by week (last 12 weeks)
    supabase.rpc('projects_by_week'),
  ]);

  // Count projects by type
  const projectsByType = { standard: 0, community: 0 };
  if (projectsByTypeResult.data) {
    for (const row of projectsByTypeResult.data) {
      const t = (row as { project_type: string }).project_type;
      if (t === 'community') projectsByType.community++;
      else projectsByType.standard++;
    }
  }

  return {
    total_users: usersResult.count ?? 0,
    total_projects: projectsResult.count ?? 0,
    active_projects_7d: activeProjectsResult.data ?? 0,
    new_users_30d: newUsersResult.count ?? 0,
    projects_by_type: projectsByType,
    projects_missing_api_key: missingApiKeyResult.data ?? 0,
    open_bug_reports: openBugReportsResult.count ?? 0,
    signups_by_week: (signupsByWeekResult.data ?? []).map((r) => ({
      week: r.week as string,
      count: Number(r.count),
    })),
    projects_by_week: (projectsByWeekResult.data ?? []).map((r) => ({
      week: r.week as string,
      count: Number(r.count),
    })),
  };
}

/**
 * Fetches active (un-exited) admin sessions for the given admin user.
 * Joins project name and slug for display.
 */
export async function getActiveSessions(adminUserId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('system_admin_sessions')
    .select('id, project_id, entered_at, projects(name, slug)')
    .eq('admin_user_id', adminUserId)
    .is('exited_at', null)
    .order('entered_at', { ascending: false });

  if (error) {
    console.error('[getActiveSessions] Error:', error.message);
    return [];
  }

  return (data ?? []).map((s) => ({
    id: s.id,
    project_id: s.project_id,
    project_name: (s.projects as unknown as { name: string; slug: string })?.name ?? 'Unknown',
    project_slug: (s.projects as unknown as { name: string; slug: string })?.slug ?? '',
    entered_at: s.entered_at,
  }));
}

/**
 * Fetches recent admin actions for the dashboard.
 */
export async function getRecentAdminActions(limit = 20) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('system_admin_log')
    .select('*, users!system_admin_log_admin_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getRecentAdminActions] Error:', error.message);
    return [];
  }

  return (data ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    details: entry.details,
    created_at: entry.created_at,
    admin_name: (entry.users as unknown as { full_name: string | null; email: string })?.full_name ?? 'Unknown',
    admin_email: (entry.users as unknown as { full_name: string | null; email: string })?.email ?? '',
  }));
}
