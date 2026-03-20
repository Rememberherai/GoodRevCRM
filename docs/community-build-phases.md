# Community Project — Detailed Build Phases

Each phase is broken into ordered tasks with file deliverables, dependencies, and verification checkpoints. Tasks within a phase are sequential unless marked ∥ (parallelizable).

**Conventions:**
- Migration number: `0132` (next after `0131_disposition_blocks_outreach.sql`)
- API routes follow existing pattern: `app/api/projects/[slug]/{entity}/route.ts`
- UI pages follow existing pattern: `app/(dashboard)/projects/[slug]/{entity}/`
- All CRUD entities get: API routes, Zod validators, MCP tools, chat tools, automation events
- "Verify" steps are run after each task group, not deferred to the end

**Migration hold:** Do NOT run `supabase db push` until the user explicitly says to. Write the migration SQL file, but do not execute it. All phases produce code that is validated locally (`npm run typecheck`, `npx vitest`) against the generated types — the migration is pushed only when the user gives the go-ahead, typically after the full phase passes its completion protocol.

**Phase completion protocol — three clean sweeps:**

Every phase ends with a **bug sweep cycle**. A phase is NOT considered complete until it passes **three successive clean sweeps** with zero errors. The process:

1. **Sweep 1:** After all tasks in the phase are coded, run the full end-to-end bug sweep (see below). Fix every bug found. This counts as sweep attempt 1 — it almost certainly fails.
2. **Sweep 2:** After all fixes from sweep 1 are applied, run the full sweep again from scratch. Fix any new bugs introduced by the fixes or missed in sweep 1. If clean → proceed to sweep 3. If not → fix and restart count at sweep 1.
3. **Sweep 3:** Run the full sweep one final time. If clean → phase is complete, commit. If not → fix and restart count at sweep 1.

**What "full end-to-end bug sweep" means:**

```bash
# 1. Type safety — catches schema mismatches, missing imports, wrong signatures
npm run typecheck

# 2. Unit + integration tests — catches logic bugs, validator errors, permission gaps
npx vitest run --reporter=verbose

# 3. Lint (if configured) — catches style/import issues that could mask bugs
npm run lint 2>/dev/null || true

# 4. Manual review — read through every file changed in this phase:
#    - Are all imports resolving?
#    - Do API routes use the correct permission guard (per-method)?
#    - Do validators match the DB schema?
#    - Are automation events emitted?
#    - Are there any hardcoded values that should reference the framework system?
```

If **any** step fails, the sweep is dirty — fix all issues and restart the sweep counter at 1.

**Testing strategy (Vitest):**

Every phase must include a `tests/` directory with test files that cover the phase's deliverables. Tests are written using `npx vitest` and follow these patterns:

| Layer | Test pattern | Example |
|-------|-------------|---------|
| **Validators** | Import Zod schema, test valid/invalid inputs | `tests/validators/community/households.test.ts` |
| **Permission matrix** | `checkCommunityPermission(role, resource, action)` for every cell in §8 | `tests/permissions/community-permissions.test.ts` |
| **API routes** | Mock Supabase client, call route handler, assert status + body | `tests/api/community/households.test.ts` |
| **Utilities** | Pure function tests (framework clone, dimension helpers) | `tests/community/frameworks.test.ts` |
| **Components** | Render with test data, assert key elements present, role-based hiding | `tests/components/community/sidebar.test.ts` |
| **RLS** | Real DB queries per role (requires test DB or Supabase local) | `tests/rls/community-permissions.test.ts` |

Each phase section below specifies its required test files. Tests are written **during** the phase (not after) — they are part of the task list, not a separate step.

---

## Phase 1: Foundation (Database + Types + Roles)

**Goal:** All tables exist, types are generated, validators are written, permission system is extended. No UI yet.

### 1.1 — Migration: schema + roles + RLS

**File:** `supabase/migrations/0132_community_project_type.sql`

| # | Task | Details |
|---|------|---------|
| 1 | Extend role ENUM | `ALTER TYPE public.project_role ADD VALUE 'staff'; ALTER TYPE public.project_role ADD VALUE 'case_manager'; ALTER TYPE public.project_role ADD VALUE 'contractor'; ALTER TYPE public.project_role ADD VALUE 'board_viewer';` (cannot be inside a transaction — must use separate statements or `IF NOT EXISTS` on PG 9.3+) |
| 2 | Add `project_type` + accounting columns to `projects` | `project_type TEXT NOT NULL DEFAULT 'standard'`, `accounting_target`, `accounting_company_id`, `calendar_sync_enabled`, `impact_framework_id` |
| 3 | Create `impact_frameworks` table | `id`, `project_id` (nullable — NULL means global template, non-NULL means project-specific clone), `name`, `description`, `type` (ccf/vital_conditions/custom), `is_active`, timestamps |
| 4 | Create `impact_dimensions` table | `id`, `framework_id` FK, `key`, `label`, `description`, `color`, `icon`, `sort_order`, `is_active` |
| 5 | Create `households` table | All fields from PRD §4.2 + `project_id`, `created_by`, soft-delete, timestamps, `handle_updated_at` trigger |
| 6 | Create `household_members` table | Junction: `household_id`, `person_id`, `relationship`, `is_primary_contact`, `start_date`, `end_date` |
| 7 | Create `household_intake` table | Separately permissioned: `household_id`, `assessed_by`, `assessed_at`, `needs` JSONB, `notes`, `status` |
| 8 | Create `programs` table | All fields from PRD §4.3 including `requires_waiver`, `target_dimensions UUID[]`, `schedule JSONB`, `capacity` |
| 9 | Create `program_enrollments` table | `program_id`, `person_id`, `household_id`, `status`, `waiver_status`, timestamps |
| 10 | Create `program_attendance` table | `program_id`, `person_id`, `date`, `status`, `hours`, UNIQUE constraint on `(program_id, person_id, date)` |
| 11 | Create `contributions` table | All types (monetary, in_kind, volunteer_hours, grant, service), `dimension_id` FK, `grant_id` FK (nullable), donor/recipient FKs |
| 12 | Create `community_assets` table | Category, dimension, geo, condition, steward FKs |
| 13 | Create `contractor_scopes` table | Including structured scope fields: `service_categories TEXT[]`, `certifications TEXT[]`, `service_area_radius_miles`, `home_base_latitude/longitude` |
| 14 | Create `jobs` table | Including structured match fields: `service_category`, `required_certifications TEXT[]`, `service_latitude/longitude`, `is_out_of_scope` |
| 15 | Create `job_time_entries` table | `job_id`, `started_at`, `ended_at`, `is_break`, `duration_minutes` |
| 16 | Create `receipt_confirmations` table | AP history: `vendor`, `amount`, `ocr_raw JSONB`, `accounting_target`, `external_bill_id`, `status`, `image_url` |
| 17 | Create `grants` table (V2 — schema only) | Pipeline object: `funder_organization_id`, `amount_requested/awarded`, `status`, deadlines, `assigned_to`, `contact_person_id` |
| 18 | Create `referrals` table (V2 — schema only) | `person_id`, `household_id`, `partner_organization_id`, `service_type`, `status`, `outcome` |
| 19 | Create `relationships` table (V2 — schema only) | `person_a_id`, `person_b_id`, `type`, UNIQUE constraint |
| 20 | Create `broadcasts` table (V2 — schema only) | `subject`, `body`, `channel`, `filter_criteria JSONB`, `status` |
| 21 | Add columns to `people` | `latitude`, `longitude`, `is_contractor`, `is_volunteer` — all nullable/default false |
| 22 | Add columns to `organizations` | `latitude`, `longitude`, `is_referral_partner` |
| 23 | Add columns to `event_types` | `asset_id UUID REFERENCES community_assets(id)`, `program_id UUID REFERENCES programs(id)` |
| 24 | Create all composite indexes | Per §7 of PRD: `(program_id, date)`, `(project_id, dimension_id)`, `(project_id, contractor_id, status)`, etc. |
| 25 | Create SQL permission function | `community_has_permission(p_project_id UUID, p_resource TEXT, p_action TEXT) RETURNS BOOLEAN` — looks up calling user's role via `auth.uid()` + `project_memberships` (same pattern as existing `has_project_role()` in `0004_projects_rls.sql`), then checks role against the §8 capability matrix. **Do not use `current_role`** — that is the Postgres database role, not the user's project membership role. |
| 26 | Write RLS policies for all new tables | Each table: `USING (community_has_permission(project_id, 'resource', 'view'))` pattern — the function derives the user's membership role internally via `auth.uid()`. Contractor on jobs: special scope-matching policy (own jobs + unassigned jobs matching `service_categories`/`certifications`/`service_area`). `household_intake`: case_manager/admin/owner only. |
| 27 | Seed CCF + Vital Conditions framework templates | Insert into `impact_frameworks` + `impact_dimensions` as global templates (no `project_id` — cloned on project creation) |
| 28 | Create `public_dashboard_configs` table (V2 — schema only) | `id`, `project_id` FK, `title`, `description`, `slug` (unique per project), `status` (draft/preview/published/archived), `theme JSONB` (colors, logo URL), `widget_order UUID[]`, `widgets JSONB` (array of widget configs: type, title, dimension_filter, date_range, min_count_threshold), `hero_image_url`, `min_count_threshold INT DEFAULT 5`, `excluded_categories TEXT[]` (always includes: minors, intake, risk_scores, PII), `access_type TEXT DEFAULT 'public'` CHECK (public/password/signed_link), `password_hash TEXT` (nullable — set only when access_type = 'password'), `data_freshness TEXT DEFAULT 'live'` CHECK (live/snapshot), `snapshot_data JSONB` (nullable — frozen aggregate data when freshness=snapshot), `date_range_type TEXT DEFAULT 'rolling'` CHECK (rolling/fixed), `date_range_start DATE`, `date_range_end DATE`, `geo_granularity TEXT DEFAULT 'zip'` CHECK (zip/neighborhood), `published_at`, `published_by` FK → users, `archived_at`, `created_at`, `updated_at`. UNIQUE on `(project_id, slug)`. Trigger: `handle_updated_at()`. |
| 29 | Create `public_dashboard_share_links` table (V2 — schema only) | `id`, `config_id` FK → `public_dashboard_configs`, `token` TEXT UNIQUE (cryptographic random), `label`, `expires_at` TIMESTAMPTZ (nullable — NULL = no expiry), `is_active` BOOLEAN DEFAULT true, `last_accessed_at`, `access_count INT DEFAULT 0`, `created_at`. Index on `token`. |

**Run:**
```bash
node -e "..." # deallocate prepared statements
npx supabase db push --db-url '...'
```

**Verify:** Migration applies cleanly. Tables exist. RLS policies are active.

### 1.2 — Regenerate TypeScript types

| # | Task | File |
|---|------|------|
| 1 | Regenerate types | `npx supabase gen types typescript --db-url '...' > types/database.ts` |
| 2 | Run typecheck | `npm run typecheck` — fix any breaks in existing files |

**Verify:** `npm run typecheck` passes with zero errors.

### 1.3 — Extend TypeScript role system

| # | Task | File |
|---|------|------|
| 1 | Split `ProjectRole` into layered types | `types/user.ts` — introduce `StandardProjectRole = 'owner' \| 'admin' \| 'member' \| 'viewer'` and `CommunityProjectRole = 'staff' \| 'case_manager' \| 'contractor' \| 'board_viewer'`. Redefine `ProjectRole = StandardProjectRole \| CommunityProjectRole`. This is required because `ROLE_RANK` in `lib/projects/permissions.ts` is typed as `Record<ProjectRole, number>` — if `ProjectRole` gains values without entries in `ROLE_RANK`, the file won't compile. |
| 2 | Retype `permissions.ts` to use `StandardProjectRole` | `lib/projects/permissions.ts` — change `ROLE_RANK: Record<StandardProjectRole, number>` and `requireProjectRole(..., requiredRole: StandardProjectRole)`. No behavioral change — the same four roles, same rank numbers. Existing callers already pass literal `'admin'` / `'member'` etc., which are valid `StandardProjectRole` values. |
| 3 | Retype `rolePermissions` to use `StandardProjectRole` | `types/user.ts` — change `rolePermissions: Record<StandardProjectRole, string[]>`. Add a separate `communityRolePermissions: Record<CommunityProjectRole, string[]>` if needed, or leave community permissions entirely to the matrix model. |
| 4 | Create community permission module | `lib/projects/community-permissions.ts` — `checkCommunityPermission(role: ProjectRole, resource: CommunityResource, action: CommunityAction): boolean` backed by static matrix from §8. Accepts the full `ProjectRole` union so owner/admin can also be checked against the community matrix. |
| 5 | Create `requireCommunityPermission()` API guard | `lib/projects/community-permissions.ts` — async function that reads the user's role from `project_memberships` and calls `checkCommunityPermission()`. Community API routes use this instead of `requireProjectRole()`. |
| 6 | Update duplicate `ProjectRole` in `types/index.ts` | `types/index.ts` line 13 — has its own `ProjectRole = 'owner' \| 'admin' \| 'member' \| 'viewer'`. Either re-export from `types/user.ts` or apply the same `StandardProjectRole \| CommunityProjectRole` split. Must not have two divergent definitions. |
| 7 | Update role validators in `lib/validators/user.ts` | `projectRoles` array (line 4) only has `['owner', 'admin', 'member', 'viewer']` — add community roles to the full array. **Create a separate `inviteCommunityMemberSchema`** that allows `staff \| case_manager \| contractor \| board_viewer` in addition to the standard roles. Do **not** extend the existing `inviteMemberSchema` — it must continue to only allow `admin \| member \| viewer` so standard CRM projects cannot accidentally receive community roles. The members POST route must branch on `project_type` to select the correct schema. Same for `updateMemberRoleSchema` → create `updateCommunityMemberRoleSchema`. |
| 8 | Update team member UI for community roles | `components/team/member-list.tsx` — `roleIcons` (line 51) and `roleColors` (line 58) are `Record<ProjectRole, ...>` with only 4 entries. Add entries for community roles or conditionally branch. The role dropdown (line 201) hardcodes `['admin', 'member', 'viewer']` — extend for community projects. |
| 9 | Update MCP role model | `types/mcp.ts` — `MCP_ROLES` (line 5) only has `['viewer', 'member', 'admin', 'owner']`. Add community roles so `McpRole` covers the full union. `McpContext.role` must accept community roles. |
| 10 | Update MCP key creation | `app/api/projects/[slug]/mcp/keys/route.ts` — `createKeySchema.role` (line 13) only allows `viewer \| member \| admin \| owner`. Extend to include community roles. |
| 11 | Update chat route role cast | `app/api/projects/[slug]/chat/route.ts` — line 89 force-casts `membership.role as McpRole`. Once `McpRole` includes community roles, this cast is safe. Verify no narrowing elsewhere in the chat pipeline. |

**Verify:** `npm run typecheck` passes with zero errors. `lib/projects/permissions.ts` compiles unchanged except for the type narrowing. All existing callers of `requireProjectRole()` still compile (they pass `StandardProjectRole` literals). Import `checkCommunityPermission` and `requireCommunityPermission` works. Team member UI renders community roles with icons/colors. MCP keys can be created with community roles. Chat route accepts community roles without cast errors.

### 1.4 — Community types + validators

| # | Task | File |
|---|------|------|
| 1 | Create community TypeScript types | `types/community.ts` — interfaces for all 18 new tables, enums for statuses |
| 2 | Create project type additions | `types/project.ts` — `ProjectType`, `AccountingTarget` types |
| 3 | ∥ Create household validators | `lib/validators/community/households.ts` — create/update schemas |
| 4 | ∥ Create program validators | `lib/validators/community/programs.ts` — program, enrollment, attendance schemas |
| 5 | ∥ Create contribution validators | `lib/validators/community/contributions.ts` |
| 6 | ∥ Create community asset validators | `lib/validators/community/assets.ts` |
| 7 | ∥ Create contractor/job validators | `lib/validators/community/contractors.ts` — scope, job, time entry schemas |
| 8 | ∥ Create receipt confirmation validators | `lib/validators/community/receipts.ts` |
| 9 | ∥ Create grant validators (V2 schema) | `lib/validators/community/grants.ts` |
| 10 | ∥ Create referral/relationship/broadcast validators (V2 schema) | `lib/validators/community/referrals.ts`, `relationships.ts`, `broadcasts.ts` |
| 11 | ∥ Create public dashboard validators (V2 schema) | `lib/validators/community/public-dashboard.ts` — `createDashboardConfigSchema`, `updateDashboardConfigSchema`, `createShareLinkSchema`, `widgetConfigSchema` (type, title, dimension_filter, date_range, min_count_threshold). Validate `excluded_categories` always includes `['minors', 'intake', 'risk_scores', 'PII']` (append-only — admin can add but never remove these four). |
| 12 | Create framework utilities | `lib/community/frameworks.ts` — CCF/Vital Conditions templates, dimension helpers, color/icon maps, clone-framework-to-project logic |

**Verify:** `npm run typecheck` passes. All validators export correctly.

### 1.5 — RLS tests

| # | Task | File |
|---|------|------|
| 1 | Write per-role RLS test suite | `tests/rls/community-permissions.test.ts` (or `supabase/tests/`) |
| 2 | Test: Contractor gets zero rows on households, intake, contributions, programs, assets, grants, referrals, relationships, broadcasts | Assert empty results for each table |
| 3 | Test: Contractor sees own jobs + unassigned jobs matching their scope | Seed a contractor with scope (categories, certifications, service area), their assigned jobs, other contractor's jobs, unassigned in-scope jobs, unassigned out-of-scope jobs. Assert: sees own + unassigned in-scope only. |
| 4 | Test: Board Viewer sees only grants (view) and aggregate dashboard/reports | No PII access |
| 5 | Test: Staff cannot access household_intake | No RLS allow-policy grants SELECT to staff role |
| 6 | Test: Case Manager can access household_intake | ALLOW on SELECT/INSERT/UPDATE |
| 7 | Test: Owner/Admin have full CRUD on everything | Baseline sanity |

**Verify:** All RLS tests pass. Add to CI pipeline.

### 1.6 — Phase 1 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/validators/community/households.test.ts` | Household create/update schemas — valid, invalid, edge cases |
| 2 | `tests/validators/community/programs.test.ts` | Program, enrollment, attendance schemas |
| 3 | `tests/validators/community/contributions.test.ts` | All contribution types, dimension FK validation |
| 4 | `tests/validators/community/assets.test.ts` | Asset create/update, category enum |
| 5 | `tests/validators/community/contractors.test.ts` | Scope, job, time entry schemas |
| 6 | `tests/validators/community/receipts.test.ts` | Receipt confirmation schemas |
| 7 | `tests/validators/community/grants.test.ts` | Grant CRUD schemas |
| 8 | `tests/validators/community/public-dashboard.test.ts` | Dashboard config, share link, widget config — assert excluded_categories append-only |
| 9 | `tests/permissions/community-permissions.test.ts` | `checkCommunityPermission()` for every role × resource × action cell in §8 matrix |
| 10 | `tests/community/frameworks.test.ts` | Framework template cloning, dimension helpers, color/icon maps |
| 11 | `tests/rls/community-permissions.test.ts` | Per-role RLS (contractor zero-row, board_viewer aggregate-only, staff no intake, etc.) |

### Phase 1 — Commit boundary
Commit: migration + generated types + type extensions + validators + framework utils + RLS tests + test files.

**Phase 1 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat steps 1-2 for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.
5. Do NOT run `supabase db push` — migration file is written but not executed until the user says so.

---

## Phase 2: Project Creation + Navigation

**Goal:** Users can create a Community Center project. Sidebar shows community nav. Dashboard renders with placeholder data.

**Depends on:** Phase 1 complete.

### 2.1 — Project creation dialog

| # | Task | File |
|---|------|------|
| 1 | Add project type step to creation flow | `components/projects/new-project-dialog.tsx` — Step 1: type selector (two large cards: Standard CRM / Community Center) |
| 2 | Add framework selection step | Same file — Step 2 (community only): CCF / Vital Conditions / Custom radio cards |
| 3 | Add accounting integration step | Same file — Step 3 (community only): GoodRev Accounting / QuickBooks / Skip |
| 4 | Update project creation API | `app/api/projects/route.ts` — accept `project_type`, `impact_framework_type`, `accounting_target`. On community: clone framework template, optionally create accounting company link |
| 5 | Update project schema validator | `lib/validators/project.ts` — add `project_type`, `impact_framework_type`, `accounting_target` fields |

**Verify:** Create a community project → DB has `project_type = 'community'`, framework cloned, accounting target set. Create a standard project → unchanged behavior.

### 2.2 — Conditional sidebar

| # | Task | File |
|---|------|------|
| 1 | Create community sidebar component | `components/layout/community-sidebar.tsx` — MVP nav items: Dashboard, Households, People, Organizations, Programs, Contractors, Volunteers, Community Assets, Reporting, Chat, Settings. **Role-filtered:** the sidebar must accept the user's role and hide items they cannot access. `board_viewer` sees only: Dashboard (aggregate), Grants (V2), Reporting (aggregate). `contractor` sees nothing (redirected to contractor portal in Phase 5.4). All other roles see the full nav. Use `checkCommunityPermission(role, resource, 'view')` to determine visibility. |
| 2 | Branch in existing sidebar | `components/layout/project-sidebar.tsx` — add at top: `if (project.project_type === 'community') return <CommunitySidebar />`. Existing sidebar untouched. |
| 3 | Fetch project type in layout | `app/(dashboard)/projects/[slug]/layout.tsx` — pass `project_type` to sidebar component |

**Verify:** Community project (staff+) → sees full community nav. Community project (board_viewer) → sees only Dashboard, Reporting. Community project (contractor) → redirected to contractor portal (Phase 5.4). Standard project → sees existing nav unchanged.

### 2.3 — Community dashboard

| # | Task | File |
|---|------|------|
| 1 | Create community dashboard page | `app/(dashboard)/projects/[slug]/community-dashboard.tsx` (or branch in existing `page.tsx`) |
| 2 | Create impact radar chart component | `components/community/dashboard/impact-radar.tsx` — Recharts spider chart from framework dimensions |
| 3 | Create key metrics cards | `components/community/dashboard/metrics-cards.tsx` — Total Households, Active Programs, Volunteer Hours, Contributions, Attendance, Unique Visitors |
| 4 | Create program performance section | `components/community/dashboard/program-cards.tsx` — enrollment bars, attendance rates. **Hidden for `board_viewer`** — program cards show program names and enrollment counts that could identify small cohorts. |
| 5 | Create activity feed | `components/community/dashboard/activity-feed.tsx` — recent contributions, enrollments, new households. **Hidden for `board_viewer`** — activity feed contains PII (household names, person names). |
| 6 | Create dashboard API route | `app/api/projects/[slug]/community/dashboard/route.ts` — aggregation queries for all dashboard data. **Role-aware response:** when the requesting user is `board_viewer`, omit PII fields (household names, person names), program-level detail (program cards), and recent activity items. Return only aggregate counts and dimension scores — nothing that identifies individuals or small cohorts. Guard via `requireCommunityPermission(..., 'dashboard', 'view')`. |

**Verify:** Community dashboard renders with zero-state (empty data, placeholder radar). Staff/admin/owner/case_manager see all 4 sections (radar, metrics, program cards, activity feed). Board viewer sees only radar chart + aggregate metrics cards (count-only, no names) — no program cards, no activity feed.

### 2.4 — Phase 2 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/components/community/new-project-dialog.test.ts` | Type step renders, framework step shows only for community, accounting step shows only for community, standard path skips community steps |
| 2 | `tests/api/community/project-creation.test.ts` | POST creates community project with correct `project_type`, framework cloned, accounting target set. Standard project creation unchanged. |
| 3 | `tests/components/community/sidebar.test.ts` | Community sidebar renders correct nav for each role (staff, case_manager, board_viewer, contractor). Standard sidebar unchanged. |
| 4 | `tests/components/community/dashboard.test.ts` | Dashboard renders all 4 sections for staff. Board viewer sees only radar + aggregate metrics (no program cards, no activity feed). |
| 5 | `tests/api/community/dashboard.test.ts` | Dashboard API returns full data for staff, aggregate-only for board_viewer. |

### Phase 2 — Commit boundary
Commit: project creation flow + sidebar branching + community dashboard + test files.

**Phase 2 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1 + Phase 2 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 3: Core Entities

**Goal:** Full CRUD for Households, Programs, Contributions, Community Assets. Batch attendance. Waivers. Basic reporting.

**Depends on:** Phase 2 complete.

**Permission guard convention:** All community API routes use `requireCommunityPermission(supabase, userId, projectId, resource, action)` — the async guard that fetches the user's membership role and checks it against the capability matrix. Do **not** use `checkCommunityPermission()` directly in API routes — that is the pure/sync matrix lookup and does not fetch the role from the database. MCP tools and chat tools may use `checkCommunityPermission(ctx.role, resource, action)` since they already have the role in context.

**Per-method guards required:** Every combined route file (e.g., `route.ts` with both GET and POST) must call `requireCommunityPermission` with the **action matching the HTTP method**: `GET → 'view'`, `POST → 'create'`, `PATCH → 'update'`, `DELETE → 'delete'`. Do not apply a single guard to the whole file — this matters for asymmetric roles like `board_viewer` (can view grants but not create them) and `staff` (can view jobs but also assign). Each exported handler (`GET`, `POST`, `PATCH`, `DELETE`) checks its own action independently.

### 3.1 — Households

| # | Task | File |
|---|------|------|
| 1 | Create list + create API | `app/api/projects/[slug]/households/route.ts` — GET (paginated, searchable) guarded by `requireCommunityPermission(..., 'households', 'view')`, POST (create with members) guarded by `requireCommunityPermission(..., 'households', 'create')`. **Per-method guards** — GET and POST check different actions. Emit `household.created` automation event on POST. |
| 2 | Create detail + update + delete API | `app/api/projects/[slug]/households/[id]/route.ts` — GET, PATCH, DELETE (soft). Emit events. |
| 3 | Create members API | `app/api/projects/[slug]/households/[id]/members/route.ts` — GET, POST, DELETE. Emit `household.member_added`. |
| 4 | Create intake API | `app/api/projects/[slug]/households/[id]/intake/route.ts` — GET, POST, PATCH. Permission: case_manager+ only. Emit `intake.created`. |
| 5 | Create household list page | `app/(dashboard)/projects/[slug]/households/page.tsx` + `households-page-client.tsx` — table with search, filters |
| 6 | Create new household dialog | `components/community/households/new-household-dialog.tsx` — multi-step: household info → add members → optional enrollment → optional intake |
| 7 | Create household detail page | `app/(dashboard)/projects/[slug]/households/[id]/page.tsx` + `household-detail-client.tsx` — tabs: Members, Programs, Contributions, Intake (if case_manager+), Timeline |
| 8 | Create household members tab | `components/community/households/household-members-tab.tsx` — add/remove members, show date ranges |

**Verify:** CRUD works. Intake restricted to case_manager+. Contractor gets 403 on household routes.

### 3.2 — Programs + Attendance

| # | Task | File |
|---|------|------|
| 1 | Create program list + create API | `app/api/projects/[slug]/programs/route.ts` — GET, POST. Emit `program.created`. |
| 2 | Create program detail + update + delete API | `app/api/projects/[slug]/programs/[id]/route.ts` |
| 3 | Create enrollments API | `app/api/projects/[slug]/programs/[id]/enrollments/route.ts` — GET, POST, DELETE. Waiver enforcement: if `requires_waiver`, enrollment status starts as `pending` waiver. Emit `program.enrollment.created`. |
| 4 | Create batch attendance API | `app/api/projects/[slug]/programs/[id]/attendance/route.ts` — GET (by date), POST (batch submit array of {person_id, status, hours}). Emit `program.attendance.batch`. |
| 5 | Create program list page | `app/(dashboard)/projects/[slug]/programs/page.tsx` + `programs-page-client.tsx` — card grid with status badges, enrollment bars, dimension dots |
| 6 | Create new program dialog | `components/community/programs/new-program-dialog.tsx` |
| 7 | Create program detail page | `app/(dashboard)/projects/[slug]/programs/[id]/page.tsx` + `program-detail-client.tsx` — tabs: Info, Enrollments (with waiver status), Attendance Grid, Contributions |
| 8 | Create batch attendance component | `components/community/programs/batch-attendance.tsx` — date picker → enrolled member grid → present/absent/excused checkboxes → bulk save |

**Verify:** Create program → enroll person → take attendance → verify attendance records. Waiver enforcement: enrollment blocked until signed.

### 3.3 — Waivers (reuse contracts module)

| # | Task | File |
|---|------|------|
| 1 | Create waiver template(s) | Seed default waiver templates (liability, photo release) as contract templates linked to community projects |
| 2 | Hook enrollment → waiver creation | In enrollment POST: if `program.requires_waiver`, auto-create contract document from waiver template, add enrollee as recipient, send for signature |
| 3 | Hook signature completion → enrollment update | Listen for `document.completed` automation event (existing) → update `program_enrollments.waiver_status = 'signed'` |
| 4 | Show waiver status in enrollment list | `components/community/programs/enrollment-list.tsx` — waiver status badges |

**Verify:** Enroll in waiver-required program → contract created → sign → enrollment goes active.

### 3.4 — Contributions

| # | Task | File |
|---|------|------|
| 1 | Create contribution list + create API | `app/api/projects/[slug]/contributions/route.ts` — GET (filterable by type, dimension, donor), POST. Auto-inherit dimension from linked program. Emit `contribution.created`. |
| 2 | Create contribution detail + update + delete API | `app/api/projects/[slug]/contributions/[id]/route.ts` |
| 3 | Create contributions page | `app/(dashboard)/projects/[slug]/contributions/page.tsx` + `contributions-page-client.tsx` — table with type filter tabs |
| 4 | Create donation entry component | `components/community/contributions/donation-entry.tsx` — monetary, in_kind, grant subtypes |
| 5 | Create time log entry component | `components/community/contributions/time-log-entry.tsx` — volunteer_hours, service subtypes with auto-dimension-inherit |

**Verify:** Log a donation → tagged with dimension. Log volunteer hours linked to program → dimension auto-inherited.

### 3.5 — Community Assets

| # | Task | File |
|---|------|------|
| 1 | Create asset list + create API | `app/api/projects/[slug]/community-assets/route.ts` — GET, POST. Emit `asset.created`. |
| 2 | Create asset detail + update + delete API | `app/api/projects/[slug]/community-assets/[id]/route.ts` |
| 3 | Create asset list page | `app/(dashboard)/projects/[slug]/community-assets/page.tsx` + `assets-page-client.tsx` — table with category/condition filters |
| 4 | Create new asset dialog | `components/community/assets/new-asset-dialog.tsx` |
| 5 | Create asset detail page | `app/(dashboard)/projects/[slug]/community-assets/[id]/page.tsx` + `asset-detail-client.tsx` — info, mini-map, steward, linked programs |

**Verify:** CRUD works. Dimension tagging correct.

### 3.6 — Basic reporting

| # | Task | File |
|---|------|------|
| 1 | Create community reports API | `app/api/projects/[slug]/community/reports/route.ts` — endpoints for each MVP report type |
| 2 | ∥ Program performance report | `components/community/reports/program-performance.tsx` — enrollment, attendance dosage, completion, unique visitors |
| 3 | ∥ Contribution summary report | `components/community/reports/contribution-summary.tsx` — by type, dimension, donor, status |
| 4 | ∥ Household demographics report | `components/community/reports/household-demographics.tsx` — count, size, geographic spread |
| 5 | ∥ Volunteer impact report | `components/community/reports/volunteer-impact.tsx` — hours, FTE, dollar value |
| 6 | ∥ Contractor hours report | `components/community/reports/contractor-hours.tsx` — by contractor, job, scope compliance |
| 7 | Create reporting page | `app/(dashboard)/projects/[slug]/community-reports/page.tsx` — report selector + render area |
| 8 | Unduplicated counts utility | `lib/community/reports.ts` — `COUNT(DISTINCT person_id)` helper for all funder-facing reports |

**Verify:** Each report renders with seeded data. Unduplicated counts are correct (same person in two programs counted once).

### 3.7 — Phase 3 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/api/community/households.test.ts` | CRUD, member management, intake permission restriction (case_manager+ only), contractor 403 |
| 2 | `tests/api/community/programs.test.ts` | CRUD, enrollment, batch attendance save, waiver enforcement (enrollment blocked until signed) |
| 3 | `tests/api/community/contributions.test.ts` | All contribution types, dimension auto-inheritance from program, grant_id nullable |
| 4 | `tests/api/community/assets.test.ts` | CRUD, dimension tagging, category filtering |
| 5 | `tests/api/community/reporting.test.ts` | Each MVP report returns correct data. Unduplicated counts (same person in 2 programs = 1). |
| 6 | `tests/components/community/households.test.ts` | Household list renders, new household dialog multi-step, detail page tabs |
| 7 | `tests/components/community/programs.test.ts` | Program cards, batch attendance grid, waiver status display |
| 8 | `tests/components/community/contributions.test.ts` | Mode-specific entry (donations tab vs time log tab), dimension selector |
| 9 | `tests/api/community/permissions-per-method.test.ts` | Every route: GET allowed for viewer roles, POST/PATCH/DELETE restricted per matrix. Board viewer can GET grants but not POST. Staff can GET+POST jobs but not intake. |

### Phase 3 — Commit boundary
Commit: households + programs + attendance + waivers + contributions + assets + reports + test files.

**Phase 3 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1 + 2 + 3 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 4: Digital Assistant — Core

**Goal:** Mobile-responsive chat, receipt OCR, AP workflow with dual accounting target, calendar sync.

**Depends on:** Phase 3 complete (entities must exist for the assistant to reference).

### 4.1 — Mobile-responsive chat

| # | Task | File |
|---|------|------|
| 1 | Make chat panel responsive | `components/chat/chat-panel.tsx` (or equivalent) — full-screen on mobile, slide-out on desktop. Camera icon for file upload on mobile. |
| 2 | Add file upload button | `components/chat/chat-input.tsx` — presigned URL upload flow: camera icon → upload to cloud storage → send URL in message |

**Verify:** Chat panel usable on mobile viewport. File upload works.

### 4.2 — Receipt OCR + confirmation

| # | Task | File |
|---|------|------|
| 1 | Create OCR service | `lib/assistant/ocr.ts` — extract date, vendor, amount, line items from image URL (via vision API or OCR service) |
| 2 | Create receipt confirmation chat tool | `lib/chat/tools/community/receipts.ts` — `receipts.process_image` tool: takes image URL → OCR → returns extracted data for confirmation |
| 3 | Create receipt confirm + execute tool | `lib/chat/tools/community/receipts.ts` — `receipts.confirm` tool: takes confirmed data → creates `receipt_confirmations` row → routes to accounting target |
| 4 | Register tools in tool registry | `lib/chat/tool-registry.ts` — add `receipts.process_image`, `receipts.confirm` |
| 5 | Add to MUTATING_TOOLS | `hooks/use-chat.ts` — add `receipts_confirm` |
| 6 | Add tool category to chat settings | `components/chat/chat-settings.tsx` — "Receipt Processing" group |
| 7 | Add tool color to message list | `components/chat/chat-message-list.tsx` |
| 8 | Update system prompt | `lib/chat/system-prompt.ts` — add receipt tools to community project context |

**Verify:** Send receipt image URL in chat → OCR extracts data → confirm → `receipt_confirmations` row created.

### 4.3 — Accounting bridge

| # | Task | File |
|---|------|------|
| 1 | Create AccountingProvider abstraction | `lib/assistant/accounting-bridge.ts` — `createBill(projectId, receiptData)` routes to built-in or QB based on `projects.accounting_target` |
| 2 | Implement GoodRev Accounting target | Same file — calls `POST /api/accounting/bills` with mapped account/class |
| 3 | Create QuickBooks integration module | `lib/assistant/quickbooks.ts` — QB OAuth helper, `createQBBill()`, receipt image attachment |
| 4 | Add QB OAuth routes | `app/api/integrations/quickbooks/connect/route.ts`, `callback/route.ts` |
| 5 | Update receipt confirm tool | `lib/chat/tools/community/receipts.ts` — after creating `receipt_confirmations`, call `accounting-bridge.createBill()` |
| 6 | Handle failures | Update `receipt_confirmations.status` to `failed` with `error_message` if bill creation fails. QB: retry 3x per §8.5. |

**Verify:** GoodRev target: receipt confirm → bill appears in Accounting → Bills. QB target: receipt confirm → bill created in QB (mock/sandbox). Failure: status = failed, error shown.

### 4.4 — Calendar sync

| # | Task | File |
|---|------|------|
| 1 | Create calendar bridge | `lib/assistant/calendar-bridge.ts` — `syncProgramSession(programId, sessionDate)`, `syncJobAssignment(jobId)` |
| 2 | Hook program creation → calendar | In program POST route: if `calendar_sync_enabled`, create calendar events for scheduled sessions via `lib/calendar/google-calendar.ts` `createEvent()` |
| 3 | Hook job assignment → calendar | In job POST route: create calendar event with `desired_start` and `deadline` for contractor (if they have connected Google Calendar) |
| 4 | Create calendar sync chat tools | `lib/chat/tools/community/calendar.ts` — `calendar.sync_program`, `calendar.sync_job` |

**Verify:** Create program with schedule → events appear in Google Calendar. Assign job → event on contractor's calendar.

### 4.5 — Cloud storage for receipts

| # | Task | File |
|---|------|------|
| 1 | Create storage service | `lib/assistant/storage.ts` — presigned URL generation for upload, organized by project/date/vendor |
| 2 | Create upload API route | `app/api/projects/[slug]/community/upload/route.ts` — returns presigned URL |
| 3 | Wire into receipt flow | Receipt confirm tool moves uploaded image to organized folder path |

**Verify:** Upload receipt image → stored in cloud → URL saved on `receipt_confirmations.image_url`.

### 4.6 — Phase 4 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/assistant/ocr.test.ts` | OCR extraction from mock receipt image — date, vendor, amount, line items parsed correctly |
| 2 | `tests/assistant/accounting-bridge.test.ts` | Route to GoodRev vs QB based on project setting. GoodRev target creates bill via internal API. QB target calls QB API. Failure → status=failed + error message. |
| 3 | `tests/assistant/calendar-bridge.test.ts` | Program session → calendar event. Job assignment → calendar event. Sync failure → logged, badge shown. |
| 4 | `tests/assistant/receipt-confirmation.test.ts` | Full flow: OCR → draft → confirm → execute. Status transitions: draft → confirmed → executed. Failed execution → status=failed. |
| 5 | `tests/assistant/storage.test.ts` | Upload to cloud storage returns URL. URL saved on receipt_confirmations record. |
| 6 | `tests/components/community/chat-mobile.test.ts` | Chat panel renders at mobile viewport. File upload button present. |

### Phase 4 — Commit boundary
Commit: mobile chat + OCR + accounting bridge + calendar sync + cloud storage + test files.

**Phase 4 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1–4 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 5: Contractor & Job Management

**Goal:** Full contractor lifecycle: onboarding, scope, jobs, time tracking, contractor portal.

**Depends on:** Phase 4 complete (assistant tools used for onboarding workflow).

### 5.1 — Contractor onboarding

| # | Task | File |
|---|------|------|
| 1 | Create contractor scope API | `app/api/projects/[slug]/contractor-scopes/route.ts` — GET, POST. `app/api/projects/[slug]/contractor-scopes/[id]/route.ts` — GET, PATCH, DELETE. |
| 2 | Create scope generation chat tool | `lib/chat/tools/community/contractors.ts` — `contractors.create_scope` tool: takes description → AI-generates scope of work document → returns draft for review |
| 3 | Create document send chat tool | Same file — `contractors.send_documents` tool: takes contractor person_id + document checklist → creates contract documents from templates (W9, waiver, photo release, scope) → sends for signature via e-signature module |
| 4 | Create onboarding orchestration tool | Same file — `contractors.onboard` tool: orchestrates the full "Set up X as a contractor" multi-step flow |
| 5 | Register all tools | `lib/chat/tool-registry.ts`, `hooks/use-chat.ts` (MUTATING_TOOLS), `components/chat/chat-settings.tsx`, `lib/chat/system-prompt.ts` |
| 6 | Create contractor directory page | `app/(dashboard)/projects/[slug]/contractors/page.tsx` + `contractors-page-client.tsx` — list with doc status, active jobs, hours |
| 7 | Create contractor detail page | `app/(dashboard)/projects/[slug]/contractors/[id]/page.tsx` + `contractor-detail-client.tsx` — scope docs, job history, time log, document status |

**Verify:** "Set up John Smith as a contractor" in chat → scope generated → docs sent → signed → contractor onboarded with Contractor role.

### 5.2 — Job management

| # | Task | File |
|---|------|------|
| 1 | Create job list + create API | `app/api/projects/[slug]/jobs/route.ts` — GET (filterable by contractor, status), POST. Scope matching validation. Emit `job.assigned`. |
| 2 | Create job detail + update + delete API | `app/api/projects/[slug]/jobs/[id]/route.ts` |
| 3 | Create job action APIs | `app/api/projects/[slug]/jobs/[id]/accept/route.ts`, `decline/route.ts`, `complete/route.ts`, `pull/route.ts` — each emits automation event |
| 4 | Create time entry API | `app/api/projects/[slug]/jobs/[id]/time-entries/route.ts` — GET, POST, PATCH (start/pause/stop) |
| 5 | Create job assignment chat tools | `lib/chat/tools/community/jobs.ts` — `jobs.assign`, `jobs.pull`, `jobs.list_for_contractor` |
| 6 | Create contractor-facing chat tools | Same file — `jobs.my_jobs`, `jobs.my_calendar`, `jobs.work_plan` (AI-generated prioritized plan) |
| 7 | Create job list page | `app/(dashboard)/projects/[slug]/jobs/page.tsx` + `jobs-page-client.tsx` |
| 8 | Create job detail page | `app/(dashboard)/projects/[slug]/jobs/[id]/page.tsx` + `job-detail-client.tsx` — status, time entries, notes |

**Verify:** Assign job → contractor notified → accept → start clock → complete → non-profit user notified. Out-of-scope: "Go Cowboy Mode" logs `is_out_of_scope = true`.

### 5.3 — Time tracking UI

| # | Task | File |
|---|------|------|
| 1 | Create time tracker component | `components/community/jobs/time-tracker.tsx` — Start/Pause/Stop/Complete buttons with live clock display |
| 2 | Wire into job detail | Job detail page shows time tracker for active jobs |
| 3 | Safety rail: clock-running alert | `lib/community/job-alerts.ts` — check for time entries with `ended_at IS NULL` and `started_at` > X hours ago. Surface via assistant notification. |
| 4 | Safety rail: inaction warning | Same file — jobs with status `accepted` and no time entries after X days. Emit `job.inaction_warning` automation event. |

**Verify:** Start → pause → resume → complete. Clock-running alert fires after threshold.

### 5.4 — Contractor portal (restricted view)

| # | Task | File |
|---|------|------|
| 1 | Create contractor layout | `app/(dashboard)/contractor/layout.tsx` — minimal layout: no sidebar, just header with profile link |
| 2 | Create contractor job list | `app/(dashboard)/contractor/page.tsx` — active + completed jobs, time tracker per job |
| 3 | Create contractor profile | `app/(dashboard)/contractor/profile/page.tsx` — scope documents, Google Calendar connect button, personal info |
| 4 | Route contractor role to contractor layout | `app/(dashboard)/projects/[slug]/layout.tsx` — if role is `contractor`, redirect to contractor view |
| 5 | Create contractor invitation flow | Invitation creation lives in `app/api/projects/[slug]/members/route.ts` (POST), **not** `invitations/route.ts` (which is GET-only listing). The POST handler must branch on `project_type`: standard projects validate with `inviteMemberSchema` (admin/member/viewer only), community projects validate with `inviteCommunityMemberSchema` (also allows staff/case_manager/contractor/board_viewer) — both created in Phase 1.3 task #7. This prevents community roles from leaking into standard CRM projects. Add magic link support for contractors: contractor receives email/SMS with a one-time link that creates their account and assigns the Contractor role on this project. |

**Verify:** Contractor logs in → sees only their jobs + profile. Cannot access `/households`, `/programs`, etc. (403 + redirect).

### 5.5 — Notifications

| # | Task | File |
|---|------|------|
| 1 | Job request notification | When job created → notify contractor (in-app + email/SMS) |
| 2 | Job completion notification | When job completed → notify assigning user |
| 3 | Job decline notification | When declined → notify assigning user with reason |
| 4 | Inaction/deadline warnings | Cron or time-trigger automation → notify contractor + optionally user |

**Verify:** Each notification fires at the right trigger. Contractor sees in-app notifications.

### 5.6 — Phase 5 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/api/community/contractor-scopes.test.ts` | Scope CRUD, service_categories/certifications arrays, document_url |
| 2 | `tests/api/community/jobs.test.ts` | Job CRUD, accept/decline/complete/pull flows, scope compliance check (in-scope vs out-of-scope), `is_out_of_scope` flag on cowboy mode |
| 3 | `tests/api/community/time-entries.test.ts` | Start/pause/stop, duration computation, clock-running detection (no ended_at), break tracking |
| 4 | `tests/assistant/contractor-onboarding.test.ts` | Chat flow: "Set up X as contractor" → scope generated → docs sent → signed status updated |
| 5 | `tests/assistant/job-assignment.test.ts` | Chat flow: "Assign job to X" → scope check → notify contractor → accept/decline |
| 6 | `tests/api/community/contractor-portal.test.ts` | Contractor role: sees own jobs + unassigned in-scope, cannot access households/programs/etc (403), profile-only settings |
| 7 | `tests/components/community/contractors.test.ts` | Contractor directory renders, scope editor, job list, time tracker UI |
| 8 | `tests/api/community/contractor-notifications.test.ts` | Job request notification, inaction warning, deadline warning, completion notification |

### Phase 5 — Commit boundary
Commit: contractor onboarding + jobs + time tracking + contractor portal + notifications + test files.

**Phase 5 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1–5 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.
5. **This completes the MVP.** All five MVP phases must have three clean sweeps before migration push.

---

## Phase 6: Grant Management (V2)

**Goal:** Grant pipeline CRUD, deadline tracking, grantor outreach, AI writing support, compliance reporting.

**Depends on:** Phase 3 complete (programs + contributions must exist for grant compliance joins).

### 6.1 — Grant pipeline CRUD

| # | Task | File |
|---|------|------|
| 1 | Create grant list + create API | `app/api/projects/[slug]/grants/route.ts` — GET (filterable by status, funder), POST. Emit `grant.created`. |
| 2 | Create grant detail + update + delete API | `app/api/projects/[slug]/grants/[id]/route.ts` — status changes emit `grant.status_changed`. When status → `awarded`, auto-create linked `contribution` of type `grant`. |
| 3 | Create grant outreach API | `app/api/projects/[slug]/grants/[id]/outreach/route.ts` — GET, POST (email sequences to grantor contacts). Reuses existing sequence infrastructure. |
| 4 | Create grant pipeline page | `app/(dashboard)/projects/[slug]/grants/page.tsx` + `grants-page-client.tsx` — Kanban board: Researching → Preparing → Submitted → Under Review → Awarded/Declined |
| 5 | Create new grant dialog | `components/community/grants/new-grant-dialog.tsx` |
| 6 | Create grant detail page | `app/(dashboard)/projects/[slug]/grants/[id]/page.tsx` + `grant-detail-client.tsx` — tabs: Info, Outreach, Compliance, Deadlines |

**Verify:** Create grant → move through pipeline → awarded → contribution auto-created with `grant_id` FK.

### 6.2 — Deadline tracking

| # | Task | File |
|---|------|------|
| 1 | Add deadline reminder time-trigger | `lib/automations/time-triggers.ts` — add `grant.deadline_approaching` trigger (configurable days before) |
| 2 | Calendar sync for grant deadlines | `lib/assistant/calendar-bridge.ts` — `syncGrantDeadline(grantId, deadlineType, date)` → creates calendar event for assigned staff |
| 3 | Create deadline dashboard widget | `components/community/grants/upcoming-deadlines.tsx` — sortable list of upcoming LOI, submission, and report deadlines |

**Verify:** Grant with deadline in 7 days → automation fires. Calendar event created for assigned staff.

### 6.3 — Grant writing support

| # | Task | File |
|---|------|------|
| 1 | Create grant writing chat tools | `lib/chat/tools/community/grants.ts` — `grants.draft_narrative` (pulls program data, attendance, impact metrics), `grants.draft_budget` (pulls actual program costs) |
| 2 | Register tools | Tool registry, MUTATING_TOOLS, chat settings, system prompt |

**Verify:** "Help me write the narrative for the XYZ grant" → assistant pulls real program data into draft.

### 6.4 — Grant compliance reporting

| # | Task | File |
|---|------|------|
| 1 | Create compliance report API | `app/api/projects/[slug]/community/reports/grant-compliance/route.ts` — per-grant: spend vs. budget, unduplicated participants, hours delivered |
| 2 | Create compliance report UI | `components/community/reports/grant-compliance.tsx` |
| 3 | Add to grants detail page | Grant detail → Compliance tab shows live metrics |

**Verify:** Grant compliance report shows correct spend, participant count (unduplicated), hours.

### 6.5 — Add to sidebar

| # | Task | File |
|---|------|------|
| 1 | Add Grants to community sidebar | `components/layout/community-sidebar.tsx` — add Grants nav item |

### 6.6 — Phase 6 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/api/community/grants.test.ts` | CRUD, status transitions (researching→preparing→submitted→awarded/declined), contribution auto-created on award with grant_id FK |
| 2 | `tests/api/community/grant-deadlines.test.ts` | Deadline approaching → automation fires. Calendar event created for assigned staff. |
| 3 | `tests/api/community/grant-outreach.test.ts` | Outreach email sequence creation, grantor contact linking |
| 4 | `tests/assistant/grant-writing.test.ts` | AI pulls real program data (attendance, contributions) into draft narrative |
| 5 | `tests/api/community/grant-compliance.test.ts` | Per-grant report: spend, unduplicated participants, hours. Board viewer can view grants but not create. |
| 6 | `tests/components/community/grants.test.ts` | Pipeline Kanban renders, grant detail page, compliance report display |

### Phase 6 — Commit boundary
Commit: grant pipeline + deadlines + outreach + writing support + compliance + test files.

**Phase 6 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1–6 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 7: Map + Visualization (V2)

**Goal:** Interactive community map with Leaflet, geocoding queue, dashboard V2 additions.

**Depends on:** Phase 3 complete (households, assets, programs with geo data).

### 7.1 — Dependencies + map component

| # | Task | File |
|---|------|------|
| 1 | Install packages | `npm install leaflet react-leaflet @types/leaflet` |
| 2 | Create map wrapper component | `components/community/map/community-map.tsx` — OpenStreetMap tiles, toggleable layers, marker clustering |
| 3 | Create layer components | `components/community/map/household-layer.tsx`, `asset-layer.tsx`, `program-layer.tsx`, `org-layer.tsx` — each with appropriate icons and colors |
| 4 | Create filter sidebar | `components/community/map/map-filters.tsx` — dimension type, category, condition, program status |
| 5 | Create marker popups | `components/community/map/marker-popup.tsx` — summary card with link to detail page |

### 7.2 — Map page + API

| # | Task | File |
|---|------|------|
| 1 | Create map data API | `app/api/projects/[slug]/community/map/route.ts` — returns all geo-tagged entities with minimal fields for markers |
| 2 | Create map page | `app/(dashboard)/projects/[slug]/community-map/page.tsx` — full-page map with filter sidebar |
| 3 | Add Community Map to sidebar | `components/layout/community-sidebar.tsx` |

### 7.3 — Geocoding queue

| # | Task | File |
|---|------|------|
| 1 | Create geocoding service | `lib/community/geocoding.ts` — Nominatim API with 1 req/sec rate limit |
| 2 | Create geocoding queue | `lib/community/geocoding-queue.ts` — process pending geocodes, update lat/lng + status |
| 3 | Create geocoding API route | `app/api/projects/[slug]/community/geocode/route.ts` — trigger batch geocoding for pending addresses |
| 4 | Hook address creation → geocode queue | Household POST, asset POST: if address provided and no lat/lng, set `geocoded_status = 'pending'` |

**Verify:** Create household with address → status `pending` → geocode job runs → lat/lng populated → marker appears on map.

### 7.4 — Dashboard V2 additions

| # | Task | File |
|---|------|------|
| 1 | Create mini-map component | `components/community/dashboard/mini-map.tsx` — small Leaflet map showing household distribution |
| 2 | Create % population widget | `components/community/dashboard/population-impact.tsx` — unduplicated people / configurable denominator |
| 3 | Add to dashboard | Wire into community dashboard page alongside MVP components |

### 7.4 — Phase 7 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/components/community/map.test.ts` | Map renders with Leaflet, layers toggle on/off, marker clustering at zoom-out, popup shows summary |
| 2 | `tests/api/community/geocoding.test.ts` | Address → lat/lng via Nominatim mock. Failed geocode → status=failed. Retry works. Rate limiting (1 req/sec). |
| 3 | `tests/components/community/dashboard-v2.test.ts` | Mini-map renders, % population metric displays |

### Phase 7 — Commit boundary
Commit: community map + geocoding + dashboard V2 additions + test files.

**Phase 7 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1–7 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 8: Enrichment Features (V2)

**Goal:** Referrals, relationships, broadcasts, facility booking.

**Depends on:** Phase 3 (core entities), Phase 7 (map).

### 8.1 — Referral management

| # | Task | File |
|---|------|------|
| 1 | Create referral CRUD APIs | `app/api/projects/[slug]/referrals/route.ts`, `[id]/route.ts` — GET, POST, PATCH, DELETE. Emit `referral.created`, `referral.completed`. |
| 2 | Create referral time-triggers | `lib/automations/time-triggers.ts` — `referral.overdue` at 7, 14, 30 days |
| 3 | Create referral list page | `app/(dashboard)/projects/[slug]/referrals/page.tsx` + client component |
| 4 | Create new referral dialog | `components/community/referrals/new-referral-dialog.tsx` — partner org selector, service type, person/household |
| 5 | Add to household detail | Household detail → Referrals tab |

### 8.2 — Relationships

| # | Task | File |
|---|------|------|
| 1 | Create relationship CRUD APIs | `app/api/projects/[slug]/relationships/route.ts`, `[id]/route.ts` |
| 2 | Create person relationships tab | `components/community/people/person-relationships-tab.tsx` — add/view/remove relationships (community projects only) |
| 3 | Create influencer identification | `lib/community/social-network.ts` — query people by relationship count, bridging connections |
| 4 | Add to person detail page | Conditionally show Relationships tab when `project_type === 'community'` |

### 8.3 — Broadcasts

| # | Task | File |
|---|------|------|
| 1 | Create broadcast CRUD + send APIs | `app/api/projects/[slug]/broadcasts/route.ts`, `[id]/route.ts`, `[id]/send/route.ts` — filter recipients, preview, send via Telnyx SMS + Gmail |
| 2 | Create broadcast compose page | `app/(dashboard)/projects/[slug]/broadcasts/page.tsx` + compose UI |
| 3 | Create recipient filter builder | `components/community/broadcasts/recipient-filter.tsx` — by program, household, custom criteria |
| 4 | Add Broadcasts to sidebar | `components/layout/community-sidebar.tsx` |

### 8.4 — Facility booking

| # | Task | File |
|---|------|------|
| 1 | Create bookable asset setup | UI to mark community asset as bookable → creates `event_type` with `asset_id` FK |
| 2 | Create asset bookings API | `app/api/projects/[slug]/community-assets/[id]/bookings/route.ts` — **new endpoint** required because the existing `/api/calendar/bookings` is host-scoped (`host_user_id = current user`, line 20) with no `event_type_id` filter. This new route queries `bookings` joined through `event_types` where `event_types.asset_id = asset.id`. Reuse existing availability-checking logic from `lib/calendar/` but the query itself must be asset-scoped, not user-scoped. |
| 3 | Create booking calendar view | `components/community/assets/asset-calendar.tsx` — **new component** (no reusable `BookingCalendar` exists in the codebase). Build a calendar view (day/week/month) that calls the new asset bookings API from task #2. Use `@fullcalendar/react` or build from scratch. Reference the existing bookings pages at `app/(dashboard)/calendar/bookings/` for UI patterns only (not data fetching — that API is host-scoped). |
| 4 | Add to asset detail page | Asset detail → Calendar tab (if bookable) |

### 8.5 — Public dashboard

**Goal:** Admin-curated, unauthenticated public view of aggregate community impact data. Entirely separate from board_viewer — this is a published artifact, not an authenticated role.

**Hard restrictions (enforced in API, not just UI):**
- Aggregate data only — no individual-level records, no drill-through
- Minimum-count thresholds on every metric (default 5, configurable per-widget, minimum floor of 3)
- Excluded categories are append-only: `minors`, `intake`, `risk_scores`, `PII` can never be removed from the exclusion list
- No authentication required to view — access via public slug or share link token
- All queries run through a dedicated aggregate query layer, never raw table access

| # | Task | File |
|---|------|------|
| 1 | Create public dashboard admin page | `app/(dashboard)/projects/[slug]/settings/public-dashboard/page.tsx` — accessible from community project Settings. Shows list of dashboard configs (draft/preview/published/archived). Create/edit/archive actions. Only `owner` and `admin` roles can access (guarded by `requireCommunityPermission(..., 'public_dashboard', 'manage')`). |
| 2 | Create dashboard config editor | `components/community/public-dashboard/config-editor.tsx` — title, description, slug, theme (colors, logo), hero image. Widget builder: add/remove/reorder widgets. Each widget has type (metric_card, bar_chart, radar_chart, map_heatmap, program_summary, contribution_summary, text_block), title, dimension_filter, date_range, min_count_threshold. Preview button (renders draft inline). |
| 3 | Create widget configuration components | `components/community/public-dashboard/widgets/` — `widget-config-metric.tsx`, `widget-config-chart.tsx`, `widget-config-map.tsx`, `widget-config-text.tsx`. Each renders config form for its widget type. Shared `widget-config-wrapper.tsx` with delete/reorder handles. |
| 4 | Create share link management UI | `components/community/public-dashboard/share-links.tsx` — create link (optional expiry, label), copy URL, toggle active/inactive, delete. Shows access count and last accessed. |
| 5 | Create publish/unpublish flow | `components/community/public-dashboard/publish-controls.tsx` — draft → preview (accessible only via admin link) → published (accessible via public slug and share links) → archived (no longer accessible). Confirmation dialog on publish with reminder of what will be visible. |
| 6 | Create dashboard config API | `app/api/projects/[slug]/public-dashboard/route.ts` — GET (list configs), POST (create config). Guards: `requireCommunityPermission(... 'public_dashboard', 'manage')` — owner/admin only. |
| 7 | Create dashboard config detail API | `app/api/projects/[slug]/public-dashboard/[id]/route.ts` — GET, PATCH, DELETE. Same permission guard. PATCH validates `excluded_categories` append-only constraint. |
| 8 | Create share link API | `app/api/projects/[slug]/public-dashboard/[id]/share-links/route.ts` — GET (list), POST (create with crypto token). DELETE for individual links. |
| 9 | Create aggregate query layer | `lib/community/public-dashboard-queries.ts` — dedicated module that produces **only** aggregate results. Functions: `getAggregateMetrics(projectId, widgetConfig)`, `getContributionSummary(projectId, filters)`, `getProgramSummary(projectId, filters)`, `getDimensionBreakdown(projectId, filters)`. Every function applies min-count threshold suppression: if a group has fewer than `min_count_threshold` records, it is excluded from results (not collapsed into "Other" — completely omitted). All queries use the admin service client (public route has no auth context). |
| 10 | Create public rendering route (unauthenticated) | `app/public/[project-slug]/[dashboard-slug]/page.tsx` — **outside** the `(dashboard)` layout, no auth required. Looks up the project by `project-slug`, then fetches config by `(project_id, dashboard-slug)` where `status IN ('published')`. If `access_type = 'password'`, renders a password prompt first; verifies against `password_hash` (bcrypt) before showing data. Renders widgets using aggregate query layer. Static metadata for SEO (title, description, hero image). Preview state (`status = 'preview'`) is accessible only when the request includes a valid admin session cookie — unauthenticated requests to preview configs return 404. |
| 11 | Create share link access route | `app/public/link/[token]/page.tsx` — validates token against `public_dashboard_share_links` (active, not expired). Increments `access_count`, updates `last_accessed_at`. Resolves the linked config and renders the same dashboard view. Returns 404 for invalid/expired/inactive tokens. Share links bypass `access_type` checks (the token itself is the access control). |
| 12 | Create public widget rendering components | `components/community/public-dashboard/public-widgets/` — `public-metric-card.tsx`, `public-bar-chart.tsx`, `public-radar-chart.tsx`, `public-program-summary.tsx`, `public-contribution-summary.tsx`, `public-text-block.tsx`. Read-only, no interactivity, no drill-through links. Responsive (mobile-friendly). |
| 13 | ∥ Create map heatmap widget (optional, if Phase 8 map is complete) | `components/community/public-dashboard/public-widgets/public-map-heatmap.tsx` — aggregate density heatmap of community activity. No individual markers — only heat intensity by area. Uses same Leaflet setup from Phase 8 map. |
| 14 | Add RLS policies for public dashboard tables | `public_dashboard_configs`: owner/admin can CRUD; no public RLS needed (public route uses service client). `public_dashboard_share_links`: same owner/admin guard. The public rendering routes bypass RLS via admin service client — the aggregate query layer is the access control boundary. |
| 15 | Add to community sidebar | `components/layout/community-sidebar.tsx` — "Public Dashboard" under Settings section (V2 nav). Only visible to owner/admin. |

**Verify:** Create a dashboard config → add widgets → preview accessible only with admin session → publish → access via `/public/{project-slug}/{dashboard-slug}` without authentication → min-count threshold suppresses small groups → share link works via `/public/link/{token}` → expired link returns 404 → archived dashboard returns 404 → password-protected dashboard shows prompt → board_viewer cannot access admin config page → two projects with same dashboard slug resolve independently → `npm run typecheck` passes.

### 8.7 — Phase 8 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/api/community/referrals.test.ts` | CRUD, status transitions, partner org linking, overdue detection |
| 2 | `tests/api/community/relationships.test.ts` | CRUD, uniqueness constraint, type enum, influencer identification (highest connection count) |
| 4 | `tests/api/community/broadcasts.test.ts` | Compose, filter recipients, send via mock Telnyx/Gmail, per-recipient delivery status |
| 5 | `tests/api/community/facility-booking.test.ts` | Asset bookings API (asset-scoped, not host-scoped), conflict detection, availability rules |
| 6 | `tests/api/community/public-dashboard.test.ts` | Config CRUD (owner/admin only), widget save/load, publish flow (draft→preview→published→archived) |
| 7 | `tests/api/community/public-dashboard-render.test.ts` | Public route `/public/{project-slug}/{dashboard-slug}` renders without auth, two projects with same dashboard slug resolve independently, password-protected dashboard requires correct password, preview state requires admin session (unauthed → 404), min-count threshold suppresses small groups, excluded categories enforced, share link `/public/link/{token}` bypasses password, expired link returns 404, archived returns 404 |
| 8 | `tests/api/community/public-dashboard-aggregate.test.ts` | Aggregate query layer: no individual records returned, dimension breakdown correct, contribution totals correct |
| 9 | `tests/components/community/referrals.test.ts` | Referral list, new referral dialog, status badges |
| 10 | `tests/components/community/public-dashboard.test.ts` | Config editor renders, widget builder, share link management, public widget rendering |

### Phase 8 — Commit boundary
Commit: referrals + relationships + broadcasts + facility booking + public dashboard + test files.

**Phase 8 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — all Phase 1–8 tests must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.

---

## Phase 9: Integrations (V2)

**Goal:** MCP tools, chat tools, and automation events for all community entities.

**Depends on:** All entity phases complete.

### 9.1 — MCP tools

| # | Task | File |
|---|------|------|
| 1 | Create community MCP tools | `lib/mcp/tools/community.ts` — households (list, get, create, update), programs (list, get, create, update, enroll, attendance), contributions (list, get, create), assets (list, get, create, update) |
| 2 | Create grants MCP tools | `lib/mcp/tools/grants.ts` — list, get, create, update, compliance_report |
| 3 | Create contractors MCP tools | `lib/mcp/tools/contractors.ts` — list_contractors, get_scope, list_jobs, create_job, update_job_status, time_entries |
| 4 | Register all in MCP server | `lib/mcp/server.ts` — `registerCommunityTools()`, `registerGrantTools()`, `registerContractorTools()` |
| 5 | RBAC enforcement | Every tool uses `checkCommunityPermission(ctx.role, resource, action)` instead of `checkPermission(ctx.role, minRole)` |

### 9.2 — Chat agent tools

| # | Task | File |
|---|------|------|
| 1 | Register all community chat tools | `lib/chat/tool-registry.ts` — add `defineTool()` entries for all community CRUD operations |
| 2 | Update MUTATING_TOOLS | `hooks/use-chat.ts` — add all write operations |
| 3 | Add tool categories | `components/chat/chat-settings.tsx` — Households, Programs, Contributions, Assets, Grants, Contractors, Jobs, Referrals, Broadcasts |
| 4 | Add tool colors | `components/chat/chat-message-list.tsx` — color mapping for community tool categories |
| 5 | Update system prompt | `lib/chat/system-prompt.ts` — add community tool categories + usage guidance |

### 9.3 — Automation events

| # | Task | File |
|---|------|------|
| 1 | Register community entity types | `types/automation.ts` — add entity types: household, program, contribution, asset, grant, job, contractor_scope, referral, broadcast |
| 2 | Register community trigger types | Same file — `household.created`, `household.member_added`, `contribution.created`, `program.enrollment.created`, `program.attendance.batch`, `grant.status_changed`, `grant.deadline_approaching`, `job.assigned`, `job.accepted`, `job.declined`, `job.completed`, `job.inaction_warning`, `contractor.onboarded`, `contractor.documents_signed`, `referral.created`, `referral.overdue`, `referral.completed`, `broadcast.sent` |
| 3 | Add trigger matching | `lib/automations/engine.ts` — extend `matchesTriggerConfig()` for new entity/trigger types |
| 4 | Add community actions | `lib/automations/actions.ts` — any new action types needed for community workflows |
| 5 | Add community time-triggers | `lib/automations/time-triggers.ts` — `referral.overdue`, `grant.deadline_approaching`, `job.inaction_warning` |

### 9.4 — Verification sweep

| # | Task |
|---|------|
| 1 | Run full test suite — zero regressions in existing sales tests |
| 2 | Create standard CRM project + community project in same org — both fully functional |
| 3 | `npm run typecheck` passes |
| 4 | RLS tests pass for all roles across all tables |
| 5 | MCP tools respond correctly for each role |
| 6 | Chat tools work for each role (contractor sees only their tools) |

### 9.5 — Phase 9 tests

| # | Test file | Covers |
|---|-----------|--------|
| 1 | `tests/mcp/community-tools.test.ts` | MCP tools: households, programs, contributions, assets — CRUD operations, RBAC enforcement per role |
| 2 | `tests/mcp/grants-tools.test.ts` | MCP tools: grant CRUD, compliance report |
| 3 | `tests/mcp/contractors-tools.test.ts` | MCP tools: contractor list, scope, jobs, time entries — contractor role sees only own data |
| 4 | `tests/chat/community-tools.test.ts` | Chat agent tools registered, MUTATING_TOOLS updated, contractor-scoped tools restricted |
| 5 | `tests/automations/community-events.test.ts` | Each automation event fires on the correct mutation (household.created, program.enrollment.created, job.completed, etc.) |

### Phase 9 — Commit boundary
Commit: MCP tools + chat tools + automation events + test files.

**Phase 9 completion protocol:**
1. Run `npm run typecheck` — must pass with zero errors
2. Run `npx vitest run --reporter=verbose` — **ALL tests across all 9 phases** must pass
3. This is **sweep 1**. Fix any failures, then repeat for sweep 2, then sweep 3.
4. Phase is complete only after **three successive clean sweeps** with zero errors.
5. **This completes the V2 build.** Full regression across all phases required.

---

## Cross-Cutting: After Every Phase

1. `npm run typecheck` — zero new errors
2. Existing sales project tests pass (non-regression)
3. Community RLS tests pass
4. Standard CRM project still works identically
