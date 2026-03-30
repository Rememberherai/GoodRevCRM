# Community Operations Expansion Plan — v4

**Date:** 2026-03-29
**Version:** 4 (implementation-ready)
**Status:** Ready for implementation
**Migration number:** 0179
**Scope:** Case management / service plans + Incident / safety / conflict logging

---

## 1. Goal

Fill the two highest-value operational gaps for community nonprofits:

1. **Case management** — turn households into managed case files with service plans, follow-up tracking, and a unified timeline
2. **Incident logging** — structured safety/conflict/facility reporting with ownership, severity, and auditable follow-up

Guiding constraint: reuse existing household, referral, task, workflow, notes, and reporting infrastructure. Add new schema only where the existing model cannot cleanly represent the workflow.

---

## 2. Cross-Cutting Design Decisions

### 2.1 Cases extend households — no separate system

The household remains the primary unit. A case is an operational layer on top of a household. One active case per household at a time (enforced by partial unique index).

### 2.2 Reuse notes for user-authored timeline entries

Extend the existing `notes` table with `household_id`, `case_id`, and `incident_id` nullable FKs + use `category` (already present from event-notes pattern in migration 0149). No new timeline/comments tables.

### 2.3 Add append-only case lifecycle events

Do not reuse `activity_log` for case timeline events in v1. Its current RLS is project-wide and would leak sensitive case activity.

Create a dedicated `household_case_events` table for system-generated milestones like opened, reassigned, follow-up scheduled, status changed, and closed.

This is not a second notes system. It is an append-only event log so the household timeline has a concrete source for `case_event` rows.

### 2.4 Extend tasks — no second task model

Add `household_id`, `case_id`, and `incident_id` nullable FKs to the existing `tasks` table.

### 2.5 Association rule for notes and tasks

`case_id` and `incident_id` are mutually exclusive on the same `notes` or `tasks` row.

`household_id` may coexist with either one for filtering and timeline assembly.

This avoids ambiguous security rules like "a note linked to both a case and an incident" and keeps visibility inheritance deterministic.

### 2.6 Automation events — not bespoke cron

New case and incident lifecycle changes emit automation events via `emitAutomationEvent()`. Time-based triggers (follow-up due, no-contact window) go into `lib/automations/time-triggers.ts`.

### 2.7 Permission boundary

Cases follow `intake` permissions (case_manager+ access). Incidents allow staff to create/view/update but restrict private incidents to case_manager+. Board viewers and contractors get no access to either.

### 2.8 Incident visibility is row-level

Incident access cannot be expressed by resource permission alone because `visibility` changes who may see the row.

Required behavior:

- `operations` incidents: any user with `incidents:view`
- `case_management` incidents: only users with `cases:view`
- `private` incidents: only users with `cases:view`

Required create/update rule:

- staff may create and update only `visibility = 'operations'`
- owner/admin/case_manager may create and update all visibility levels

UI implication:

- if the current user lacks `cases:create` / `cases:update`, hide the visibility selector and force `operations`

### 2.9 `dimension_id` on case goals

References `impact_dimensions` (defined in migration 0133). Allows service plan goals to be tagged to an impact framework dimension (e.g., "Housing", "Employment", "Health"). Nullable — not every goal maps to a dimension.

### 2.10 Navigation rule: no new primary sidebar items in first merge

Do not add new top-level community sidebar items for Cases or Incidents in the first implementation.

Use:

- a secondary route under Households for the case queue
- household detail tabs for daily case work
- dashboard shortcuts, notifications, and embedded "Report Incident" buttons for incident access

If usage later proves high-volume, promote one or both to primary nav in a follow-up.

---

## 3. Migration: `0179_case_management_incidents.sql`

This migration must do eight things, in this order:

1. extend `community_has_permission(...)` to understand `cases` and `incidents`
2. add helper access functions for case rows and incident rows
3. create `household_cases`, `household_case_goals`, and `household_case_events`
4. create `incidents` and `incident_people`
5. extend `tasks` and `notes` with case/incident links
6. replace `tasks` and `notes` RLS with sensitivity-aware policies
7. add RLS for the new tables using the helper functions, not duplicated ad hoc logic
8. add service-role bypass policies for every new table, matching the pattern used in migrations `0149` and `0163`

### 3.1 Update `community_has_permission(...)`

Do not ship the new tables before the SQL permission function is updated.

The migration must append:

- `cases`
- `incidents`

to the SQL function in the same way `events` and `asset_access` were added in later community migrations.

Required matrix in SQL:

- owner/admin: `cases` + `incidents` -> `view/create/update/delete`
- case_manager: `cases` + `incidents` -> `view/create/update/delete`
- staff: `incidents` -> `view/create/update`; `cases` -> none
- everyone else: none

### 3.2 Add helper access functions

Add two SQL helpers in the same migration:

- `public.community_can_access_case(p_case_id UUID, p_action TEXT)`
- `public.community_can_access_incident(p_incident_id UUID, p_action TEXT)`

Required behavior:

- case helper resolves the parent `project_id` from `household_cases` and delegates to `community_has_permission(project_id, 'cases', p_action)`
- incident helper resolves `project_id` and `visibility` from `incidents`
- `operations` incidents delegate to `community_has_permission(project_id, 'incidents', p_action)`
- `case_management` and `private` incidents delegate to `community_has_permission(project_id, 'cases', p_action)`

These helpers must be reused by policies on:

- `household_case_goals`
- `household_case_events`
- `incidents`
- `incident_people`
- `notes`
- `tasks`

Do not duplicate the visibility CASE expression across multiple policies.

### 3.3 Create `household_cases`

```sql
CREATE TABLE IF NOT EXISTS public.household_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'active', 'on_hold', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  summary TEXT,
  barriers TEXT,
  strengths TEXT,
  consent_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_cases_one_active
  ON public.household_cases(household_id)
  WHERE status <> 'closed';
```

Important correction:

- `created_by` must be nullable if the FK uses `ON DELETE SET NULL`

RLS must use `public.community_has_permission(project_id, 'cases', ...)`, not raw project membership checks.

### 3.4 Create `household_case_goals`

```sql
CREATE TABLE IF NOT EXISTS public.household_case_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.household_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dimension_id UUID REFERENCES public.impact_dimensions(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS must resolve access through `public.community_can_access_case(case_id, ...)`, not a duplicated join in every policy.

### 3.5 Create `household_case_events`

```sql
CREATE TABLE IF NOT EXISTS public.household_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.household_cases(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('opened', 'assigned', 'status_changed', 'follow_up_scheduled', 'contact_logged', 'goal_completed', 'closed', 'reopened')),
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Rules:

- append-only in application code
- no user-authored rich text here; use `notes` for narrative
- write one row for every case lifecycle mutation that should appear in the household timeline

RLS must use `public.community_can_access_case(case_id, 'view')` for reads and `public.community_can_access_case(case_id, 'update')` for inserts.

### 3.6 Create `incidents` and `incident_people`

```sql
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('behavior', 'facility', 'injury', 'safety', 'conflict', 'theft', 'medical', 'other')),
  visibility TEXT NOT NULL DEFAULT 'operations'
    CHECK (visibility IN ('private', 'case_management', 'operations')),
  summary TEXT NOT NULL,
  details TEXT,
  resolution_notes TEXT,
  follow_up_due_at TIMESTAMPTZ,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.community_assets(id) ON DELETE SET NULL,
  location_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incident_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'other'
    CHECK (role IN ('subject', 'reporter', 'witness', 'guardian_notified', 'staff_present', 'victim', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT incident_people_unique UNIQUE (incident_id, person_id, role)
);
```

Important correction:

- `reported_by` must also be nullable if the FK uses `ON DELETE SET NULL`

RLS must use `public.community_can_access_incident(id, ...)` on `incidents` and `public.community_can_access_incident(incident_id, ...)` on `incident_people`, not raw project membership and not plain `incidents:*` resource checks.

### 3.7 Extend `tasks` and `notes`

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.household_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.household_cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE;
```

### 3.8 Replace `tasks` and `notes` RLS

This is mandatory. The existing policies are project-wide and would leak case/incident-linked rows to roles that should not see them.

Do not rely on route-level guards alone.

Required rule for both tables:

- rows with `case_id IS NOT NULL` require `community_can_access_case(case_id, ...)`
- rows with `incident_id IS NOT NULL` require `community_can_access_incident(incident_id, ...)`
- rows with neither continue to use the existing project-wide behavior

Also require a `CHECK` constraint so the row cannot point at both a case and an incident:

```sql
CHECK (NOT (case_id IS NOT NULL AND incident_id IS NOT NULL))
```

Required shape for `SELECT` policy:

```sql
(
  case_id IS NULL
  AND incident_id IS NULL
  AND project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid())
)
OR (
  case_id IS NOT NULL
  AND public.community_can_access_case(case_id, 'view')
)
OR (
  incident_id IS NOT NULL
  AND public.community_can_access_incident(incident_id, 'view')
)
```

Apply the same split for `INSERT`, `UPDATE`, and `DELETE`.

### 3.9 Notes and tasks route implications

Because `notes` and `tasks` become sensitivity-aware, the implementation must also update:

- `lib/validators/note.ts`
- `lib/validators/task.ts`
- the generic notes/tasks API query filters

so the application can correctly create and filter `case_id`, `incident_id`, and `household_id` records.

---

## 4. Permissions

### 4.1 New community resources

Add `cases` and `incidents` to `CommunityResource` in `lib/projects/community-permissions.ts`.

### 4.2 Permission matrix

| Role | `cases` | `incidents` |
|------|---------|-------------|
| owner | view, create, update, delete | view, create, update, delete |
| admin | view, create, update, delete | view, create, update, delete |
| case_manager | view, create, update, delete | view, create, update, delete |
| staff | NO_ACTIONS | view, create, update |
| contractor | NO_ACTIONS | NO_ACTIONS |
| board_viewer | NO_ACTIONS | NO_ACTIONS |
| member | NO_ACTIONS | NO_ACTIONS |
| viewer | NO_ACTIONS | NO_ACTIONS |

Staff cannot see cases (same boundary as `intake`). Staff **can** create and update incidents (they need to report what they see) but cannot delete them.

### 4.3 Incident visibility enforcement

Do not treat incident visibility as a frontend-only filter.

Required behavior:

- `operations` incidents are visible to users who pass `incidents:view`
- `case_management` incidents are visible only to users who pass `cases:view`
- `private` incidents are visible only to users who pass `cases:view`

This same rule must be inherited by:

- `incident_people`
- `notes` rows where `incident_id IS NOT NULL`
- `tasks` rows where `incident_id IS NOT NULL`

### 4.4 Role-sensitive form behavior

The incident create/edit UI must match the backend rule:

- owner/admin/case_manager can choose `operations`, `case_management`, or `private`
- staff can only submit `operations`

The API must enforce this even if a caller bypasses the UI.

### 4.5 Keep TS and SQL permission systems in lockstep

Every permission change must be made in both places:

- `lib/projects/community-permissions.ts`
- `public.community_has_permission(...)` in migration `0179`

The implementation is not complete until both matrices match.

---

## 5. Automation Events

### 5.1 New TriggerType values

Add to `types/automation.ts`:

```typescript
// Case events
| 'case.created'
| 'case.status_changed'
| 'case.assigned'
| 'case.follow_up_due'
| 'case.goal_completed'
| 'case.no_contact'
// Incident events
| 'incident.created'
| 'incident.severity_changed'
| 'incident.follow_up_due'
| 'incident.resolved'
```

### 5.2 Time-based triggers

Add to `lib/automations/time-triggers.ts`:

- **`case.follow_up_due`** — fires when `household_cases.next_follow_up_at <= NOW()` and status not closed
- **`case.no_contact`** — fires when `household_cases.last_contact_at` is older than configurable threshold (default 14 days) and status is `active`
- **`incident.follow_up_due`** — fires when `incidents.follow_up_due_at <= NOW()` and status not resolved/closed

### 5.3 Built-in workflow templates

Add to community workflow template seeding:

1. **New case assigned** → create task "Initial contact" due in 3 days, notify assigned case manager
2. **Case follow-up overdue** → notify assigned case manager + escalate to admin after 2 additional days
3. **Case goal completed** → notify case manager, suggest closing case if all goals completed
4. **High-severity incident** → create urgent task, notify all admins
5. **Incident open 3+ days** → escalate to admin
6. **Incident linked to event** → notify event owner

---

## 6. API Routes

### 6.1 Case management

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/projects/[slug]/households/cases` | cases:view |
| POST | `/api/projects/[slug]/households/cases` | cases:create |
| GET | `/api/projects/[slug]/households/cases/[id]` | cases:view |
| PATCH | `/api/projects/[slug]/households/cases/[id]` | cases:update |
| DELETE | `/api/projects/[slug]/households/cases/[id]` | cases:delete |
| GET | `/api/projects/[slug]/households/cases/[id]/goals` | cases:view |
| POST | `/api/projects/[slug]/households/cases/[id]/goals` | cases:create |
| PATCH | `/api/projects/[slug]/households/cases/[id]/goals/[goalId]` | cases:update |
| DELETE | `/api/projects/[slug]/households/cases/[id]/goals/[goalId]` | cases:delete |
| GET | `/api/projects/[slug]/households/cases/[id]/notes` | cases:view |
| POST | `/api/projects/[slug]/households/cases/[id]/notes` | cases:create |
| GET | `/api/projects/[slug]/households/[id]/timeline` | cases:view |

**Timeline endpoint spec:**

`GET /api/projects/[slug]/households/[id]/timeline`

Query params:
- `cursor` — ISO timestamp for keyset pagination (default: now)
- `limit` — max items per page (default 50, max 200)
- `types` — comma-separated filter: `intake`, `referral`, `note`, `task`, `case_event`, `incident` (default: all)

Response shape:
```typescript
{
  items: Array<{
    id: string;
    type: 'intake' | 'referral' | 'note' | 'task' | 'case_event' | 'incident';
    timestamp: string; // ISO — sort key
    summary: string;   // human-readable one-liner
    actor: { id: string; name: string } | null;
    metadata: Record<string, unknown>; // type-specific payload
  }>;
  next_cursor: string | null;
}
```

Assembly: server-side UNION query across `household_intake`, `referrals`, `notes`, `tasks`, `household_case_events`, and `incidents` (all where `household_id` matches), sorted by timestamp DESC. Paginated via keyset on timestamp.

Concrete sources for each timeline item type:

- `intake` -> `household_intake`
- `referral` -> `referrals`
- `note` -> `notes`
- `task` -> `tasks`
- `case_event` -> `household_case_events`
- `incident` -> `incidents`

Do not source `case_event` rows from `activity_log` in v1.

### 6.2 Incident logging

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/projects/[slug]/incidents` | incidents:view |
| POST | `/api/projects/[slug]/incidents` | incidents:create |
| GET | `/api/projects/[slug]/incidents/[id]` | incidents:view |
| PATCH | `/api/projects/[slug]/incidents/[id]` | incidents:update |
| DELETE | `/api/projects/[slug]/incidents/[id]` | incidents:delete |
| GET | `/api/projects/[slug]/incidents/[id]/people` | incidents:view |
| POST | `/api/projects/[slug]/incidents/[id]/people` | incidents:create |
| PATCH | `/api/projects/[slug]/incidents/[id]/people/[linkId]` | incidents:update |
| DELETE | `/api/projects/[slug]/incidents/[id]/people/[linkId]` | incidents:delete |
| GET | `/api/projects/[slug]/incidents/[id]/notes` | incidents:view |
| POST | `/api/projects/[slug]/incidents/[id]/notes` | incidents:create |

Route note:

- `incidents:*` route permission is only the coarse gate
- final row visibility must still come from incident RLS and `community_can_access_incident(...)`
- create/update handlers must reject or coerce invalid `visibility` values based on the caller's role

### 6.3 Generic tasks and notes routes must be extended

Update the existing generic routes so case and incident UIs do not need bespoke task plumbing:

- `app/api/projects/[slug]/tasks/route.ts`
- `app/api/projects/[slug]/notes/route.ts`

Add support for:

- `household_id`
- `case_id`
- `incident_id`

Recommended rule:

- generic list endpoints may accept these filters
- case/incident detail pages should still use entity-specific routes for note creation
- sensitive rows should rely on RLS as the final guard

### 6.4 Automation event emission

Every mutating route must call `emitAutomationEvent()` fire-and-forget:

- `POST /households/cases` → `case.created`
- `PATCH /households/cases/[id]` (status change) → `case.status_changed`
- `PATCH /households/cases/[id]` (assigned_to change) → `case.assigned`
- `PATCH /households/cases/[id]/goals/[goalId]` (status → completed) → `case.goal_completed`
- `POST /incidents` → `incident.created`
- `PATCH /incidents/[id]` (severity change) → `incident.severity_changed`
- `PATCH /incidents/[id]` (status → resolved) → `incident.resolved`

---

## 7. Validators

### 7.1 `lib/validators/case.ts`

```typescript
import { z } from 'zod';

export const createCaseSchema = z.object({
  household_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  summary: z.string().max(5000).optional(),
  barriers: z.string().max(5000).optional(),
  strengths: z.string().max(5000).optional(),
  consent_notes: z.string().max(5000).optional(),
  next_follow_up_at: z.string().datetime().optional(),
});

export const updateCaseSchema = z.object({
  assigned_to: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'active', 'on_hold', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  closed_reason: z.string().max(2000).optional(),
  last_contact_at: z.string().datetime().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
  summary: z.string().max(5000).optional(),
  barriers: z.string().max(5000).optional(),
  strengths: z.string().max(5000).optional(),
  consent_notes: z.string().max(5000).optional(),
});

export const createCaseGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  target_date: z.string().optional(), // ISO date
  owner_user_id: z.string().uuid().optional(),
  dimension_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
});

export const updateCaseGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  target_date: z.string().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  dimension_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});
```

### 7.2 `lib/validators/incident.ts`

```typescript
import { z } from 'zod';

export const createIncidentSchema = z.object({
  occurred_at: z.string().datetime(),
  summary: z.string().min(1).max(5000),
  details: z.string().max(20000).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.enum(['behavior', 'facility', 'injury', 'safety', 'conflict', 'theft', 'medical', 'other']).default('other'),
  visibility: z.enum(['private', 'case_management', 'operations']).default('operations'),
  assigned_to: z.string().uuid().optional(),
  follow_up_due_at: z.string().datetime().optional(),
  household_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  asset_id: z.string().uuid().optional(),
  location_text: z.string().max(1000).optional(),
});

export const updateIncidentSchema = z.object({
  assigned_to: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'under_review', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.enum(['behavior', 'facility', 'injury', 'safety', 'conflict', 'theft', 'medical', 'other']).optional(),
  visibility: z.enum(['private', 'case_management', 'operations']).optional(),
  summary: z.string().min(1).max(5000).optional(),
  details: z.string().max(20000).optional(),
  resolution_notes: z.string().max(10000).optional(),
  follow_up_due_at: z.string().datetime().nullable().optional(),
  household_id: z.string().uuid().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  location_text: z.string().max(1000).nullable().optional(),
});

export const incidentPersonSchema = z.object({
  person_id: z.string().uuid(),
  role: z.enum(['subject', 'reporter', 'witness', 'guardian_notified', 'staff_present', 'victim', 'other']).default('other'),
  notes: z.string().max(5000).optional(),
});
```

### 7.3 Extend `lib/validators/note.ts`

Add nullable association fields:

- `household_id`
- `case_id`
- `incident_id`

Update the refine clause so at least one association is required across:

- `person_id`
- `organization_id`
- `opportunity_id`
- `rfp_id`
- `household_id`
- `case_id`
- `incident_id`

Also add a second refine:

- `case_id` and `incident_id` cannot both be present on the same note

### 7.4 Extend `lib/validators/task.ts`

Add nullable fields to create, update, and query schemas:

- `household_id`
- `case_id`
- `incident_id`

Also add a refine so `case_id` and `incident_id` cannot both be present on the same task.

---

## 8. UI Plan

### 8.1 Phase 1: Case management UI

#### New page: `/projects/[slug]/households/cases`

**File:** `app/(dashboard)/projects/[slug]/households/cases/page.tsx` + `cases-page-client.tsx`

Queue-first list view:
- Table columns: Household name, Case manager, Status, Priority, Next follow-up, Last contact, Days open
- Filters: status, priority, assigned_to, overdue follow-up (follow_up < now)
- Sort: next follow-up ASC (default), priority, opened_at
- Click row → navigate to household detail with Case Plan tab active

#### Households list secondary navigation

**File:** `app/(dashboard)/projects/[slug]/households/households-page-client.tsx`

Add secondary tabs or segmented controls inside the Households area:

- `Households`
- `Cases`

This preserves the no-new-primary-nav rule while keeping the case queue discoverable.

#### Household detail tab: `Case Plan`

**File:** modify `app/(dashboard)/projects/[slug]/households/[id]/household-detail-client.tsx`

Add tab (visible only to case_manager+ roles):
- Case summary card: status, priority, assigned case manager, opened_at, last_contact_at, next_follow_up_at
- Quick actions: change status, reassign, set follow-up, record contact
- Goals list: sortable cards with title, status badge, target date, dimension tag, owner avatar
- Add goal form (inline or dialog)
- Barriers / Strengths / Consent notes in collapsible sections

Recording contact from the Case Plan tab must do two writes:

- update `household_cases.last_contact_at`
- insert a `household_case_events` row with `event_type = 'contact_logged'`

#### Household detail tab: `Timeline`

**File:** modify `app/(dashboard)/projects/[slug]/households/[id]/household-detail-client.tsx`

Add tab (visible to case_manager+ roles):
- Vertical timeline of all household activity
- Each item: icon by type, timestamp, actor, one-line summary
- Infinite scroll via keyset cursor pagination
- Filter chips: intake, referrals, notes, tasks, incidents, case events
- "Add note" quick action at top

#### Primary nav

Do not add a new primary sidebar item for Cases in this phase.

### 8.2 Phase 2: Incident logging UI

#### New page: `/projects/[slug]/incidents`

**File:** `app/(dashboard)/projects/[slug]/incidents/page.tsx` + `incidents-page-client.tsx`

Inbox-style list:
- Table columns: Summary (truncated), Status, Severity, Category, Assigned to, Occurred at, Follow-up due
- Filters: status, severity, category, assigned_to, overdue follow-up, household, event, asset
- Color-coded severity badges (low=gray, medium=yellow, high=orange, critical=red)
- Click row → incident detail

#### New page: `/projects/[slug]/incidents/[id]`

**File:** `app/(dashboard)/projects/[slug]/incidents/[id]/page.tsx` + `incident-detail-client.tsx`

Tabs:
- **Overview**: summary, details, metadata (occurred, reported, category, severity, visibility), linked household/event/asset, resolution notes
- **People**: list of involved people with role badges, add person dialog
- **Notes**: chronological follow-up notes with category tags (`initial_report`, `follow_up`, `resolution`, `external_contact`)
- **Tasks**: linked tasks (filtered by `incident_id`)

Quick actions: change status, reassign, change severity, add note, link person, create task

#### Embedded "Report Incident" buttons

Add a "Report Incident" action button to:
- `household-detail-client.tsx` — pre-fills `household_id`
- event detail page — pre-fills `event_id`
- asset detail page — pre-fills `asset_id`
- person detail page — opens incident form with a pending `incident_people` link as `subject`

All use a shared `<ReportIncidentDialog>` component.

Dialog rules:

- if user has `cases:create`, show visibility selector
- otherwise hide visibility selector and submit `visibility = 'operations'`

Person-detail flow detail:

- create the incident first
- then create the `incident_people` row with `role = 'subject'`

#### Nav sidebar

Do not add a new primary sidebar item for Incidents in this phase.

Primary entry points instead:

- dashboard alert/operations card
- notifications created by workflows
- embedded "Report Incident" buttons
- direct links from incident-related tasks

---

## 9. MCP Tools

Do not create standalone MCP registration modules in the first pass.

The repo already derives community MCP tools from the community chat catalog.

Implementation path:

- add `cases.*` and `incidents.*` tools to `lib/chat/community-tool-registry.ts`
- add `cases` and `incidents` to `CORE_PREFIXES` in `lib/mcp/tools/community.ts`
- do not change `lib/mcp/server.ts`

Required tool names:

- `cases.list`
- `cases.get`
- `cases.create`
- `cases.update`
- `cases.close`
- `cases.goals.list`
- `cases.goals.create`
- `cases.goals.update`
- `cases.goals.delete`
- `cases.notes.list`
- `cases.notes.create`
- `cases.timeline`
- `incidents.list`
- `incidents.get`
- `incidents.create`
- `incidents.update`
- `incidents.resolve`
- `incidents.people.add`
- `incidents.people.remove`
- `incidents.notes.list`
- `incidents.notes.create`

---

## 10. Chat Agent Tools

### 10.1 `lib/chat/community-tool-registry.ts`

Add `defineCommunityTool()` entries for the `cases.*` and `incidents.*` names listed above.

Use existing conventions:

- dot-notation tool names
- `resource` + `action` fields mapped to `checkCommunityPermission(...)`
- `roles` limited to the allowed community roles

### 10.2 `hooks/use-chat.ts`

Add to `MUTATING_TOOLS`:

- `cases.create`, `cases_create`
- `cases.update`, `cases_update`
- `cases.close`, `cases_close`
- `cases.goals.create`, `cases_goals_create`
- `cases.goals.update`, `cases_goals_update`
- `cases.notes.create`, `cases_notes_create`
- `incidents.create`, `incidents_create`
- `incidents.update`, `incidents_update`
- `incidents.resolve`, `incidents_resolve`
- `incidents.people.add`, `incidents_people_add`
- `incidents.people.remove`, `incidents_people_remove`
- `incidents.notes.create`, `incidents_notes_create`

### 10.3 `components/chat/chat-settings.tsx`

Add tool categories: "Cases" and "Incidents"

### 10.4 `components/chat/chat-message-list.tsx`

Add colors for cases (e.g., indigo) and incidents (e.g., red/orange)

### 10.5 `lib/chat/system-prompt.ts`

Add case management and incident logging to the system prompt capabilities section.

---

## 11. Reporting

Extend the existing community reporting framework (do not create separate report pages).

### 11.1 Case reporting metrics

Add to the community reports API:

- **Open cases by assignee** — `GROUP BY assigned_to WHERE status <> 'closed'`
- **Overdue follow-ups** — `WHERE next_follow_up_at < NOW() AND status <> 'closed'`
- **Case closure rate** — closed in period / (open at start of period + opened in period)
- **Average days open** — `AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) / 86400)` for cases closed in period
- **Goals completion rate** — completed goals / total goals per period

### 11.2 Incident reporting metrics

- **Incidents by category** — `GROUP BY category` for period
- **Incidents by severity** — `GROUP BY severity` for period
- **Time to resolution** — `AVG(EXTRACT(EPOCH FROM (updated_at - occurred_at)) / 86400)` where status = 'resolved'
- **Incidents by linked entity** — grouped by household/event/asset
- **Open incidents trend** — rolling count over time

---

## 12. Delivery Order

### Phase 1: Case management (build first)

| Step | What | Files |
|------|------|-------|
| 1 | Migration | `supabase/migrations/0179_case_management_incidents.sql` |
| 2 | Regen types | `types/database.ts` |
| 3 | Validators | `lib/validators/case.ts`, extend `lib/validators/task.ts`, extend `lib/validators/note.ts` |
| 4 | Permissions | `lib/projects/community-permissions.ts` — add `cases` resource |
| 5 | API routes | `app/api/projects/[slug]/households/cases/route.ts`, `[id]/route.ts`, `[id]/goals/route.ts`, `[id]/goals/[goalId]/route.ts`, `[id]/notes/route.ts` |
| 6 | Timeline API | `app/api/projects/[slug]/households/[id]/timeline/route.ts` |
| 7 | Automation triggers | `types/automation.ts`, `lib/automations/time-triggers.ts` |
| 8 | Cases page | `app/(dashboard)/projects/[slug]/households/cases/page.tsx`, `cases-page-client.tsx` |
| 9 | Households secondary nav + tabs | modify `households-page-client.tsx` and `household-detail-client.tsx` |
| 10 | Generic tasks/notes filters | update `app/api/projects/[slug]/tasks/route.ts`, `app/api/projects/[slug]/notes/route.ts` |
| 11 | MCP + chat integration | update `lib/chat/community-tool-registry.ts`, `lib/mcp/tools/community.ts`, `hooks/use-chat.ts`, `components/chat/chat-settings.tsx`, `components/chat/chat-message-list.tsx`, `lib/chat/system-prompt.ts` |
| 12 | Typecheck + fix | `npm run typecheck` |
| 13 | RLS/API/UI tests | add and run the Phase 1 tests listed in section 13 |

### Phase 2: Incident logging (build second)

| Step | What | Files |
|------|------|-------|
| 1 | Validators | `lib/validators/incident.ts` |
| 2 | Permissions | `lib/projects/community-permissions.ts` — add `incidents` resource |
| 3 | API routes | `app/api/projects/[slug]/incidents/route.ts`, `[id]/route.ts`, `[id]/people/route.ts`, `[id]/people/[linkId]/route.ts`, `[id]/notes/route.ts` |
| 4 | Automation triggers | `types/automation.ts`, `lib/automations/time-triggers.ts` |
| 5 | Incidents page | `app/(dashboard)/projects/[slug]/incidents/page.tsx`, `incidents-page-client.tsx` |
| 6 | Incident detail | `app/(dashboard)/projects/[slug]/incidents/[id]/page.tsx`, `incident-detail-client.tsx` |
| 7 | Report dialog | `components/community/report-incident-dialog.tsx` |
| 8 | Embed buttons | modify household detail, event detail, asset detail, person detail pages |
| 9 | Dashboard + notification entry points | add dashboard card / shortcut, wire notification deep links |
| 10 | MCP + chat integration | update `lib/chat/community-tool-registry.ts`, `lib/mcp/tools/community.ts`, `hooks/use-chat.ts`, `components/chat/chat-settings.tsx`, `components/chat/chat-message-list.tsx`, `lib/chat/system-prompt.ts` |
| 11 | Reporting | extend community reports API with incident metrics |
| 12 | Typecheck + fix | `npm run typecheck` |
| 13 | RLS/API/UI tests | add and run the Phase 2 tests listed in section 13 |

### Phase 3: Reporting + polish

| Step | What |
|------|------|
| 1 | Add case metrics to community reports |
| 2 | Add incident metrics to community reports |
| 3 | Add workflow template seeds for case + incident automations |
| 4 | End-to-end testing |

---

## 13. Required test coverage

At minimum, add or update tests for these behaviors before calling the feature done:

### 13.1 SQL / RLS

- staff cannot `SELECT` from `household_cases`
- case_manager can `SELECT/INSERT/UPDATE/DELETE` `household_cases`
- staff can `SELECT/INSERT/UPDATE` `incidents` where `visibility = 'operations'`
- staff cannot `SELECT` incidents where `visibility IN ('case_management', 'private')`
- staff cannot `INSERT` or `UPDATE` incidents to `visibility IN ('case_management', 'private')`
- `incident_people` inherits incident visibility
- notes linked to a case are invisible to staff
- tasks linked to a private incident are invisible to staff
- notes/tasks reject rows with both `case_id` and `incident_id`

### 13.2 API

- household timeline returns mixed item types sorted by timestamp DESC
- timeline pagination uses keyset cursor correctly with no duplicates between pages
- case create route rejects second active case for same household
- person incident flow creates incident first, then `incident_people` link
- incident create/update routes coerce or reject invalid visibility by role

### 13.3 UI

- case tabs render only for case_manager+ roles
- staff can open Report Incident dialog but cannot choose private visibility
- case timeline renders `case_event` rows distinctly from notes
- incidents deep links from dashboard/notifications land on the correct detail page

---

## 14. Implementation exit criteria

The work is not done until all of the following are true.

### 14.1 Phase 1 done when

- a case_manager can create, assign, update, and close a case from the household detail page
- the Households area contains a usable `Cases` queue with overdue follow-up filtering
- the household timeline shows intake, referrals, notes, tasks, incidents, and case events in one descending feed
- recording contact updates `last_contact_at` and appends a timeline-visible case event
- staff users cannot access cases through UI, API, or direct SQL reads
- case-linked notes/tasks inherit case sensitivity end-to-end

### 14.2 Phase 2 done when

- staff can report an `operations` incident from supported entry points
- staff cannot create, view, or edit `case_management` or `private` incidents
- case_manager+ users can create and manage all incident visibility levels
- incident-linked notes/tasks/people inherit incident visibility end-to-end
- incident detail supports overview, people, notes, and tasks without bespoke duplicate data models
- dashboard or workflow-generated links provide a non-sidebar path into incidents

### 14.3 Phase 3 done when

- case metrics and incident metrics are available in the existing reporting surface
- workflow templates for case and incident automations are seeded and usable
- typecheck passes and the new RLS/API tests pass

---

## 15. v4 hardening changes

- corrected the security model so RLS matches the stated permissions instead of raw project membership
- called out the required `tasks` and `notes` policy replacement for sensitive linked rows
- fixed FK nullability issues for `created_by` / `reported_by` with `ON DELETE SET NULL`
- aligned MCP and chat integration with the actual repo architecture: `community-tool-registry.ts` + `lib/mcp/tools/community.ts`
- removed the assumption that Cases and Incidents would become new primary sidebar tabs in the first merge
- fixed incident people route identity to use the join-row ID, not `personId`
- made the household timeline implementation concrete by introducing `household_case_events` as the source of `case_event` rows
- explicitly rejected `activity_log` reuse for sensitive case timeline events because its current RLS is too broad
- made incident visibility enforceable at the row level, not just by resource name
- required notes/tasks linked to incidents to inherit incident visibility through SQL helper functions
- added test coverage requirements and phase exit criteria so implementation has a clear finish line
