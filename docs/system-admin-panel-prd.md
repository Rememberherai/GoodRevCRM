# System Admin Panel — Product Requirements Document

**Version:** 1.4
**Date:** 2026-03-21
**Status:** Draft

---

## 1. Problem Statement

GoodRevCRM is a multi-tenant platform where each org creates its own projects with isolated data enforced by Row-Level Security (RLS). As the platform operator, there is currently **zero in-app visibility** into tenant activity. Specifically:

- There is no way to see how many users or projects exist without querying the Supabase dashboard directly
- You cannot access a tenant's project unless they explicitly invite you
- There is no way to enforce API key policies (e.g., require each org to bring their own OpenRouter key)
- There is no system-wide activity log for security monitoring or support diagnostics
- There is no way to deactivate a user or soft-delete an abandoned project from within the app
- There is no audit trail for platform-level administrative actions
- There is no way for users to report bugs from within the app, and no way for the platform operator to triage and manage those reports

The Supabase dashboard provides raw database access, but it is unaudited, fragile, and bypasses every application-level safety check.

### What Exists Today

- **Auth:** Google OAuth via Supabase, session-based, enforced in `middleware.ts`
- **User table:** `public.users` with `id`, `email`, `full_name`, `avatar_url`, timestamps. Synced from `auth.users` via trigger. No admin flag.
- **Project isolation:** All entity tables have `project_id` + RLS policies using `is_project_member()` and `has_project_role()` helper functions
- **Project roles:** `owner`, `admin`, `member`, `viewer` (standard); `staff`, `case_manager`, `contractor`, `board_viewer` (community)
- **Activity log:** `activity_log` table scoped per-project, with entity type, action, changes JSONB, IP address, user agent
- **Project secrets:** `project_secrets` table with encrypted per-project API keys. `getProjectSecret()` in `lib/secrets.ts` checks DB first, falls back to `process.env`
- **Service client:** `createServiceClient()` and `createAdminClient()` bypass RLS for server-side admin operations
- **Bug reports table:** `bug_reports` table (migration `0138`) with `user_id`, `project_id`, `description`, `page_url`, `screenshot_path`, `status`, `resolution_notes`, `user_agent`. RLS allows users to insert/read their own reports only.

### What Does NOT Exist

- System admin role or flag
- Admin routes, layout, or pages
- System-wide (cross-project) activity viewing
- User management (deactivate, list all users)
- Project management (browse all, enter as admin, soft-delete from admin)
- System settings (API key policy, feature flags)
- Admin audit trail (separate from project-scoped activity log)
- Bug report triage/management UI (users can submit but no one can manage them)
- Bug report submission UI (the table exists but there's no dialog or API route to submit)

---

## 2. Design Principles

1. **Read-heavy, write-light** — the admin panel is primarily an observatory. Destructive actions are rare and always confirmation-gated via `AlertDialog`.
2. **Audited** — every admin action (especially "enter project") gets a dedicated audit trail entry in `system_admin_log`, distinct from project-scoped `activity_log` records.
3. **Uses service role** — admin API routes use `createServiceClient()` to bypass RLS. The admin flag is verified in every route handler, not just middleware. Double-gate pattern.
4. **Non-breaking** — no changes to existing tables, routes, RLS policies, or types beyond additive columns/fields. Purely additive to the existing application.
5. **Same UI patterns** — Cards, Tabs, AlertDialog, sonner toasts, DataTable. No new UI paradigms.
6. **CLI-gated privilege escalation** — system admin grant/revoke is a CLI script, not a UI action. This prevents one admin from removing another's access or a compromised account from self-escalating.

---

## 3. Architectural Risk Assessment

### Zero-Risk (purely additive)

- **New tables** (`system_admin_log`, `system_settings`, `system_admin_sessions`) — no existing code touches them
- **New routes** (`app/api/admin/*`, `app/(admin)/*`) — completely separate route group, no overlap with existing routes
- **New components** (`components/admin/*`) — not imported by anything existing
- **`is_system_admin` column** — `ADD COLUMN IF NOT EXISTS ... DEFAULT FALSE`. Every existing user gets `false`. No existing query selects this column.

### Low Risk (touching existing files, but safely)

| Change | Risk | Why it's safe |
|--------|------|---------------|
| `types/user.ts` — add `is_system_admin?: boolean` | Minimal | Optional field. No existing code checks for it. TypeScript won't break. |
| `types/database.ts` — regenerated | Minimal | Additive — new tables appear, existing types unchanged. `npm run typecheck` validates. |
| `hooks/use-auth.ts` — fetch `is_system_admin` | Low | One additional column in the user query. If the column doesn't exist for some reason, it's `null`, which is falsy. No behavior change for non-admins. |
| `components/layout/user-menu.tsx` — add "Admin Panel" link | Low | Conditional render: `{isSystemAdmin && <link>}`. Non-admins see zero difference. |
| `app/(dashboard)/projects/[slug]/layout.tsx` — admin banner | Low | Conditional query + render. If no admin session exists, query returns null, banner doesn't render. Normal path completely unchanged. |

### The One Actual Risk

**`lib/secrets.ts` — modifying `getProjectSecret()` to check API key policy.**

This is the only change that affects existing runtime behavior. If the system setting `require_project_api_keys.openrouter` is set to `true`, projects without their own key will lose AI features.

**Mitigations:**
- The default is `false` (fallback to env var — current behavior). The behavior only changes when the system admin explicitly flips the toggle.
- The policy toggle is gated: it only takes effect if at least one project has a configured key, preventing an accidental "turn off AI for everyone" scenario.
- On deploy, nothing changes until the admin acts.

### New RLS Policies on `projects` Table

The new policy `"System admins can view all projects"` adds a SELECT path. It cannot break existing policies — Postgres RLS is OR-based (any matching policy grants access). Existing users still hit the existing membership-based policy. The new policy only fires for users with `is_system_admin = TRUE`, and since every existing user has `FALSE`, it is inert until the seed script runs.

---

## 4. Database Schema

### Migration: `0139_system_admin.sql`

> **Note:** Migration `0134` is already taken by `0134_remove_chris_auto_add.sql` and migrations `0135`–`0138` are also allocated. This migration uses the next available number.

#### 4.1 System Admin Flag

```sql
-- Add system admin flag to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

All existing users receive `FALSE`. No existing query, RLS policy, or type checks this column.

#### 4.2 System Admin Audit Log

Separate from the project-scoped `activity_log`. Records all platform-level admin actions.

```sql
CREATE TABLE public.system_admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_admin_log_admin ON system_admin_log(admin_user_id);
CREATE INDEX idx_system_admin_log_action ON system_admin_log(action);
CREATE INDEX idx_system_admin_log_target ON system_admin_log(target_type, target_id);
CREATE INDEX idx_system_admin_log_created ON system_admin_log(created_at DESC);
```

**`action` values:**
- `entered_project` — admin entered a project via admin panel
- `exited_project` — admin exited a project
- `deactivated_user` — admin banned a user
- `reactivated_user` — admin unbanned a user
- `soft_deleted_project` — admin soft-deleted a project
- `restored_project` — admin restored a soft-deleted project
- `updated_system_setting` — admin changed a system setting
- `viewed_project` — admin viewed project detail page (for sensitive access auditing)
- `updated_bug_report` — admin triaged, assigned, or changed status of a bug report

**`target_type` values:** `user`, `project`, `setting`, `bug_report`

**`target_id`:** UUID of the user, project, or bug report acted upon. NULL for setting changes.

**`details` JSONB:** Freeform context. Examples:
- `{ "setting_key": "require_project_api_keys", "old_value": false, "new_value": true }`
- `{ "project_name": "Acme Corp CRM", "project_slug": "acme-corp" }`
- `{ "user_email": "jane@example.com", "reason": "requested by user" }`

#### 4.3 System Settings

Key-value store for platform-level configuration. Not per-project — global.

```sql
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
-- Auto-update updated_at on change
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

**Seed values:**

| Key | Default Value | Purpose |
|-----|---------------|---------|
| `require_project_api_keys` | `{"openrouter": false}` | When `true`, projects without their own key cannot use AI features |
| `default_api_key_policy` | `"fallback_to_env"` | Future: could support `"disabled"` to turn off fallback entirely |

#### 4.4 System Admin Sessions

Tracks when a system admin "enters" a project. Needed for the admin mode banner and stale session cleanup.

```sql
CREATE TABLE public.system_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.project_memberships(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ
);

-- Partial unique index: only one ACTIVE (un-exited) session per admin per project
CREATE UNIQUE INDEX idx_unique_active_admin_session
  ON public.system_admin_sessions (admin_user_id, project_id)
  WHERE exited_at IS NULL;
```

**Why a separate table instead of a `metadata` JSONB column on `project_memberships`?**
- `project_memberships` does not currently have a `metadata` column
- Adding one would touch an existing, heavily-used table
- A separate table is cleaner: no schema change to existing tables, easy to query, easy to clean up

#### 4.5 RLS Policies

```sql
-- system_admin_log: only system admins can read; only system admins can insert (as self)
ALTER TABLE public.system_admin_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view admin log"
  ON public.system_admin_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

CREATE POLICY "System admins can insert admin log"
  ON public.system_admin_log FOR INSERT
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- system_settings: only system admins can read/write
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- system_admin_sessions: only system admins can read/write
ALTER TABLE public.system_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage admin sessions"
  ON public.system_admin_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Allow system admins to SELECT all projects (bypasses membership check)
CREATE POLICY "System admins can view all projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Allow system admins to read all users
-- (existing policy only allows users to read their own row)
CREATE POLICY "System admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );
```

#### 4.6 SQL Helper Function

```sql
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_system_admin = TRUE
  );
$$;
```

This mirrors the existing `is_project_member()` pattern. Available for future RLS policies or SQL-level checks.

#### 4.7 Bug Reports RLS Extension (in `0139_system_admin.sql`)

The `bug_reports` table (migration `0138`, already applied) ships with user-scoped RLS (users can insert/read their own reports). The system admin migration adds an admin policy so the admin panel can manage all reports, plus triage columns for admin workflows:

```sql
-- System admins can view and manage all bug reports
CREATE POLICY "System admins can manage all bug reports"
  ON public.bug_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );
```

Additionally, add columns for admin triage:

```sql
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON public.bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON public.bug_reports(assigned_to);
```

#### 4.8 Supabase Storage: `bug-screenshots` Bucket

The bug report feature requires a Storage bucket for screenshot uploads. This is created via the Supabase dashboard or migration:

```sql
-- Create the storage bucket (if using SQL migration)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-screenshots', 'bug-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload screenshots (scoped to their own user_id path)
CREATE POLICY "Users can upload bug screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bug-screenshots'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can read their own screenshots
CREATE POLICY "Users can read own bug screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bug-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: system admins can read all bug screenshots
CREATE POLICY "System admins can read all bug screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bug-screenshots'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );
```

**Upload path convention:** `bug-screenshots/{user_id}/{uuid}.{ext}` — scopes uploads per-user for RLS.

#### 4.9 Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| `system_admin_log` | `(admin_user_id)` | Filter by admin |
| `system_admin_log` | `(action)` | Filter by action type |
| `system_admin_log` | `(target_type, target_id)` | Filter by target |
| `system_admin_log` | `(created_at DESC)` | Chronological listing |
| `system_admin_sessions` | Unique `(admin_user_id, project_id) WHERE exited_at IS NULL` | Prevent duplicate active sessions (partial index allows re-entry after exit) |
| `bug_reports` | `(priority)` | Filter by priority in admin triage |
| `bug_reports` | `(assigned_to)` | Filter by assignee in admin triage |

---

## 5. TypeScript Types

### 5.1 User Type Extension

In `types/user.ts` — add one optional field to the existing `User` interface:

```typescript
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  is_system_admin?: boolean;  // nullable, only populated for current user
}
```

### 5.2 New Admin Types

New file: `types/admin.ts`

```typescript
export interface SystemAdminLog {
  id: string;
  admin_user_id: string;
  action: SystemAdminAction;
  target_type: 'user' | 'project' | 'setting' | 'bug_report';
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type SystemAdminAction =
  | 'entered_project'
  | 'exited_project'
  | 'deactivated_user'
  | 'reactivated_user'
  | 'soft_deleted_project'
  | 'restored_project'
  | 'updated_system_setting'
  | 'viewed_project'
  | 'updated_bug_report';

export interface SystemSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  admin_user_id: string;
  project_id: string;
  membership_id: string;
  entered_at: string;
  exited_at: string | null;
}

export interface AdminStats {
  total_users: number;
  total_projects: number;
  active_projects_7d: number;
  new_users_30d: number;
  projects_by_type: {
    standard: number;
    community: number;
  };
  projects_missing_api_key: number;
  open_bug_reports: number;
  signups_by_week: Array<{ week: string; count: number }>;
  projects_by_week: Array<{ week: string; count: number }>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_system_admin: boolean;
  created_at: string;
  project_count: number;
  last_active_at: string | null;
  is_banned: boolean;
}

export interface AdminBugReportListItem {
  id: string;
  description: string;
  page_url: string;
  screenshot_path: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reporter: { id: string; full_name: string | null; email: string };
  project: { id: string; name: string; slug: string } | null;
  assigned_to: { id: string; full_name: string | null; email: string } | null;
  admin_notes: string | null;
  resolution_notes: string | null;
  user_agent: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminProjectListItem {
  id: string;
  name: string;
  slug: string;
  project_type: 'standard' | 'community';
  owner_email: string;
  owner_name: string | null;
  member_count: number;
  created_at: string;
  last_activity_at: string | null;
  deleted_at: string | null;
  has_api_key: boolean;
}
```

---

## 6. Application Layer

### 6.1 Admin Permission Helper

New file: `lib/admin/permissions.ts`

```typescript
export class SystemAdminError extends Error {
  status: number;
  constructor(message = 'System admin access required', status = 403) {
    super(message);
    this.name = 'SystemAdminError';
    this.status = status;
  }
}

/**
 * Verifies the given user is a system admin.
 * Uses service client to bypass RLS (the users table RLS
 * normally only lets users read their own row).
 * Throws SystemAdminError if not an admin.
 */
export async function requireSystemAdmin(
  userId: string
): Promise<void>;

/**
 * Logs an admin action to the system_admin_log table.
 * Fire-and-forget with error logging (same pattern as emitAutomationEvent).
 */
export async function logAdminAction(
  adminUserId: string,
  action: SystemAdminAction,
  targetType: 'user' | 'project' | 'setting' | 'bug_report',
  targetId: string | null,
  details: Record<string, unknown>,
  request?: NextRequest  // extracts IP + user agent
): Promise<void>;
```

Every admin API route calls `requireSystemAdmin()` as its first operation — not just the layout. This is the double-gate pattern: the layout prevents non-admins from seeing the UI, and the API route independently prevents unauthorized data access.

### 6.2 Admin Query Functions

New file: `lib/admin/queries.ts`

Reusable server-side query functions for all admin data fetching. All use `createServiceClient()`.

```typescript
export async function getAdminStats(): Promise<AdminStats>;

export async function listUsers(params: {
  search?: string;
  filter_role?: string;
  filter_admin?: boolean;
  filter_status?: 'active' | 'deactivated';
  sort_by?: 'name' | 'email' | 'created_at' | 'last_active_at' | 'project_count';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ users: AdminUserListItem[]; total: number }>;

export async function getUserDetail(userId: string): Promise<{
  user: AdminUserListItem;
  memberships: Array<{ project_id: string; project_name: string; project_slug: string; role: string; joined_at: string }>;
  connections: { gmail: boolean; telnyx: boolean };
}>;

export async function listProjects(params: {
  search?: string;
  filter_type?: 'standard' | 'community';
  filter_status?: 'active' | 'deleted';
  filter_api_key?: 'configured' | 'missing';
  sort_by?: 'name' | 'created_at' | 'last_activity_at' | 'member_count';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ projects: AdminProjectListItem[]; total: number }>;

export async function getProjectDetail(projectId: string): Promise<{
  project: AdminProjectListItem;
  members: Array<{ user_id: string; email: string; full_name: string | null; role: string; joined_at: string }>;
  entity_counts: Record<string, number>;  // people, organizations, opportunities, households, programs, etc.
  secrets_configured: string[];  // key names only, never values
  settings: Record<string, unknown>;
}>;

export async function getSystemActivity(params: {
  type?: 'all' | 'crm' | 'admin';
  project_id?: string;
  user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): Promise<{ entries: Array<ActivityEntry>; total: number }>;

export async function getActiveSessions(adminUserId: string): Promise<AdminSession[]>;

export async function listBugReports(params: {
  search?: string;
  filter_status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  filter_priority?: 'low' | 'medium' | 'high' | 'critical';
  filter_assigned_to?: string;
  filter_project_id?: string;
  sort_by?: 'created_at' | 'priority' | 'status';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ bug_reports: AdminBugReportListItem[]; total: number }>;

export async function getBugReportDetail(id: string): Promise<AdminBugReportListItem>;
```

### 6.3 Admin Validators

New file: `lib/admin/validators.ts`

Zod schemas for admin API input validation. Follows existing patterns in `lib/validators/`.

```typescript
export const adminUserListSchema = z.object({
  search: z.string().optional(),
  filter_role: z.string().optional(),
  filter_admin: z.coerce.boolean().optional(),
  filter_status: z.enum(['active', 'deactivated']).optional(),
  sort_by: z.enum(['name', 'email', 'created_at', 'last_active_at', 'project_count']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminProjectListSchema = z.object({
  search: z.string().optional(),
  filter_type: z.enum(['standard', 'community']).optional(),
  filter_status: z.enum(['active', 'deleted']).optional(),
  filter_api_key: z.enum(['configured', 'missing']).optional(),
  sort_by: z.enum(['name', 'created_at', 'last_activity_at', 'member_count']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminActivityListSchema = z.object({
  type: z.enum(['all', 'crm', 'admin']).optional().default('all'),
  project_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminUserActionSchema = z.object({
  action: z.enum(['deactivate', 'reactivate']),
});

export const adminProjectActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('soft_delete'), confirm_name: z.string() }),
  z.object({ action: z.literal('restore') }),
]);

export const adminBugReportListSchema = z.object({
  search: z.string().optional(),
  filter_status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  filter_priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  filter_assigned_to: z.string().uuid().optional(),
  filter_project_id: z.string().uuid().optional(),
  sort_by: z.enum(['created_at', 'priority', 'status']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminBugReportUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  admin_notes: z.string().optional(),
  resolution_notes: z.string().optional(),
});

// User-facing (not admin) — validates POST /api/bug-reports body
export const bugReportSubmitSchema = z.object({
  description: z.string().min(10, 'Please describe the issue in at least 10 characters'),
  page_url: z.string().url(),
  screenshot_path: z.string().optional(),
  user_agent: z.string(),
  project_id: z.string().uuid().nullable().optional(),
});

export const adminSettingUpdateSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});
```

### 6.4 API Key Policy Integration

Modified file: `lib/secrets.ts`

The `getProjectSecret()` function gains awareness of the system settings table:

```typescript
export async function getProjectSecret(
  projectId: string,
  keyName: SecretKeyName
): Promise<string | null> {
  const supabase = createAdminClient();

  // Step 1: Check project_secrets table (existing, unchanged)
  try {
    const { data } = await supabase
      .from('project_secrets')
      .select('encrypted_value')
      .eq('project_id', projectId)
      .eq('key_name', keyName)
      .single();

    if (data?.encrypted_value) {
      return decrypt(data.encrypted_value);
    }
  } catch {
    // DB read failed — fall through
  }

  // Step 2 (NEW): Check if env var fallback is allowed for this key
  // Map secret key names to policy keys. Only keys with a policy entry are checked.
  const POLICY_KEY_MAP: Partial<Record<SecretKeyName, string>> = {
    openrouter_api_key: 'openrouter',
  };
  const policyKey = POLICY_KEY_MAP[keyName];
  if (!policyKey) {
    // This secret type has no policy — always allow env var fallback
    const envVar = SECRET_KEYS[keyName].envVar;
    return process.env[envVar] || null;
  }

  try {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'require_project_api_keys')
      .single();

    if (setting?.value && typeof setting.value === 'object') {
      const policy = setting.value as Record<string, boolean>;
      if (policy[policyKey] === true) {
        // Policy requires project-level key; do NOT fall back to env var
        return null;
      }
    }
  } catch {
    // If we can't read system settings, allow fallback (safe default)
  }

  // Step 3: Fallback to environment variable (existing, unchanged)
  const envVar = SECRET_KEYS[keyName].envVar;
  return process.env[envVar] || null;
}
```

**Downstream impact:** API routes that call `getProjectSecret('openrouter_api_key')` and get `null` must return a user-friendly error. The existing chat route and research routes already handle null keys — they throw an error. The error message should be updated to say "Configure your OpenRouter API key in Settings → API Keys" instead of the generic "OPENROUTER_API_KEY is required".

---

## 7. CLI Scripts

### 7.1 Set System Admin

New file: `scripts/set-system-admin.ts`

```bash
# Grant system admin
npx tsx scripts/set-system-admin.ts grant user@example.com

# Revoke system admin
npx tsx scripts/set-system-admin.ts revoke user@example.com

# List current system admins
npx tsx scripts/set-system-admin.ts list
```

The script:
1. Connects to the database using the service role key (from env vars or connection string)
2. Looks up the user by email
3. Sets `is_system_admin` to `true` or `false`
4. Prints confirmation

**This is intentionally not a UI action.** Granting system admin requires server/CLI access, preventing privilege escalation through a compromised browser session.

---

## 8. Navigation & Layout

### 8.1 Admin Route Group

```
app/(admin)/
  layout.tsx                    ← admin shell (sidebar + header + auth gate)
  admin/
    page.tsx                    ← dashboard
    users/
      page.tsx                  ← user list
      [id]/
        page.tsx                ← user detail
    projects/
      page.tsx                  ← project list
      [id]/
        page.tsx                ← project detail
    bug-reports/
      page.tsx                  ← bug report triage
    activity/
      page.tsx                  ← system-wide audit log
    settings/
      page.tsx                  ← system settings
```

This is a separate Next.js route group from `(dashboard)`. It has its own layout, sidebar, and header. It does not nest inside the project shell.

### 8.2 Admin Layout (`app/(admin)/layout.tsx`)

Server component:
1. Fetch current user via `supabase.auth.getUser()`
2. Fetch `is_system_admin` from `users` table via service client
3. If not system admin → `redirect('/projects')`
4. Render: `<AuthProvider>` → `<AdminSidebar />` + `<AdminHeader />` + `{children}`

### 8.3 Admin Sidebar (`components/admin/admin-sidebar.tsx`)

```
[GoodRev Logo] Admin
──────────────────
Dashboard
Users
Projects
Bug Reports
Activity Log
Settings
──────────────────
← Back to CRM          → /projects
──────────────────
[Avatar] Admin Name
```

- Active state on current route
- Collapsible on smaller screens
- "Back to CRM" link returns to the normal project list

### 8.4 Admin Header (`components/admin/admin-header.tsx`)

- Dynamic page title
- Breadcrumbs: Admin > Users > jane@example.com
- Notification bell (reuse existing `NotificationBell` component)

### 8.5 User Menu Integration

Modified file: `components/layout/user-menu.tsx`

For users with `is_system_admin === true`, add an "Admin Panel" menu item (Shield icon) above "Settings" in the dropdown. Links to `/admin`. Non-admins see zero difference.

### 8.6 Auth Hook Integration

Modified file: `hooks/use-auth.ts`

Fetch `is_system_admin` alongside existing user data. Expose `isSystemAdmin` boolean from the hook.

Modified file: `providers/auth-provider.tsx`

Include `is_system_admin` in the auth context so all components can check admin status.

---

## 9. Pages — Detailed Specifications

### 9.1 Admin Dashboard (`/admin`)

**Top of page — stale session alert (conditional, renders FIRST):**

If the current admin has any `system_admin_sessions` with `exited_at IS NULL` and `entered_at < NOW() - INTERVAL '24 hours'`:
- Amber alert card: "You have active admin sessions older than 24 hours:"
- List of project names, each with an "Exit" button
- This is the first thing the admin sees — stale sessions are a data integrity concern and must not be buried below charts.

**Stats cards (first row):**

| Metric | Query | Icon |
|--------|-------|------|
| Total Users | `SELECT COUNT(*) FROM users` | Users |
| Total Projects | `SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL` | FolderKanban |
| Active Projects (7d) | Projects with `activity_log` entries in last 7 days | Activity |
| New Users (30d) | `WHERE created_at > NOW() - INTERVAL '30 days'` | UserPlus |

**Second row — project type breakdown:**

Two cards: Standard Projects count, Community Projects count.

**Third row — charts:**

- New signups per week (last 12 weeks) — bar chart
- Project creation per week (last 12 weeks) — bar chart

Uses existing chart library if present, or simple CSS bars.

**Fourth row — recent admin actions:**

Table showing the last 20 entries from `system_admin_log`:
- Timestamp, Admin Name, Action, Target, Details

### 9.2 Users Page (`/admin/users`)

**DataTable columns:**

| Column | Source | Sortable | Filterable |
|--------|--------|----------|------------|
| Avatar + Name | `users.full_name`, `users.avatar_url` | Yes | — |
| Email | `users.email` | Yes | Search (ILIKE) |
| Projects | `COUNT(DISTINCT project_memberships.project_id)` | Yes | — |
| Highest Role | `MAX(role)` across memberships by rank | — | Filter: owner/admin/member/viewer |
| Joined | `users.created_at` | Yes | Date range |
| Last Active | Most recent `activity_log.created_at` for this user | Yes | — |
| System Admin | `users.is_system_admin` | — | Filter: yes/no |
| Status | Derived from Supabase auth ban status | — | Filter: active/deactivated |

Search bar at top: filters by name or email, case-insensitive.
Pagination: 25 per page, server-side.
Click row → navigate to user detail page.

### 9.3 User Detail Page (`/admin/users/[id]`)

**Tabs:**

**Overview tab:**
- Profile card: avatar, full name, email, joined date, system admin badge (if applicable), status badge (active/deactivated)
- Actions section (confirmation-gated via `AlertDialog`):
  - **Deactivate User** — bans via Supabase admin API (`supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })`). Logged to `system_admin_log`.
  - **Reactivate User** — lifts ban (`ban_duration: 'none'`). Logged.
  - Safety: cannot deactivate yourself (`if (targetId === adminUserId) → reject`)
  - Note: system admin grant/revoke is displayed as CLI instructions, not buttons

**Projects tab:**
- Table of all project memberships: project name (linked to admin project detail), role, joined date
- Empty state if user has no projects

**Activity tab:**
- Activity log entries filtered to this user, across ALL projects (bypasses project RLS via service client)
- Paginated, newest first, 50 per page
- Columns: Timestamp, Project, Action, Entity Type, Details

**Connections tab:**
- Gmail: connected (email address) or not connected
- Telnyx: connected (phone number) or not connected
- Read-only — admin cannot modify user connections

### 9.4 Projects Page (`/admin/projects`)

**DataTable columns:**

| Column | Source | Sortable | Filterable |
|--------|--------|----------|------------|
| Name | `projects.name` | Yes | Search (ILIKE) |
| Type | `projects.project_type` | — | Filter: standard/community |
| Owner | `users.full_name` via `owner_id` join | Yes | — |
| Members | `COUNT(project_memberships)` | Yes | — |
| Created | `projects.created_at` | Yes | Date range |
| Last Activity | Most recent `activity_log.created_at` | Yes | — |
| Status | Active or Deleted (from `deleted_at`) | — | Filter: active/deleted |
| API Key | Has `openrouter_api_key` in `project_secrets` | — | Filter: configured/missing |

Search, pagination (25/page), server-side.
Click row → navigate to project detail page.

### 9.5 Project Detail Page (`/admin/projects/[id]`)

**Tabs:**

**Overview tab:**
- Project info card: name, slug, type, description, owner (linked to admin user detail), created date
- For community projects: accounting target, impact framework name
- Entity counts section — cards showing counts for relevant entities:
  - Standard: People, Organizations, Opportunities, RFPs, Sequences, Contracts
  - Community: Households, Programs, Community Assets, Contributions
- Actions section:
  - **Enter Project** — creates temporary membership + session (see §10)
  - **Soft Delete Project** — confirmation dialog requiring project name to be typed. Logged.
  - **Restore Project** — only shown for soft-deleted projects. Logged.

**Members tab:**
- Table: name (linked to admin user detail), email, role, joined date
- No ability to add/remove members from admin panel — that's done inside the project

**Settings tab:**
- Read-only view of `projects.settings` JSONB, formatted
- Accounting target (for community projects)
- Impact framework (for community projects)

**Secrets tab:**
- List of configured secret key names with masked values (via `listProjectSecrets()`)
- Shows which keys are configured and which are missing
- No ability to read actual values or set keys — just visibility into what's configured

**Activity tab:**
- Project-scoped activity log, paginated, newest first
- Same format as user detail activity tab but filtered to this project

### 9.6 Activity Log Page (`/admin/activity`)

System-wide view combining `activity_log` (CRM actions) and `system_admin_log` (admin actions) into a single timeline.

**Filters:**

| Filter | Options |
|--------|---------|
| Log Type | All, CRM Activity, Admin Actions |
| Project | Dropdown of all projects (searchable) |
| User | Dropdown/search of all users |
| Action | Dropdown of action types (from `activity_log.action` + `system_admin_log.action` values) |
| Date Range | Start and end date pickers |

**Table columns:** Timestamp, User (name + avatar), Project (name, or "System" for admin actions), Action, Entity Type, Details.

Pagination: 50 per page, server-side, newest first.

Click a row → expandable panel showing full `changes` / `details` JSONB formatted as JSON.

**Query implementation:**
- For `type = 'all'` or `type = 'crm'`: query `activity_log` via service client
- For `type = 'all'` or `type = 'admin'`: query `system_admin_log`
- Merge results, sort by `created_at DESC`
- Apply filters before merge for performance

### 9.7 System Settings Page (`/admin/settings`)

**Tabs:**

**API Key Policy tab:**
- Toggle: "Require projects to configure their own OpenRouter API key"
  - OFF (default): projects without a key fall back to the deployment's `process.env.OPENROUTER_API_KEY`
  - ON: projects without a key cannot use AI features. They see "Configure your OpenRouter API key in Settings → API Keys."
- Safety check: before enabling, show count of projects that would be affected ("X of Y projects do not have a configured key")
- Table showing all projects with their API key status: Project Name, Type, Owner, API Key Status (Configured / Missing), link to project detail

**Deployment Info tab (read-only):**
- Environment variables status (masked, not values):
  - `OPENROUTER_API_KEY`: ✅ Set / ❌ Not set
  - `NEXT_PUBLIC_SUPABASE_URL`: ✅ Set / ❌ Not set
  - `SUPABASE_SERVICE_ROLE_KEY`: ✅ Set / ❌ Not set
  - `NEXT_PUBLIC_APP_URL`: value shown (not sensitive)
  - `ENCRYPTION_KEY`: ✅ Set / ❌ Not set
- App version / git commit hash (from `process.env.VERCEL_GIT_COMMIT_SHA` or similar)
- Node version, Next.js version

**Admin Users tab (read-only):**
- Table of users with `is_system_admin = true`: name, email, granted date (approximated from `updated_at`)
- Informational text: "System admin access is managed via CLI. Run: `npx tsx scripts/set-system-admin.ts grant user@example.com`"

### 9.8 Bug Report Submission (User-Facing)

This is the only part of the bug reporting feature that lives **outside** the admin panel. Every logged-in user can submit bug reports from anywhere in the app.

**Trigger:** A persistent "Report Bug" button accessible from:
- The user menu dropdown (Bug icon, below "Settings", above "Log out")
- A floating action button (bottom-right corner, semi-transparent, optional — can be toggled off via system setting)

**Bug Report Dialog (`components/bug-report-dialog.tsx`):**

A modal dialog (reuses existing `Dialog` component pattern) with:

| Field | Type | Required | Auto-populated |
|-------|------|----------|----------------|
| Description | Textarea | Yes | No |
| Screenshot | File upload (image) | No | No |
| Page URL | Hidden input | Yes | `window.location.href` |
| User Agent | Hidden input | Yes | `navigator.userAgent` |
| Project | Hidden input | No | Current project ID if user is inside a project, null otherwise |

**Screenshot capture flow:**
1. User clicks "Attach Screenshot"
2. Two options: (a) upload an image file, or (b) capture current screen via `navigator.mediaDevices.getDisplayMedia()` (browser permitting — fallback to file upload only)
3. Image uploaded to Supabase Storage bucket `bug-screenshots/` via presigned URL
4. `screenshot_path` stored on the bug report record

**Submission flow:**
1. User fills in description, optionally attaches screenshot
2. Clicks "Submit"
3. `POST /api/bug-reports` — creates record in `bug_reports` table with `status: 'open'`, `priority: 'medium'` (default)
4. Toast: "Bug report submitted. Thank you!"
5. Dialog closes

**User's own bug reports:** Users can view their submitted reports in a simple list at `/settings/bug-reports` (or a tab on the existing settings page). Shows: description (truncated), status badge, submitted date. Read-only — users cannot edit or delete their reports after submission.

**API route: `POST /api/bug-reports`**

```typescript
// Body: { description: string, screenshot_path?: string, page_url: string, user_agent: string, project_id?: string }
// Auth: any logged-in user
// Uses regular client (RLS enforces user_id = auth.uid())
```

**API route: `GET /api/bug-reports`**

```typescript
// Returns current user's own bug reports (RLS-enforced)
// Sorted by created_at DESC
// Used by the user settings view
```

### 9.9 Bug Reports Page — Admin (`/admin/bug-reports`)

The admin view for triaging, prioritizing, and resolving all bug reports across all users.

**DataTable columns:**

| Column | Source | Sortable | Filterable |
|--------|--------|----------|------------|
| ID | `bug_reports.id` (truncated UUID) | — | — |
| Reporter | `users.full_name` + `users.email` via `user_id` join | Yes | Search |
| Project | `projects.name` via `project_id` join (or "—" if null) | — | Filter: dropdown |
| Description | `bug_reports.description` (truncated to 100 chars) | — | Search |
| Page URL | `bug_reports.page_url` (truncated, linkable) | — | — |
| Status | `bug_reports.status` | — | Filter: open/in_progress/resolved/closed |
| Priority | `bug_reports.priority` | Yes | Filter: low/medium/high/critical |
| Assigned To | `users.full_name` via `assigned_to` join | — | Filter: dropdown of admin users |
| Submitted | `bug_reports.created_at` | Yes (default: newest first) | Date range |
| Screenshot | Thumbnail/icon if `screenshot_path` is set | — | — |

Search bar: filters by reporter name/email or description text.
Pagination: 25 per page, server-side.

**Bug report detail (inline expandable row or side panel):**

Clicking a row expands it (or opens a side panel) showing:
- Full description
- Screenshot (if attached) — click to view full size
- Page URL (clickable link)
- User agent (for debugging browser-specific issues)
- Reporter info (name, email, link to admin user detail)
- Project info (name, link to admin project detail) or "No project context"
- Timeline: created → status changes → resolved

**Admin actions on a bug report:**

| Action | Field updated | Notes |
|--------|--------------|-------|
| Set Priority | `priority` | Dropdown: low, medium, high, critical |
| Set Status | `status` | Dropdown: open, in_progress, resolved, closed |
| Assign | `assigned_to` | Dropdown of system admin users |
| Add Admin Notes | `admin_notes` | Textarea — internal notes, not visible to the reporter |
| Add Resolution Notes | `resolution_notes` | Textarea — explains the fix. Visible to the reporter in their settings view. |
| Resolve | `status` → `resolved`, `resolved_at` → NOW() | Shortcut that sets both fields |
| Close | `status` → `closed` | For reports that are duplicates, not actionable, or won't fix |

All admin actions on bug reports are logged to `system_admin_log` with `target_type: 'bug_report'` and `target_id: bug_report.id`.

**Dashboard integration:**

Add to the admin dashboard (§9.1):
- A stat card: "Open Bug Reports" — count of `bug_reports WHERE status = 'open'`
- In the stats API response, include `open_bug_reports` count

**API routes:**

`GET /api/admin/bug-reports` — paginated list with search, filter, sort. Uses service client.

`GET /api/admin/bug-reports/[id]` — full detail with reporter info, project info, screenshot URL.

`PATCH /api/admin/bug-reports/[id]` — update status, priority, assigned_to, admin_notes, resolution_notes. Logged to `system_admin_log`.

---

## 10. "Enter Project" / "Exit Project" — Detailed Flow

This is the most complex feature and the most important for platform operations.

### 10.1 Enter Project

**Trigger:** Admin clicks "Enter Project" button on `/admin/projects/[id]`

**API: `POST /api/admin/projects/[id]/enter`**

Steps:
1. Verify admin via `requireSystemAdmin(userId)`
2. Fetch project by ID (including soft-deleted — admin can enter deleted projects to inspect)
3. Check if admin already has a membership in this project:
   - **If yes (real membership):** Skip membership creation. Fetch the existing `membership_id`. Check if there's an active admin session:
     - If session exists: return `{ slug, already_member: true, existing_session: true }`
     - If no session: create `system_admin_sessions` row using the existing `membership_id`, return `{ slug, already_member: true }`
   - **If no:** Create `project_memberships` row with `role: 'owner'`. Create `system_admin_sessions` row with `membership_id`. Return `{ slug }`.
4. Log to `system_admin_log`: action `entered_project`, target_type `project`, target_id, details include project name/slug
5. Client redirects to `/projects/[slug]`

### 10.2 Admin Mode Banner

**Component: `components/admin/admin-mode-banner.tsx`**

Rendered conditionally in `app/(dashboard)/projects/[slug]/layout.tsx`:

```typescript
// In the project layout (server component):
// After fetching user and project...

// Check for active admin session
const serviceClient = createServiceClient();
const { data: adminSession } = await serviceClient
  .from('system_admin_sessions')
  .select('id, project_id')
  .eq('admin_user_id', user.id)
  .eq('project_id', project.id)
  .is('exited_at', null)
  .maybeSingle();

// Pass to layout
return (
  <div className="flex h-screen bg-background">
    <ProjectSidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      {adminSession && <AdminModeBanner projectId={project.id} projectName={project.name} />}
      <ProjectHeader />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
    <ChatPanel />
  </div>
);
```

**Banner appearance:**
- Fixed at top of the content area (below project header)
- Amber/yellow background (`bg-amber-50 border-amber-200` or similar)
- Text: "System Admin Mode — {Project Name}"
- Shield icon on the left
- "Exit Project" button on the right
- z-index high enough to stay visible but below modals

### 10.3 Exit Project

**Trigger:** Admin clicks "Exit Project" in the banner, OR clicks "Exit" in the stale session alert on the admin dashboard.

**API: `POST /api/admin/projects/[id]/exit`**

Steps:
1. Verify admin via `requireSystemAdmin(userId)`
2. Find the active admin session: `system_admin_sessions WHERE admin_user_id = userId AND project_id = projectId AND exited_at IS NULL`
3. If no session found: return `{ success: true }` with 200 (idempotent — safe to call even if already exited, no-op)
4. Fetch the `membership_id` from the session
5. Check if the membership existed before the admin entered:
   - Query `system_admin_sessions.entered_at` and compare with `project_memberships.joined_at`
   - If `joined_at < entered_at` (membership existed before admin session): do NOT delete the membership (admin was already a real member). Only close the session.
   - If `joined_at >= entered_at` (membership was created by the enter action): delete the membership AND close the session.
6. Set `exited_at = NOW()` on the session
7. Log to `system_admin_log`: action `exited_project`
8. Return `{ success: true }`
9. Client redirects to `/admin/projects`

### 10.4 Stale Session Cleanup

**On admin dashboard load (`/admin`):**

Query: `SELECT * FROM system_admin_sessions WHERE admin_user_id = :userId AND exited_at IS NULL AND entered_at < NOW() - INTERVAL '24 hours'`

If results exist, render an amber alert card at the top of the dashboard:
- "You have active admin sessions older than 24 hours:"
- List of project names, each with an "Exit" button
- Clicking "Exit" calls `POST /api/admin/projects/[id]/exit` and refreshes

This prevents orphaned memberships where an admin entered a project, navigated away, and never clicked "Exit."

### 10.5 Safety Rails

| Scenario | Behavior |
|----------|----------|
| Admin enters project they're already a real member of | Session created but no duplicate membership. Banner shows. Exit does NOT remove the pre-existing membership. |
| Admin enters project, another admin also enters same project | Each gets their own session + membership (unique constraint is per-admin per-project). No conflict. |
| Admin enters project, project is soft-deleted while they're inside | Admin can still navigate (soft-deleted projects are accessible to admins). On exit, membership is cleaned up normally. |
| Admin's browser crashes without exiting | Session persists. Stale session alert catches it within 24 hours on next admin dashboard visit. |
| Admin enters project, then their `is_system_admin` is revoked via CLI | Next API call to any admin route fails with 403. The orphaned membership and session remain but are inert (the admin now has a normal owner membership in the project, which is cleaned up when they realize and ask for removal, or by a future admin). |

---

## 11. API Routes — Complete Specification

All routes under `app/api/admin/`. Every route:
1. Checks auth via `supabase.auth.getUser()` → 401 if not authenticated
2. Calls `requireSystemAdmin(userId)` → 403 if not system admin
3. Uses `createServiceClient()` for all database queries
4. Calls `logAdminAction()` for any mutation
5. Returns standard JSON responses with appropriate status codes

### 11.1 Stats

**`GET /api/admin/stats`**

Response:
```json
{
  "total_users": 47,
  "total_projects": 12,
  "active_projects_7d": 8,
  "new_users_30d": 5,
  "projects_by_type": { "standard": 9, "community": 3 },
  "projects_missing_api_key": 4,
  "open_bug_reports": 3,
  "signups_by_week": [{ "week": "2026-03-10", "count": 2 }, ...],
  "projects_by_week": [{ "week": "2026-03-10", "count": 1 }, ...]
}
```

### 11.2 Users

**`GET /api/admin/users`**

Query params: validated by `adminUserListSchema`.

Query (via service client):
```sql
SELECT u.*,
  COUNT(DISTINCT pm.project_id) as project_count,
  la.last_active_at
FROM users u
LEFT JOIN project_memberships pm ON pm.user_id = u.id
LEFT JOIN LATERAL (
  SELECT MAX(al.created_at) as last_active_at
  FROM activity_log al
  WHERE al.user_id = u.id
) la ON true
WHERE ($search IS NULL OR (u.email ILIKE '%' || $search || '%' OR u.full_name ILIKE '%' || $search || '%'))
GROUP BY u.id, la.last_active_at
ORDER BY {sort_column} {sort_dir}
LIMIT $limit OFFSET $page * $limit
```

> **Performance note:** The `LATERAL` subquery computes `last_active_at` per-user without a full cartesian join on `activity_log`. If `activity_log` grows large, consider adding a materialized `last_active_at` column on `users` updated by trigger, or caching at the application layer.

Ban status: fetched via `supabase.auth.admin.getUserById()` for each user in the result set (or batched via `supabase.auth.admin.listUsers()` if the result set is small).

Response:
```json
{
  "users": [{ ... }],
  "total": 47,
  "page": 0,
  "limit": 25
}
```

**`GET /api/admin/users/[id]`**

Response: full user detail object with memberships, connections.

**`PATCH /api/admin/users/[id]`**

Body: `{ "action": "deactivate" }` or `{ "action": "reactivate" }`

- `deactivate`: calls `supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })` (100 years = effectively permanent)
- `reactivate`: calls `supabase.auth.admin.updateUserById(id, { ban_duration: 'none' })`
- Logs to `system_admin_log`
- Safety: rejects if `targetId === adminUserId`

### 11.3 Projects

**`GET /api/admin/projects`**

Query params: validated by `adminProjectListSchema`.

Query includes soft-deleted projects (when `filter_status = 'deleted'`). Joins `users` for owner info, counts `project_memberships`, checks `project_secrets` for API key status.

**`GET /api/admin/projects/[id]`**

Returns full project detail with entity counts, member list, secrets status, settings.

Entity counts are individual COUNT queries for each entity type relevant to the project type:
- Standard: `people`, `organizations`, `opportunities`, `rfps`, `sequences`, `contracts`
- Community: `households`, `programs`, `community_assets`, `contributions`

**`PATCH /api/admin/projects/[id]`**

Body: `{ "action": "soft_delete" }` or `{ "action": "restore" }`

- `soft_delete`: `UPDATE projects SET deleted_at = NOW() WHERE id = $id AND deleted_at IS NULL`
- `restore`: `UPDATE projects SET deleted_at = NULL WHERE id = $id AND deleted_at IS NOT NULL`
- Logged to `system_admin_log`
- `soft_delete` requires typing the project name to confirm (validated server-side: body includes `{ "action": "soft_delete", "confirm_name": "Acme Corp CRM" }`)

### 11.4 Enter / Exit Project

**`POST /api/admin/projects/[id]/enter`**

See §10.1 for detailed flow.

Response: `{ "slug": "acme-corp", "already_member": false }`

**`POST /api/admin/projects/[id]/exit`**

See §10.3 for detailed flow.

Response: `{ "success": true }`

### 11.5 Sessions

**`GET /api/admin/sessions`**

Returns active (un-exited) admin sessions for the current admin user. Used by the dashboard for stale session alerts.

Response:
```json
{
  "sessions": [
    {
      "id": "...",
      "project_id": "...",
      "project_name": "Acme Corp CRM",
      "project_slug": "acme-corp",
      "entered_at": "2026-03-19T14:30:00Z"
    }
  ]
}
```

### 11.6 Activity

**`GET /api/admin/activity`**

Query params: validated by `adminActivityListSchema`.

Merges `activity_log` and `system_admin_log`, sorted by `created_at DESC`. Joins user info for both tables.

Response:
```json
{
  "entries": [
    {
      "id": "...",
      "source": "crm",
      "user_id": "...",
      "user_name": "Jane Doe",
      "user_email": "jane@example.com",
      "project_id": "...",
      "project_name": "Acme Corp CRM",
      "action": "created",
      "entity_type": "person",
      "details": { ... },
      "created_at": "2026-03-20T10:15:00Z"
    },
    {
      "id": "...",
      "source": "admin",
      "user_id": "...",
      "user_name": "Admin User",
      "user_email": "admin@example.com",
      "project_id": null,
      "project_name": null,
      "action": "deactivated_user",
      "entity_type": null,
      "details": { "user_email": "bad@actor.com" },
      "created_at": "2026-03-20T09:00:00Z"
    }
  ],
  "total": 1247,
  "page": 0,
  "limit": 50
}
```

### 11.7 Bug Reports (Admin)

**`GET /api/admin/bug-reports`**

Query params: validated by `adminBugReportListSchema` (search, filter_status, filter_priority, filter_assigned_to, filter_project_id, sort_by, sort_dir, page, limit).

Query joins `users` (reporter), `projects` (context), `users` again (assigned_to). Uses service client.

Response:
```json
{
  "bug_reports": [
    {
      "id": "...",
      "description": "The batch attendance grid doesn't save when...",
      "page_url": "/projects/acme/programs/123/attendance",
      "screenshot_path": "bug-screenshots/abc123.png",
      "status": "open",
      "priority": "high",
      "reporter": { "id": "...", "full_name": "Jane Doe", "email": "jane@example.com" },
      "project": { "id": "...", "name": "Acme Community Center", "slug": "acme" },
      "assigned_to": null,
      "admin_notes": null,
      "resolution_notes": null,
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-03-21T10:15:00Z",
      "resolved_at": null
    }
  ],
  "total": 12,
  "page": 0,
  "limit": 25
}
```

**`GET /api/admin/bug-reports/[id]`**

Full detail including screenshot URL (signed if using Supabase Storage).

**`PATCH /api/admin/bug-reports/[id]`**

Body (all optional):
```json
{
  "status": "in_progress",
  "priority": "critical",
  "assigned_to": "uuid-of-admin",
  "admin_notes": "Looks like a race condition in batch save",
  "resolution_notes": "Fixed in commit abc123"
}
```

When `status` is set to `resolved`, `resolved_at` is auto-set to `NOW()` if not already set.

Logged to `system_admin_log` with `target_type: 'bug_report'`, details include old and new values for changed fields.

### 11.8 Bug Reports (User-Facing)

**`POST /api/bug-reports`**

Not an admin route — uses regular Supabase client (RLS-enforced). Any logged-in user.

Body:
```json
{
  "description": "The attendance grid won't save",
  "page_url": "/projects/acme/programs/123/attendance",
  "screenshot_path": "bug-screenshots/abc123.png",
  "user_agent": "Mozilla/5.0...",
  "project_id": "uuid-or-null"
}
```

Returns: `{ "id": "...", "status": "open", "created_at": "..." }`

**`GET /api/bug-reports`**

Returns current user's own reports (RLS-enforced). Sorted by `created_at DESC`.

### 11.9 Settings

**`GET /api/admin/settings`**

Returns all `system_settings` rows.

Response:
```json
{
  "settings": [
    {
      "key": "require_project_api_keys",
      "value": { "openrouter": false },
      "updated_by": null,
      "updated_at": "2026-03-20T00:00:00Z"
    }
  ]
}
```

**`PATCH /api/admin/settings`**

Body: validated by `adminSettingUpdateSchema`.

Updates a single setting. Logged to `system_admin_log` with old and new values in details.

---

## 12. Components — Complete Inventory

### 12.1 New Components (`components/admin/`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `admin-sidebar.tsx` | Admin navigation sidebar | `currentPath: string` |
| `admin-header.tsx` | Page header with breadcrumbs | `title: string, breadcrumbs: Array<{label, href}>` |
| `admin-mode-banner.tsx` | Amber banner for admin sessions inside projects | `projectId: string, projectName: string` |
| `admin-stats-cards.tsx` | Dashboard stat cards grid | `stats: AdminStats` |
| `admin-user-table.tsx` | Users DataTable with search, filter, sort, pagination | Standard DataTable props |
| `admin-project-table.tsx` | Projects DataTable with search, filter, sort, pagination | Standard DataTable props |
| `admin-activity-table.tsx` | Activity log DataTable with filters and expandable rows | Standard DataTable props |
| `admin-stale-sessions-alert.tsx` | Amber alert for stale admin sessions on dashboard | `sessions: AdminSession[]` |

### 12.2 Modified Existing Components

| Component | Change |
|-----------|--------|
| `components/layout/user-menu.tsx` | Add "Admin Panel" link (Shield icon) for system admins. Conditional on `isSystemAdmin`. |
| `app/(dashboard)/projects/[slug]/layout.tsx` | Check for active admin session via service client query. Render `AdminModeBanner` conditionally. |

### 12.3 Modified Existing Hooks/Providers

| File | Change |
|------|--------|
| `hooks/use-auth.ts` | Fetch `is_system_admin` column. Expose `isSystemAdmin: boolean`. |
| `providers/auth-provider.tsx` | Include `is_system_admin` in auth context. |

---

## 13. File Inventory — Complete

### 13.1 New Files

**Database:**

| File | Purpose |
|------|---------|
| `supabase/migrations/0139_system_admin.sql` | All schema changes: column, tables, RLS, indexes, function, seeds |

**Scripts:**

| File | Purpose |
|------|---------|
| `scripts/set-system-admin.ts` | CLI to grant/revoke/list system admins |

**Types:**

| File | Purpose |
|------|---------|
| `types/admin.ts` | All admin-specific TypeScript types |

**Lib:**

| File | Purpose |
|------|---------|
| `lib/admin/permissions.ts` | `requireSystemAdmin()`, `logAdminAction()` |
| `lib/admin/queries.ts` | Reusable admin query functions |
| `lib/admin/validators.ts` | Zod schemas for admin API inputs |

**API Routes:**

| File | Methods | Purpose |
|------|---------|---------|
| `app/api/admin/stats/route.ts` | GET | Dashboard metrics |
| `app/api/admin/users/route.ts` | GET | Paginated user list |
| `app/api/admin/users/[id]/route.ts` | GET, PATCH | User detail, deactivate/reactivate |
| `app/api/admin/projects/route.ts` | GET | Paginated project list |
| `app/api/admin/projects/[id]/route.ts` | GET, PATCH | Project detail, soft-delete/restore |
| `app/api/admin/projects/[id]/enter/route.ts` | POST | Enter project as admin |
| `app/api/admin/projects/[id]/exit/route.ts` | POST | Exit project, cleanup membership |
| `app/api/admin/sessions/route.ts` | GET | Active admin sessions |
| `app/api/admin/activity/route.ts` | GET | System-wide activity log |
| `app/api/admin/bug-reports/route.ts` | GET | Paginated bug report list (admin) |
| `app/api/admin/bug-reports/[id]/route.ts` | GET, PATCH | Bug report detail, triage/resolve |
| `app/api/admin/settings/route.ts` | GET, PATCH | System settings CRUD |
| `app/api/bug-reports/route.ts` | GET, POST | User-facing: submit + list own reports |

**Pages:**

| File | Purpose |
|------|---------|
| `app/(admin)/layout.tsx` | Admin shell: sidebar, header, auth gate |
| `app/(admin)/admin/page.tsx` | Dashboard |
| `app/(admin)/admin/users/page.tsx` | User list |
| `app/(admin)/admin/users/[id]/page.tsx` | User detail |
| `app/(admin)/admin/projects/page.tsx` | Project list |
| `app/(admin)/admin/projects/[id]/page.tsx` | Project detail |
| `app/(admin)/admin/bug-reports/page.tsx` | Bug report triage |
| `app/(admin)/admin/activity/page.tsx` | System-wide audit log |
| `app/(admin)/admin/settings/page.tsx` | System settings |

**Components:**

| File | Purpose |
|------|---------|
| `components/admin/admin-sidebar.tsx` | Admin navigation sidebar |
| `components/admin/admin-header.tsx` | Page header with breadcrumbs |
| `components/admin/admin-mode-banner.tsx` | Amber banner in project layout |
| `components/admin/admin-stats-cards.tsx` | Dashboard stat cards |
| `components/admin/admin-user-table.tsx` | Users DataTable |
| `components/admin/admin-project-table.tsx` | Projects DataTable |
| `components/admin/admin-bug-report-table.tsx` | Bug reports DataTable |
| `components/admin/admin-activity-table.tsx` | Activity log DataTable |
| `components/admin/admin-stale-sessions-alert.tsx` | Stale session warning |
| `components/bug-report-dialog.tsx` | User-facing bug report submission dialog |

### 13.2 Modified Files

| File | Change | Risk |
|------|--------|------|
| `types/user.ts` | Add `is_system_admin?: boolean` to `User` interface | Minimal — optional field |
| `types/database.ts` | Regenerated after migration | Minimal — additive |
| `hooks/use-auth.ts` | Fetch + expose `isSystemAdmin` | Low — one additional column |
| `providers/auth-provider.tsx` | Include `is_system_admin` in context | Low — additive |
| `components/layout/user-menu.tsx` | Add "Admin Panel" link + "Report Bug" link for all users | Low — conditional render |
| `app/(dashboard)/projects/[slug]/layout.tsx` | Check for admin session, render banner | Low — conditional, no-op for non-admins |
| `lib/secrets.ts` | Add API key policy check in `getProjectSecret()` | Medium — gated behind default-off setting |
| `supabase/migrations/0138_bug_reports.sql` | No modification — already applied. Admin RLS policy + triage columns are added in `0139_system_admin.sql` instead. | None |

---

## 14. Build Phases

### Phase 1: Database + Auth Foundation

**Scope:**
- Write and apply migration `0139_system_admin.sql`
- Regenerate TypeScript types (`types/database.ts`)
- Create `types/admin.ts`
- Add `is_system_admin` to `User` interface in `types/user.ts`
- Create `lib/admin/permissions.ts` (`requireSystemAdmin()`, `logAdminAction()`)
- Create `scripts/set-system-admin.ts`
- Create `lib/admin/validators.ts`
- Run typecheck

**Dependencies:** None

**Deliverables:**
- Migration applies cleanly
- CLI script works: grant, revoke, list
- `requireSystemAdmin()` correctly passes/fails
- `logAdminAction()` writes to `system_admin_log`
- All existing tests pass (no regression)

**Phase 1 Tests:**
- Migration applies cleanly to current database
- `is_system_admin` defaults to `false` for all existing users
- `scripts/set-system-admin.ts grant user@example.com` sets flag to `true`
- `scripts/set-system-admin.ts revoke user@example.com` sets flag to `false`
- `scripts/set-system-admin.ts list` shows current admins
- `requireSystemAdmin()` throws `SystemAdminError` for non-admin users
- `requireSystemAdmin()` passes silently for admin users
- `logAdminAction()` inserts row into `system_admin_log` with correct fields
- `system_admin_log` RLS (SELECT): query as non-admin user returns 0 rows
- `system_admin_log` RLS (INSERT): non-admin user cannot insert rows (even with their own `auth.uid()` as `admin_user_id`)
- `system_settings` RLS: query as non-admin user returns 0 rows
- `system_admin_sessions` RLS: query as non-admin user returns 0 rows
- New projects RLS policy: admin user can SELECT all projects (including ones they're not a member of)
- New projects RLS policy: non-admin user still only sees projects they're a member of
- New users RLS policy: admin can SELECT all users; non-admin can only SELECT own row
- `is_system_admin()` SQL function returns correct boolean for admin and non-admin users
- `npm run typecheck` passes with no errors
- Full existing test suite passes (no regression)

---

### Phase 2: Admin Layout + Dashboard

**Scope:**
- Create `app/(admin)/layout.tsx` with auth gate
- Create `components/admin/admin-sidebar.tsx`
- Create `components/admin/admin-header.tsx`
- Create `app/api/admin/stats/route.ts`
- Create `app/api/admin/sessions/route.ts`
- Create `components/admin/admin-stats-cards.tsx`
- Create `components/admin/admin-stale-sessions-alert.tsx`
- Create `app/(admin)/admin/page.tsx` (dashboard)
- Create `lib/admin/queries.ts` (start with `getAdminStats()`, `getActiveSessions()`)

**Dependencies:** Phase 1

**Deliverables:**
- Admin layout renders for system admins, redirects non-admins
- Dashboard shows correct stats
- Stale session alert shows when applicable

**Phase 2 Tests:**
- Non-admin user visiting `/admin` is redirected to `/projects`
- Admin user visiting `/admin` sees the admin dashboard
- `GET /api/admin/stats` returns correct counts for users, projects, active projects, new users
- `GET /api/admin/stats` returns 401 for unauthenticated requests
- `GET /api/admin/stats` returns 403 for authenticated non-admin users
- `GET /api/admin/sessions` returns empty array when no active sessions
- `GET /api/admin/sessions` returns sessions when admin has entered projects
- Dashboard renders correctly with zero data (empty database — empty state)
- Dashboard renders correctly with populated data
- Admin sidebar shows correct navigation items
- Admin sidebar "Back to CRM" link goes to `/projects`
- Stale session alert renders when sessions are older than 24 hours
- Stale session alert does not render when no stale sessions exist

---

### Phase 3: User Management

**Scope:**
- Create `app/api/admin/users/route.ts` (GET)
- Create `app/api/admin/users/[id]/route.ts` (GET, PATCH)
- Create `components/admin/admin-user-table.tsx`
- Create `app/(admin)/admin/users/page.tsx`
- Create `app/(admin)/admin/users/[id]/page.tsx`
- Add `listUsers()`, `getUserDetail()` to `lib/admin/queries.ts`

**Dependencies:** Phase 2 (needs admin layout)

**Deliverables:**
- User list with search, filter, sort, pagination
- User detail with tabs (overview, projects, activity, connections)
- Deactivate/reactivate users

**Phase 3 Tests:**
- `GET /api/admin/users` returns all users with correct project counts
- `GET /api/admin/users` returns 403 for non-admin
- Search by email filters correctly (case-insensitive)
- Search by name filters correctly (case-insensitive)
- Filter by system admin status works
- Filter by role works
- Sort by name, email, created_at, last_active_at, project_count works in both directions
- Pagination returns correct page sizes and total counts
- Pagination offset works correctly
- `GET /api/admin/users/[id]` returns full user detail with memberships
- `GET /api/admin/users/[id]` returns 404 for non-existent user
- `GET /api/admin/users/[id]` returns 403 for non-admin
- User detail shows all project memberships across projects
- User detail shows correct connection statuses (gmail, telnyx)
- `PATCH /api/admin/users/[id]` with `action: 'deactivate'` bans the user
- Deactivated user cannot log in (integration test)
- `PATCH /api/admin/users/[id]` with `action: 'reactivate'` unbans the user
- Reactivated user can log in again
- Cannot deactivate yourself (returns 400/409)
- Deactivate/reactivate actions are logged to `system_admin_log`
- User list page renders with correct columns
- User detail page renders all tabs
- User detail empty states render correctly (user with no projects, no activity)

---

### Phase 4: Project Management + Enter/Exit

**Scope:**
- Create `app/api/admin/projects/route.ts` (GET)
- Create `app/api/admin/projects/[id]/route.ts` (GET, PATCH)
- Create `app/api/admin/projects/[id]/enter/route.ts` (POST)
- Create `app/api/admin/projects/[id]/exit/route.ts` (POST)
- Create `components/admin/admin-project-table.tsx`
- Create `components/admin/admin-mode-banner.tsx`
- Create `app/(admin)/admin/projects/page.tsx`
- Create `app/(admin)/admin/projects/[id]/page.tsx`
- Modify `app/(dashboard)/projects/[slug]/layout.tsx` — add admin session check + banner
- Add `listProjects()`, `getProjectDetail()` to `lib/admin/queries.ts`

**Dependencies:** Phase 2 (needs admin layout)

**Deliverables:**
- Project list with search, filter, sort, pagination
- Project detail with tabs (overview, members, settings, secrets, activity)
- Enter project as admin (creates membership + session + banner)
- Exit project (cleans up membership + session)
- Soft delete / restore projects

**Phase 4 Tests:**
- `GET /api/admin/projects` returns all projects including soft-deleted ones
- `GET /api/admin/projects` returns 403 for non-admin
- Search by name filters correctly
- Filter by type (standard/community) works
- Filter by status (active/deleted) works
- Filter by API key status (configured/missing) works
- Sort by name, created_at, last_activity_at, member_count works
- Pagination works correctly
- `GET /api/admin/projects/[id]` returns full detail with entity counts
- `GET /api/admin/projects/[id]` returns correct member list
- `GET /api/admin/projects/[id]` returns secrets status (key names, not values)
- `GET /api/admin/projects/[id]` returns 404 for non-existent project
- `GET /api/admin/projects/[id]` returns 403 for non-admin
- **Enter project (not already a member):**
  - Creates `project_memberships` row with `role: 'owner'`
  - Creates `system_admin_sessions` row
  - Returns correct slug
  - Logged to `system_admin_log` with action `entered_project`
- **Enter project (already a real member):**
  - Does NOT create duplicate membership
  - Creates session record
  - Returns correct slug with `already_member: true`
- **Enter project (already has active session):**
  - Returns `already_member: true, existing_session: true`
  - Does not create duplicate session
- **Exit project (membership was created by enter):**
  - Deletes the admin-created membership
  - Sets `exited_at` on session
  - Logged to `system_admin_log`
  - Redirects to admin projects page
- **Exit project (admin was already a real member before entering):**
  - Does NOT delete the pre-existing membership
  - Sets `exited_at` on session only
- **Exit project (no active session):**
  - Returns gracefully (idempotent), not an error
- **Soft delete project:**
  - Sets `deleted_at = NOW()`
  - Requires `confirm_name` matching project name
  - Rejects if `confirm_name` doesn't match
  - Logged to `system_admin_log`
- **Restore project:**
  - Clears `deleted_at`
  - Only works on soft-deleted projects
  - Logged to `system_admin_log`
- **Admin mode banner:**
  - Renders in project layout when admin session is active
  - Does NOT render for normal project members
  - Does NOT render when no admin session exists
  - "Exit Project" button in banner calls exit API and redirects
- Project list page renders with correct columns
- Project detail page renders all tabs
- Entity counts are correct for both standard and community projects

---

### Phase 5: Activity Log + System Settings + Bug Reports

**Scope:**
- Create `app/api/admin/activity/route.ts` (GET)
- Create `app/api/admin/settings/route.ts` (GET, PATCH)
- Create `app/api/admin/bug-reports/route.ts` (GET)
- Create `app/api/admin/bug-reports/[id]/route.ts` (GET, PATCH)
- Create `app/api/bug-reports/route.ts` (GET, POST — user-facing)
- Create `components/admin/admin-activity-table.tsx`
- Create `components/admin/admin-bug-report-table.tsx`
- Create `components/bug-report-dialog.tsx` (user-facing submission dialog)
- Create `app/(admin)/admin/activity/page.tsx`
- Create `app/(admin)/admin/bug-reports/page.tsx`
- Create `app/(admin)/admin/settings/page.tsx`
- Add `getSystemActivity()`, `listBugReports()`, `getBugReportDetail()` to `lib/admin/queries.ts`
- Modify `lib/secrets.ts` — add API key policy check
- Admin RLS policy + triage columns for `bug_reports` are included in `0139_system_admin.sql` (not modifying the already-applied `0138`)

**Dependencies:** Phase 2 (needs admin layout)

**Deliverables:**
- System-wide activity log with filters
- System settings page with API key policy toggle
- API key policy enforcement in `getProjectSecret()`
- Bug report submission dialog accessible from user menu (all users)
- Bug report triage page in admin panel
- Admin can set priority, assign, add notes, resolve/close bug reports

**Phase 5 Tests:**
- `GET /api/admin/activity` returns entries from all projects (service client bypasses RLS)
- `GET /api/admin/activity` returns 403 for non-admin
- Filter by log type (`crm` only, `admin` only, `all`) works
- Filter by project_id works
- Filter by user_id works
- Filter by action works
- Filter by date range works
- Pagination works (50 per page)
- Results are sorted by `created_at DESC`
- Admin action entries (from `system_admin_log`) appear correctly in the merged timeline
- CRM activity entries (from `activity_log`) appear correctly
- `GET /api/admin/settings` returns all system settings
- `GET /api/admin/settings` returns 403 for non-admin
- `PATCH /api/admin/settings` updates a setting value
- `PATCH /api/admin/settings` logged to `system_admin_log` with old and new values
- `PATCH /api/admin/settings` returns 403 for non-admin
- **API key policy — when `require_project_api_keys.openrouter = false` (default):**
  - Project WITH key in `project_secrets` → `getProjectSecret()` returns project key
  - Project WITHOUT key → `getProjectSecret()` returns `process.env.OPENROUTER_API_KEY` (existing behavior)
- **API key policy — when `require_project_api_keys.openrouter = true`:**
  - Project WITH key in `project_secrets` → `getProjectSecret()` returns project key (unchanged)
  - Project WITHOUT key → `getProjectSecret()` returns `null` (no env var fallback)
  - AI API routes (chat, research, sequences) return user-friendly error when key is null
- **API key policy safety:**
  - If `system_settings` table is unreachable (DB error), fallback is allowed (safe default)
  - Settings page shows count of projects that would be affected before enabling the toggle
- Activity log page renders with correct columns and filters
- Activity log expandable rows show full JSON details
- Settings page renders all tabs
- Settings API key policy toggle works end-to-end
- **Bug report submission (user-facing):**
  - `POST /api/bug-reports` creates a report with `status: 'open'`, `priority: 'medium'`
  - `POST /api/bug-reports` rejects unauthenticated requests (401)
  - `POST /api/bug-reports` validates required fields (description, page_url)
  - `GET /api/bug-reports` returns only the current user's reports (RLS-enforced)
  - User A cannot see User B's bug reports
  - Bug report dialog renders and submits successfully
  - Screenshot upload stores file in Supabase Storage `bug-screenshots/{user_id}/` path
  - Storage RLS: user can read their own screenshots but not other users' screenshots
  - Storage RLS: system admin can read all screenshots in the bucket
  - `project_id` is auto-populated when submitting from inside a project, null otherwise
- **Bug report triage (admin):**
  - `GET /api/admin/bug-reports` returns all bug reports across all users
  - `GET /api/admin/bug-reports` returns 403 for non-admin
  - Search by reporter name/email works
  - Search by description text works
  - Filter by status works (open/in_progress/resolved/closed)
  - Filter by priority works (low/medium/high/critical)
  - Filter by assigned_to works
  - Filter by project works
  - Sort by created_at, priority works
  - Pagination works correctly
  - `GET /api/admin/bug-reports/[id]` returns full detail with reporter + project info
  - `GET /api/admin/bug-reports/[id]` returns 404 for non-existent report
  - `PATCH /api/admin/bug-reports/[id]` updates status, logged to `system_admin_log`
  - `PATCH /api/admin/bug-reports/[id]` updates priority, logged
  - `PATCH /api/admin/bug-reports/[id]` assigns to admin user, logged
  - `PATCH /api/admin/bug-reports/[id]` adds admin_notes (not visible to reporter)
  - `PATCH /api/admin/bug-reports/[id]` adds resolution_notes (visible to reporter)
  - Setting status to `resolved` auto-sets `resolved_at` to NOW()
  - `PATCH /api/admin/bug-reports/[id]` returns 403 for non-admin
  - Admin dashboard shows "Open Bug Reports" count in stats
  - Bug reports RLS: admin can read all reports; regular user can only read own
  - Bug report page renders with correct columns and filters

---

### Phase 6: Polish + Integration

**Scope:**
- Modify `components/layout/user-menu.tsx` — add "Admin Panel" link + "Report Bug" link (all users)
- Modify `hooks/use-auth.ts` — fetch + expose `isSystemAdmin`
- Modify `providers/auth-provider.tsx` — include in context
- Wire up `BugReportDialog` to user menu (all users) and optionally a floating button
- Add user's own bug report list to settings page (or a new tab)
- Add empty states for all admin tables
- Add loading skeletons for all admin pages
- Add error boundaries for admin pages
- Responsive design for admin pages (tablet-friendly)
- Add breadcrumbs on all admin pages
- Add page titles via Next.js metadata

**Dependencies:** Phases 3, 4, 5

**Deliverables:**
- Admin panel is fully accessible from the user menu
- Bug report submission accessible from user menu for all users
- Users can view their own submitted bug reports in settings
- All pages have proper loading states, empty states, and error handling
- Pages are responsive on tablet screens
- Breadcrumbs work correctly on all pages

**Phase 6 Tests:**
- User menu shows "Admin Panel" link with Shield icon for system admin users
- User menu does NOT show "Admin Panel" for non-admin users
- User menu shows "Report Bug" link for ALL logged-in users
- Bug report dialog opens from user menu
- User's own bug reports list renders in settings with status badges
- Users can see `resolution_notes` on their resolved reports (but not `admin_notes`)
- `useAuth()` hook exposes `isSystemAdmin` correctly for admin users
- `useAuth()` hook exposes `isSystemAdmin` as `false` for non-admin users
- All admin pages render loading skeletons before data loads
- All admin tables show empty states when no data exists
- All admin pages show error state when API calls fail
- Breadcrumbs show correct hierarchy on all pages (Admin > Users > jane@example.com)
- Admin pages are usable at tablet width (768px)
- Page titles are set correctly in browser tab
- Full regression test: existing CRM functionality is unaffected
  - Create a standard CRM project → same sidebar, dashboard, routes
  - Create a community project → same sidebar, dashboard, routes
  - Non-admin user experience is identical to before

---

## 15. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Privilege escalation via UI | System admin grant is CLI-only. No UI endpoint to set `is_system_admin = true`. Script requires server/CLI access. |
| Admin impersonation | Admin enters projects as themselves with owner role, not as another user. All actions are attributed to their real identity in the activity log. |
| Orphaned admin memberships | Stale session detection on dashboard load. 24-hour threshold. Alert with exit buttons. |
| Admin accessing sensitive data (intake, risk scores) | Admin enters with `owner` role which has full access per the existing permission matrix. This is intentional — system admin is the highest trust level. All access is logged and auditable. |
| RLS bypass via direct API calls | Every admin API route independently checks `requireSystemAdmin()`. No route relies solely on the layout check. Double-gate pattern. |
| Admin deletes themselves | `deactivate` endpoint rejects `if (targetId === adminUserId)`. |
| Multiple admins entering same project | Each gets their own session + membership. Unique constraint is per-admin per-project. No conflict. |
| Admin session token theft | Standard Supabase session security applies. Admin sessions are not special auth tokens — they're regular user sessions for users who happen to have `is_system_admin = true`. |
| Rogue admin | `system_admin_log` records every action with IP and user agent. Another admin (or direct DB access) can audit all admin actions. Revoking admin access is a one-line CLI command. |

---

## 16. What This Does NOT Include

Intentionally excluded to keep scope tight:

| Feature | Reason |
|---------|--------|
| Billing / usage metering | Requires usage tracking infrastructure that doesn't exist yet |
| User impersonation (acting as another user) | Security risk; entering as yourself with owner role is sufficient |
| Bulk operations (mass delete, mass email) | Rarely needed; too dangerous for V1 |
| Project creation from admin panel | Admins create projects through the normal flow |
| MCP/API for admin functions | Not needed for V1; admin actions are rare and human-initiated |
| Admin mobile support | Admin panel is tablet-friendly, not phone-optimized. Admin tasks are done at a desk. |
| Email notifications for admin actions | Can be added later; audit log is sufficient for V1 |
| Admin SSO / separate auth flow | Standard Google OAuth is fine; admin is a flag, not a separate identity provider |
| Multi-admin approval for destructive actions | Overkill for current scale; single admin confirmation is sufficient |

---

## 17. Success Criteria

| Criteria | Metric |
|----------|--------|
| Platform visibility | System admin can see all users and projects in one place |
| Tenant support | System admin can enter any project to diagnose issues, without requiring an invitation |
| Audit trail | Every admin action is logged with timestamp, admin identity, IP address |
| Cost separation | API key policy can enforce per-project keys, eliminating shared LLM costs |
| Zero regression | All existing tests pass; standard and community projects behave identically to before |
| Clean exit | Admin can exit a project cleanly, removing temporary membership without affecting pre-existing memberships |
| Bug report pipeline | Users can submit bugs from anywhere in the app; admin can triage, prioritize, assign, and resolve them |

---

## 18. Self-Critique & Open Questions

This section documents known weaknesses, assumptions that may be wrong, and decisions that may need revisiting.

### 18.1 Architectural Concerns

**`system_admin_sessions` adds complexity to the "Enter Project" flow.**
The enter/exit flow requires creating a membership, creating a session, checking for pre-existing memberships on exit, and cleaning up stale sessions. This is 4-5 database operations for what is conceptually "let me look at this project." An alternative would be to bypass project membership entirely and have admin API routes that accept a `project_id` parameter and query via service client — but that would mean the admin can't use the normal project UI (sidebar, dashboard, chat panel), which defeats the purpose. The current design is more complex but gives the admin the real user experience, which is what you need for diagnosing issues. **Decision: keep the current design, but monitor stale session frequency.**

**RLS policy accumulation on the `projects` table.**
Adding `"System admins can view all projects"` is the 4th or 5th SELECT policy on `projects`. Postgres evaluates all policies with OR logic, so more policies = more work per query. At current scale (dozens of projects) this is irrelevant. At 10,000+ projects it could matter. **Mitigation: the `is_system_admin` check is a single indexed boolean lookup — it's fast. Revisit only if query plans show degradation.**

**The `getProjectSecret()` modification is the riskiest change.**
It introduces a database query to `system_settings` on every AI API call (chat, research, sequences, etc.). Even though it's a single-row lookup on a tiny table, it adds latency to every LLM request path. **Mitigation: consider caching the policy value in-memory with a short TTL (30s-60s) so we don't hit the DB on every call. The system_settings table changes extremely rarely.**

### 18.2 Security Gaps

**No admin session expiry enforcement.**
The stale session alert is a UI nudge, not a hard cutoff. If an admin enters a project and never visits the admin dashboard again, the membership persists forever. **Consider: a cron job that auto-closes sessions older than 48 hours and removes the associated membership. This would require the scheduler infrastructure.**

**The CLI-only admin grant is secure but inconvenient.**
If you need to grant admin access urgently and don't have CLI/server access (e.g., you're on your phone), you can't do it. **Consider: a future "admin invite" flow where an existing admin can send a time-limited admin grant link — but this is V2 territory and introduces its own risks.**

**Bug report screenshots could contain sensitive data.**
A screenshot of a household intake form, risk scores, or contractor documents could end up in the `bug-screenshots` bucket. This bucket should have restricted access (admin-only read, user-only write for their own uploads), but the data itself is now outside the RLS boundary. **Mitigation: (1) Supabase Storage policies should restrict read access to the uploader + system admins, (2) screenshots should be auto-deleted after the bug report is closed (configurable retention), (3) the bug report dialog should show a warning: "Screenshots may be reviewed by the system administrator."**

### 18.3 UX Concerns

**The admin panel is a completely separate layout.**
This means navigating between "admin mode" and "normal CRM mode" requires a full page navigation (not a tab or panel). For an admin who frequently switches between managing the platform and using their own project, this could feel clunky. **Consider: whether the admin panel should be a slide-over panel accessible from anywhere, rather than a separate route group. Counter-argument: the admin panel has its own tables, filters, and pagination state — a panel would be too cramped. Keep the separate layout.**

**Bug report dialog has no categorization.**
The current spec has only `description` — no category dropdown (UI bug, data issue, performance, feature request, etc.). This means the admin has to read every report to understand what it's about. **Consider: adding an optional `category` field to the submission dialog. Counter-argument: categories add friction to the submission flow, and most small teams will have so few bug reports that categorization isn't worth the overhead. Defer to V2 if volume warrants it.**

**Users can't see admin_notes on their bug reports.**
This is intentional (admin notes may contain internal context like "this is a known Supabase issue" or "low priority, user is overreacting"). But it means users get no feedback between submission and resolution unless the admin writes `resolution_notes`. **Consider: adding a `status_message` field that the admin can optionally fill in — something like "We're investigating this" — that IS visible to the reporter. This gives users feedback without exposing internal notes.**

### 18.4 Missing Features That May Be Needed Sooner Than Expected

**No email notifications for bug reports.**
When a user submits a bug, the admin only finds out by visiting the admin dashboard and seeing the count. At low volume this is fine. If you have 10 orgs submitting bugs, you'll want email or Slack notifications. **Mitigation: the admin dashboard shows the open count, and the system_admin_log records submissions. A future webhook or email integration could notify on new reports.**

**No bulk actions on bug reports.**
If 5 users report the same bug, the admin has to close each one individually. **Consider: a "close as duplicate of X" action that links reports together, or multi-select + bulk status update. Defer to V2.**

**No way to communicate back to the bug reporter.**
The `resolution_notes` field is one-way (admin → user). There's no comment thread or back-and-forth. If the admin needs more information ("Can you reproduce this?" "What browser?"), they have to reach out via email manually. **Consider: a simple comment thread on bug reports (both admin and user can post). This adds significant complexity. Defer to V2 — for now, the admin can email the user directly (they have the reporter's email).**

### 18.5 Assumptions That May Be Wrong

| Assumption | Risk if wrong | Fallback |
|------------|--------------|----------|
| System admin is always the platform deployer | If a non-technical person needs admin access, the CLI grant is a barrier | Add an admin invite flow in V2 |
| 24-hour stale session threshold is reasonable | If admins routinely work in projects for days, they'll get false alerts | Make the threshold configurable in system settings |
| Users will actually submit bug reports via the dialog | Users may prefer to message you directly | The dialog is low-cost to build and doesn't hurt if unused |
| One admin panel is enough (no per-org admin) | If orgs want their own admin view of their projects | This is a different feature (org-level admin, not system admin) — out of scope |
| `navigator.mediaDevices.getDisplayMedia()` works for screenshots | Some browsers/contexts block screen capture | File upload fallback is always available |
| Supabase Storage is the right place for bug screenshots | Storage policies may be tricky to configure correctly | Could use the same cloud storage used for receipt images instead |

### 18.6 What I'd Cut If Scope Needs to Shrink

Priority order of what to **keep** (cut from the bottom up):

1. **Keep:** Database foundation (is_system_admin, system_admin_log, system_settings) — everything depends on this
2. **Keep:** Admin dashboard + project list + enter/exit project — this is the core value proposition
3. **Keep:** User list + deactivate/reactivate — essential for managing a multi-tenant platform
4. **Keep:** API key policy in system settings — solves the shared LLM cost problem
5. **Cut last:** Bug report submission dialog — nice-to-have, users can email instead
6. **Cut before that:** Bug report admin triage page — can review reports via Supabase dashboard initially
7. **Cut before that:** Activity log page — can query `activity_log` and `system_admin_log` via Supabase dashboard
8. **Cut before that:** Admin settings page beyond API key policy — deployment info and admin user list are informational

---

*This PRD is a living document. It will be updated as implementation reveals edge cases or design refinements.*

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-21 | Initial PRD: admin panel with dashboard, user/project management, enter/exit flow, activity log, settings, CLI scripts |
| 1.1 | 2026-03-21 | Added bug report submission + admin triage (§9.8, §9.9, §11.7, §11.8). Added self-critique section (§18). Updated dashboard stats to include open bug reports. |
| 1.2 | 2026-03-21 | Editorial pass: fixed migration number to `0139` (conflict with existing `0134`). Clarified `0138` is already applied. Added `bug_report` target_type, `updated_bug_report` action, `AdminBugReportListItem` type, bug report validators and query signatures, `open_bug_reports` in stats. |
| 1.3 | 2026-03-21 | Correctness pass: partial unique index for admin sessions, synced TS types with schema, discriminated union for project actions, added `bugReportSubmitSchema`, reused admin client in `getProjectSecret()`. |
| 1.4 | 2026-03-21 | QA + staff eng review. **Security:** fixed `system_admin_log` INSERT RLS — non-admins could previously insert rows; now requires `is_system_admin = TRUE`. **Performance:** replaced unbounded `LEFT JOIN activity_log` in users list with `LATERAL` subquery + added perf note. **Data integrity:** added `handle_updated_at()` trigger on `system_settings`; moved stale session alert to top of dashboard (was buried in fifth row); fixed exit-project idempotency (returns 200 success, not error, when no session exists); clarified enter-project uses existing `membership_id` when admin already has membership. **Spec gaps:** added Supabase Storage bucket + RLS policies for `bug-screenshots/` with per-user path scoping; added `priority` and `assigned_to` indexes on `bug_reports`; replaced brittle `keyName.replace('_api_key', '')` with explicit `POLICY_KEY_MAP` so non-API-key secrets skip policy check entirely. Added RLS INSERT test for `system_admin_log` and storage RLS tests. |
