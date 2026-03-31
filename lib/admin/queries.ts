import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AdminStats,
  AdminUserListItem,
  AdminProjectListItem,
  AdminBugReportListItem,
  AdminUserDetail,
} from '@/types/admin';

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
    const sanitized = search.replace(/[%_\\]/g, '\\$&');
    query = query.or(`full_name.ilike."%${sanitized}%",email.ilike."%${sanitized}%"`);
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
  const membershipsResult = userIds.length > 0
    ? await supabase.from('project_memberships').select('user_id, project_id').in('user_id', userIds)
    : { data: [] as { user_id: string; project_id: string }[] };

  const projectCounts: Record<string, number> = {};
  for (const m of (membershipsResult.data ?? []) as { user_id: string; project_id: string }[]) {
    projectCounts[m.user_id] = (projectCounts[m.user_id] ?? 0) + 1;
  }

  // Get ban status from auth.users via admin API (parallelized)
  const bannedUsers = new Set<string>();
  if (userIds.length > 0) {
    const banResults = await Promise.allSettled(
      userIds.map((uid) => supabase.auth.admin.getUserById(uid))
    );
    for (let i = 0; i < banResults.length; i++) {
      const result = banResults[i]!;
      if (result.status === 'fulfilled') {
        const bannedUntilStr = result.value.data?.user?.banned_until;
        if (bannedUntilStr) {
          const bannedUntil = new Date(bannedUntilStr);
          if (bannedUntil.getFullYear() > 2900 || bannedUntil > new Date()) {
            bannedUsers.add(userIds[i]!);
          }
        }
      }
    }
  }

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

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = createAdminClient();

  const [
    userResult,
    membershipsResult,
    gmailResult,
    telnyxResult,
    // New enrichment queries
    latestSessionResult,
    activityCountResult,
    emailsSyncedResult,
    emailsSentResult,
    callsCountResult,
    bugReportsCountResult,
    bugReportsResult,
    aiUsageResult,
    recentActivityResult,
    recentSessionsResult,
    settingsResult,
  ] = await Promise.all([
    // Original queries
    supabase.from('users').select('id, email, full_name, avatar_url, is_system_admin, created_at').eq('id', userId).single(),
    supabase
      .from('project_memberships')
      .select('id, role, created_at, projects(id, name, slug, project_type)')
      .eq('user_id', userId),
    supabase.from('gmail_connections').select('email').eq('user_id', userId).limit(1),
    supabase.from('telnyx_connections').select('phone_number').eq('user_id', userId).limit(1),
    // Latest session
    supabase
      .from('user_sessions')
      .select('id, last_active_at, ip_address, user_agent, project_id, created_at, projects(name)')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(1),
    // Activity count
    supabase.from('activity_log').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    // Emails synced count
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    // Emails sent count
    supabase.from('sent_emails').select('*', { count: 'exact', head: true }).eq('created_by', userId),
    // Calls count
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    // Bug reports count
    supabase.from('bug_reports').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    // Bug reports rows (limit 10)
    supabase
      .from('bug_reports')
      .select('id, description, status, priority, created_at, projects(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    // AI usage rows (for client-side aggregation)
    supabase
      .from('ai_usage_log')
      .select('total_tokens, prompt_tokens, completion_tokens')
      .eq('user_id', userId),
    // Recent activity (limit 15)
    supabase
      .from('activity_log')
      .select('id, action, entity_type, entity_id, created_at, projects(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    // Recent sessions (limit 10)
    supabase
      .from('user_sessions')
      .select('id, last_active_at, ip_address, user_agent, project_id, created_at, projects(name)')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(10),
    // User settings
    supabase
      .from('user_settings')
      .select('theme, timezone, date_format, time_format, notifications_email, notifications_push, notifications_digest')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (!userResult.data) return null;

  // Check ban status + get last_sign_in_at from auth
  let isBanned = false;
  let lastSignInAt: string | null = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    if (authUser?.user?.banned_until) {
      const bannedUntil = new Date(authUser.user.banned_until);
      isBanned = bannedUntil.getFullYear() > 2900 || bannedUntil > new Date();
    }
    lastSignInAt = authUser?.user?.last_sign_in_at ?? null;
  } catch {
    // Skip if we can't fetch auth user
  }

  // Map latest session
  const latestSessionRow = (latestSessionResult.data ?? [])[0] ?? null;
  const latestSession = latestSessionRow ? {
    id: latestSessionRow.id,
    last_active_at: latestSessionRow.last_active_at,
    ip_address: latestSessionRow.ip_address,
    user_agent: latestSessionRow.user_agent,
    project_id: latestSessionRow.project_id,
    project_name: (latestSessionRow.projects as unknown as { name: string } | null)?.name ?? null,
    created_at: latestSessionRow.created_at,
  } : null;

  // Aggregate AI usage client-side
  const aiRows = aiUsageResult.data ?? [];
  const aiUsage = {
    request_count: aiRows.length,
    total_tokens: aiRows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
    prompt_tokens: aiRows.reduce((sum, r) => sum + (r.prompt_tokens ?? 0), 0),
    completion_tokens: aiRows.reduce((sum, r) => sum + (r.completion_tokens ?? 0), 0),
  };

  return {
    user: {
      id: userResult.data.id,
      email: userResult.data.email,
      full_name: userResult.data.full_name,
      avatar_url: userResult.data.avatar_url,
      is_system_admin: userResult.data.is_system_admin,
      created_at: userResult.data.created_at,
      project_count: (membershipsResult.data ?? []).length,
      last_active_at: latestSession?.last_active_at ?? null,
      is_banned: isBanned,
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
    last_sign_in_at: lastSignInAt,
    latest_session: latestSession,
    usage_stats: {
      total_actions: activityCountResult.count ?? 0,
      emails_synced: emailsSyncedResult.count ?? 0,
      emails_sent: emailsSentResult.count ?? 0,
      calls_made: callsCountResult.count ?? 0,
      bug_reports_filed: bugReportsCountResult.count ?? 0,
    },
    ai_usage: aiUsage,
    recent_sessions: (recentSessionsResult.data ?? []).map((s) => ({
      id: s.id,
      last_active_at: s.last_active_at,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      project_id: s.project_id,
      project_name: (s.projects as unknown as { name: string } | null)?.name ?? null,
      created_at: s.created_at,
    })),
    recent_bug_reports: (bugReportsResult.data ?? []).map((r) => ({
      id: r.id,
      description: r.description,
      status: r.status,
      priority: r.priority,
      project_name: (r.projects as unknown as { name: string } | null)?.name ?? null,
      created_at: r.created_at,
    })),
    recent_activity: (recentActivityResult.data ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      project_name: (a.projects as unknown as { name: string } | null)?.name ?? null,
      created_at: a.created_at,
    })),
    settings: settingsResult.data ? {
      theme: settingsResult.data.theme,
      timezone: settingsResult.data.timezone,
      date_format: settingsResult.data.date_format,
      time_format: settingsResult.data.time_format,
      notifications_email: settingsResult.data.notifications_email,
      notifications_push: settingsResult.data.notifications_push,
      notifications_digest: settingsResult.data.notifications_digest,
    } : null,
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

/**
 * Fetch a single system setting by key.
 * Returns the parsed JSONB value or null if not found.
 */
export async function getSystemSetting(key: string): Promise<unknown> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return null;
  return data.value;
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
