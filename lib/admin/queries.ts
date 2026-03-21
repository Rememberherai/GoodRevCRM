import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminStats, AdminUserListItem, AdminProjectListItem, AdminBugReportListItem } from '@/types/admin';

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

// ─── Phase 3: User Management ────────────────────────────────────────

export async function listUsers(params: {
  search?: string;
  filter_admin?: boolean;
  filter_status?: 'active' | 'deactivated';
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ users: AdminUserListItem[]; total: number }> {
  const supabase = createAdminClient();
  const { search, filter_admin, sort_by = 'created_at', sort_dir = 'desc', page = 0, limit = 25 } = params;

  let query = supabase
    .from('users')
    .select('id, email, full_name, avatar_url, is_system_admin, created_at, updated_at', { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (filter_admin !== undefined) {
    query = query.eq('is_system_admin', filter_admin);
  }

  const validSortColumns: Record<string, string> = {
    name: 'full_name',
    email: 'email',
    created_at: 'created_at',
  };
  const sortColumn = validSortColumns[sort_by] ?? 'created_at';
  query = query.order(sortColumn, { ascending: sort_dir === 'asc' });
  query = query.range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[listUsers] Error:', error.message);
    return { users: [], total: 0 };
  }

  // Get project counts and ban status for each user
  const userIds = (data ?? []).map((u) => u.id);
  const [membershipsResult, authUsersResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from('project_memberships').select('user_id, project_id').in('user_id', userIds)
      : { data: [] as { user_id: string; project_id: string }[] },
    // Get ban status from auth.users via admin API
    Promise.resolve({ data: [] as { id: string; banned_until?: string }[] }),
  ]);

  const projectCounts: Record<string, number> = {};
  for (const m of (membershipsResult.data ?? []) as { user_id: string; project_id: string }[]) {
    projectCounts[m.user_id] = (projectCounts[m.user_id] ?? 0) + 1;
  }

  const bannedUsers = new Set(
    ((authUsersResult.data ?? []) as { id: string; banned_until?: string }[])
      .filter((u) => u.banned_until && new Date(u.banned_until) > new Date())
      .map((u) => u.id)
  );

  const users: AdminUserListItem[] = (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    avatar_url: u.avatar_url,
    is_system_admin: u.is_system_admin,
    created_at: u.created_at,
    project_count: projectCounts[u.id] ?? 0,
    last_active_at: null,
    is_banned: bannedUsers.has(u.id),
  }));

  if (params.filter_status === 'deactivated') {
    return { users: users.filter((u) => u.is_banned), total: users.filter((u) => u.is_banned).length };
  }
  if (params.filter_status === 'active') {
    return { users: users.filter((u) => !u.is_banned), total: users.filter((u) => !u.is_banned).length };
  }

  return { users, total: count ?? 0 };
}

export async function getUserDetail(userId: string) {
  const supabase = createAdminClient();

  const [userResult, membershipsResult, gmailResult, telnyxResult] = await Promise.all([
    supabase.from('users').select('id, email, full_name, avatar_url, is_system_admin, created_at').eq('id', userId).single(),
    supabase
      .from('project_memberships')
      .select('id, role, created_at, projects(id, name, slug, project_type)')
      .eq('user_id', userId),
    supabase.from('gmail_connections').select('email').eq('user_id', userId).limit(1),
    supabase.from('telnyx_connections').select('phone_number').eq('user_id', userId).limit(1),
  ]);

  if (!userResult.data) return null;

  return {
    user: {
      id: userResult.data.id,
      email: userResult.data.email,
      full_name: userResult.data.full_name,
      avatar_url: userResult.data.avatar_url,
      is_system_admin: userResult.data.is_system_admin,
      created_at: userResult.data.created_at,
      project_count: (membershipsResult.data ?? []).length,
      last_active_at: null,
      is_banned: false,
    } as AdminUserListItem,
    memberships: (membershipsResult.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      joined_at: m.created_at,
      project: m.projects as unknown as { id: string; name: string; slug: string; project_type: string },
    })),
    connections: {
      gmail: (gmailResult.data ?? []).length > 0 ? gmailResult.data![0]!.email : null,
      telnyx: (telnyxResult.data ?? []).length > 0 ? telnyxResult.data![0]!.phone_number : null,
    },
  };
}

// ─── Phase 4: Project Management ─────────────────────────────────────

export async function listProjects(params: {
  search?: string;
  filter_type?: 'standard' | 'community';
  filter_status?: 'active' | 'deleted';
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ projects: AdminProjectListItem[]; total: number }> {
  const supabase = createAdminClient();
  const { search, filter_type, filter_status, sort_by = 'created_at', sort_dir = 'desc', page = 0, limit = 25 } = params;

  let query = supabase
    .from('projects')
    .select('id, name, slug, project_type, owner_id, created_at, deleted_at, users!projects_owner_id_fkey(full_name, email)', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  if (filter_type) {
    query = query.eq('project_type', filter_type);
  }
  if (filter_status === 'active') {
    query = query.is('deleted_at', null);
  } else if (filter_status === 'deleted') {
    query = query.not('deleted_at', 'is', null);
  }

  const validSortColumns: Record<string, string> = {
    name: 'name',
    created_at: 'created_at',
  };
  const sortColumn = validSortColumns[sort_by] ?? 'created_at';
  query = query.order(sortColumn, { ascending: sort_dir === 'asc' });
  query = query.range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[listProjects] Error:', error.message);
    return { projects: [], total: 0 };
  }

  // Get member counts
  const projectIds = (data ?? []).map((p) => p.id);
  const membershipsResult = projectIds.length > 0
    ? await supabase.from('project_memberships').select('project_id').in('project_id', projectIds)
    : { data: [] as { project_id: string }[] };

  const memberCounts: Record<string, number> = {};
  for (const m of (membershipsResult.data ?? []) as { project_id: string }[]) {
    memberCounts[m.project_id] = (memberCounts[m.project_id] ?? 0) + 1;
  }

  // Check API key status
  const secretsResult = projectIds.length > 0
    ? await supabase.from('project_secrets').select('project_id').eq('key_name', 'openrouter').in('project_id', projectIds)
    : { data: [] as { project_id: string }[] };
  const projectsWithApiKey = new Set(
    ((secretsResult.data ?? []) as { project_id: string }[]).map((s) => s.project_id)
  );

  const projects: AdminProjectListItem[] = (data ?? []).map((p) => {
    const owner = p.users as unknown as { full_name: string | null; email: string } | null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      project_type: p.project_type as 'standard' | 'community',
      owner_email: owner?.email ?? '',
      owner_name: owner?.full_name ?? null,
      member_count: memberCounts[p.id] ?? 0,
      created_at: p.created_at,
      last_activity_at: null,
      deleted_at: p.deleted_at,
      has_api_key: projectsWithApiKey.has(p.id),
    };
  });

  return { projects, total: count ?? 0 };
}

export async function getProjectDetail(projectId: string) {
  const supabase = createAdminClient();

  const [projectResult, membershipsResult] = await Promise.all([
    supabase.from('projects').select('*, users!projects_owner_id_fkey(id, full_name, email)').eq('id', projectId).single(),
    supabase
      .from('project_memberships')
      .select('id, user_id, role, created_at, users(id, full_name, email, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ]);

  if (!projectResult.data) return null;

  return {
    project: projectResult.data,
    owner: projectResult.data.users as unknown as { id: string; full_name: string | null; email: string },
    members: (membershipsResult.data ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.created_at,
      user: m.users as unknown as { id: string; full_name: string | null; email: string; avatar_url: string | null },
    })),
  };
}

// ─── Phase 5: Activity Log, Settings, Bug Reports ────────────────────

export async function getSystemActivity(params: {
  type?: 'all' | 'crm' | 'admin';
  project_id?: string;
  user_id?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = createAdminClient();
  const { type = 'all', project_id, user_id, page = 0, limit = 50 } = params;

  const entries: Array<{
    id: string;
    source: 'crm' | 'admin';
    user_id: string;
    user_name: string;
    user_email: string;
    project_name: string | null;
    action: string;
    entity_type: string | null;
    details: unknown;
    created_at: string;
  }> = [];

  // CRM activity
  if (type === 'all' || type === 'crm') {
    let crmQuery = supabase
      .from('activity_log')
      .select('id, user_id, project_id, action, entity_type, changes, created_at, users(full_name, email), projects(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (project_id) crmQuery = crmQuery.eq('project_id', project_id);
    if (user_id) crmQuery = crmQuery.eq('user_id', user_id);

    const { data } = await crmQuery;
    for (const entry of data ?? []) {
      const user = entry.users as unknown as { full_name: string | null; email: string } | null;
      const project = entry.projects as unknown as { name: string } | null;
      entries.push({
        id: entry.id,
        source: 'crm',
        user_id: entry.user_id,
        user_name: user?.full_name ?? 'Unknown',
        user_email: user?.email ?? '',
        project_name: project?.name ?? null,
        action: entry.action,
        entity_type: entry.entity_type,
        details: entry.changes,
        created_at: entry.created_at ?? new Date().toISOString(),
      });
    }
  }

  // Admin activity
  if (type === 'all' || type === 'admin') {
    let adminQuery = supabase
      .from('system_admin_log')
      .select('id, admin_user_id, action, target_type, target_id, details, created_at, users!system_admin_log_admin_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (user_id) adminQuery = adminQuery.eq('admin_user_id', user_id);

    const { data } = await adminQuery;
    for (const entry of data ?? []) {
      const user = entry.users as unknown as { full_name: string | null; email: string } | null;
      entries.push({
        id: entry.id,
        source: 'admin',
        user_id: entry.admin_user_id,
        user_name: user?.full_name ?? 'Unknown',
        user_email: user?.email ?? '',
        project_name: null,
        action: entry.action,
        entity_type: entry.target_type,
        details: entry.details,
        created_at: entry.created_at,
      });
    }
  }

  // Sort merged results
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Paginate
  const start = page * limit;
  return {
    entries: entries.slice(start, start + limit),
    total: entries.length,
  };
}

export async function getSystemSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    console.error('[getSystemSettings] Error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function listBugReports(params: {
  search?: string;
  filter_status?: string;
  filter_priority?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ reports: AdminBugReportListItem[]; total: number }> {
  const supabase = createAdminClient();
  const { search, filter_status, filter_priority, sort_by = 'created_at', sort_dir = 'desc', page = 0, limit = 25 } = params;

  let query = supabase
    .from('bug_reports')
    .select('*, users!bug_reports_user_id_fkey(id, full_name, email), projects(id, name, slug), assigned_user:users!bug_reports_assigned_to_fkey(id, full_name, email)', { count: 'exact' });

  if (search) {
    query = query.ilike('description', `%${search}%`);
  }
  if (filter_status) {
    query = query.eq('status', filter_status);
  }
  if (filter_priority) {
    query = query.eq('priority', filter_priority);
  }

  const validSortColumns: Record<string, string> = {
    created_at: 'created_at',
    priority: 'priority',
    status: 'status',
  };
  const sortColumn = validSortColumns[sort_by] ?? 'created_at';
  query = query.order(sortColumn, { ascending: sort_dir === 'asc' });
  query = query.range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[listBugReports] Error:', error.message);
    return { reports: [], total: 0 };
  }

  const reports: AdminBugReportListItem[] = (data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    page_url: r.page_url,
    screenshot_path: r.screenshot_path,
    status: r.status as AdminBugReportListItem['status'],
    priority: (r.priority ?? 'medium') as AdminBugReportListItem['priority'],
    reporter: r.users as unknown as AdminBugReportListItem['reporter'],
    project: r.projects as unknown as AdminBugReportListItem['project'],
    assigned_to: r.assigned_user as unknown as AdminBugReportListItem['assigned_to'],
    admin_notes: r.admin_notes,
    resolution_notes: r.resolution_notes,
    user_agent: r.user_agent,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
  }));

  return { reports, total: count ?? 0 };
}
