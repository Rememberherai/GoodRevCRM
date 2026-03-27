# Community Asset Access PRD

**Version:** 1.5
**Date:** 2026-03-27
**Status:** Ready for Implementation
**Project Type:** Community projects only

---

## 1. Overview

Unify room booking, tool-library borrowing, and other shared-resource access under the existing Community Assets module.

Example use cases:
- A recording studio that community members can reserve by the hour
- A meeting room that requires staff approval
- A community lawn mower that can be borrowed for two days
- A tool shelf where some items are public, some are approval-only, and some are internal only

The product goal is not "add a room-booking module." The goal is to let admins track all assets in one place and mark some of them as accessible to the public or to approved members, without adding another top-level page to the community project.

### Core product shape

- `community_assets` remains the single asset catalog
- each asset can be:
  - `tracked_only`
  - `reservable`
  - `loanable`
  - `hybrid`
- person-level `Approved For` permissions control eligibility and bypass
- asset-specific approvers review pending requests
- all internal admin work stays inside Community Assets list/detail views
- public access happens through a project resource hub plus per-asset public pages

### Reuse strategy

This feature extends the existing booking stack instead of creating a second reservation system:
- `community_assets` remains the source of truth
- `event_types.asset_id` links access presets to assets
- `bookings` remains the active allocation record
- existing cancel, reschedule, reminder, and ICS token flows are reused
- the existing community asset booking route (`/api/projects/[slug]/community-assets/[id]/bookings`) is extended, not replaced

### Important repo constraint

The current booking system is host-scoped:
- `bookings.host_user_id` is required
- slot calculation and RPC overlap checks assume conflicts by host

That is not correct for spaces and loanable items. Asset-linked access must become asset-scoped for conflict detection and availability while still storing a valid `host_user_id` for schema compatibility.

---

## 2. Goals

- Keep Community Assets as the single internal admin surface for rooms, tools, equipment, and shared resources
- Let admins mark some assets as reservable, loanable, or hybrid
- Support assets that auto-confirm and assets that require approval
- Let staff manage person-specific access through `Approved For`
- Avoid CRM login requirements for external users
- Keep all approval, denial, checkout, and return actions auditable
- Fit asset access into the existing community RBAC model
- Avoid adding another top-level page to the community nav

---

## 3. Non-Goals

- No public CRM login or guest portal in v1
- No payments in v1
- No arbitrary freeform duration entry in v1
- No recurring standing reservations in v1
- No waitlist in v1
- No multi-asset bookings in v1
- No inventory procurement, maintenance scheduling, or work-order system in v1

---

## 4. Locked Decisions

These decisions are fixed for v1:

- Access model: guest request flow with secure email links
- Approval granularity: per-asset, with person-level allowlist support
- Approver model: asset-specific approvers, with owner/admin fallback
- `Approved For` meaning: eligibility plus approval bypass
- Guest contact policy: create lightweight `people` records only after email verification
- Public surface: project resource hub plus individual asset pages
- Verification UX: email link only in v1
- Denial messaging: guests receive a generic denial message; internal notes stay internal
- Expired approvals remain in the database for audit; active status is computed from `status` plus `expires_at`
- Internal admin UX stays inside Community Assets and Community Asset detail views; no new sidebar destination is added

### 4.1 Execution target

The schema supports `tracked_only`, `reservable`, `loanable`, and `hybrid`, but the first executable delivery target is narrower:

- ship schema support for all four modes
- ship full UX and public flow for `tracked_only` and `reservable`
- ship internal-only return and overdue support for `loanable`
- defer guest-facing `loanable` flow and all `hybrid` UX unless implementation is clearly ahead of schedule

This keeps the model unified while reducing the first shipping slice.

### 4.2 First-ship exclusions

These items are explicitly not required for the first production merge:

- public guest flow for `loanable`
- any end-user `hybrid` UI
- bulk approval actions
- bulk return actions
- CSV export
- dashboard metrics beyond basic queue and overdue counts
- MCP/chat tool support

If any of these appear during implementation, treat them as follow-up work unless they unblock core `reservable` delivery.

---

## 5. State Model

### 5.1 Verification lifecycle

Before a booking exists, the public flow uses `asset_access_verifications`.

Verification states:
- `pending`
- `verified`
- `expired`

Rules:
- token expires after 30 minutes
- token is single-use
- verification does not reserve capacity; capacity is claimed only when the booking is created

### 5.2 Booking lifecycle

Do not introduce a new `bookings.status` enum.

Continue using:
- `pending`
- `confirmed`
- `cancelled`
- `rescheduled`
- `completed`
- `no_show`

For asset access, UI meaning is:
- `pending` = pending review
- `confirmed` = approved or auto-confirmed and currently active
- `completed` = returned / checked back in for loanable assets
- `cancelled` = either denied or cancelled, distinguished by review history
- `rescheduled` = guest rescheduled via token link; the original booking is marked `rescheduled` and a new booking is created with the new times. The new booking re-enters policy evaluation (auto-confirm or queue).
- `no_show` = not used for asset access in v1; reserved for future use

### 5.3 Derived UI states

Public and admin UIs should derive display state as follows:

- `pending_verification`
  Verification row exists, booking not yet created
- `pending_review`
  Asset-linked booking exists with `bookings.status = 'pending'`
- `confirmed`
  Asset-linked booking exists with `bookings.status = 'confirmed'`
- `denied`
  Asset-linked booking exists with `bookings.status = 'cancelled'` and latest `asset_access_events.action = 'denied'` for that booking
- `cancelled`
  Asset-linked booking exists with `bookings.status = 'cancelled'` and latest `asset_access_events.action != 'denied'` (i.e., guest or admin cancelled)
- `completed`
  Asset-linked booking exists with `bookings.status = 'completed'`
- `overdue`
  Loanable or hybrid asset booking has `status = 'confirmed'` and `end_at < NOW()`
- `rescheduled`
  Asset-linked booking exists with `bookings.status = 'rescheduled'` (historical record only; the replacement booking has its own status)

No new booking-status migration is required for v1.

---

## 6. Asset Model

Each community asset can be catalog-only or accessible.

### 6.1 New `community_assets` fields

Extend `community_assets` with:
- `access_mode TEXT NOT NULL DEFAULT 'tracked_only' CHECK (access_mode IN ('tracked_only', 'reservable', 'loanable', 'hybrid'))`
- `access_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `resource_slug TEXT` — UNIQUE within project (see Section 12.2)
- `public_name TEXT`
- `public_description TEXT`
- `approval_policy TEXT NOT NULL DEFAULT 'open_auto' CHECK (approval_policy IN ('open_auto', 'open_review', 'approved_only'))`
- `public_visibility TEXT NOT NULL DEFAULT 'listed' CHECK (public_visibility IN ('listed', 'unlisted'))`
- `access_instructions TEXT`
- `booking_owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL`
- `concurrent_capacity INT NOT NULL DEFAULT 1 CHECK (concurrent_capacity >= 1)`
- `return_required BOOLEAN NOT NULL DEFAULT FALSE`

### 6.2 `access_mode`

Each asset has one mode:

- `tracked_only`
  Internal catalog record only
- `reservable`
  Slot-based booking for rooms, spaces, or timed use
- `loanable`
  Borrow-and-return flow for tools or shared items
- `hybrid`
  Supports both scheduled use and borrow/return semantics

### 6.3 `approval_policy`

Each accessible asset has one policy:

- `open_auto`
  Verified requests are auto-confirmed
- `open_review`
  Verified requests create a booking with `status = 'pending'`
- `approved_only`
  Verified requests auto-confirm only when the matched person has active approval for that asset; otherwise they create a booking with `status = 'pending'`

### 6.4 Semantics

- `access_enabled`
  Turns public access on or off without losing configuration
- `resource_slug`
  Public URL slug unique within a project
- `public_visibility`
  `listed` or `unlisted`
- `booking_owner_user_id`
  Technical owner used to satisfy `event_types.user_id` and `bookings.host_user_id`
- `concurrent_capacity`
  Number of simultaneous active allocations allowed. A room is usually `1`; a tool pool can be greater than `1`.
- `return_required`
  When true, staff must mark the access record `completed` on return. This is primarily for `loanable` and `hybrid` assets.

### 6.5 Booking owner rule

When `access_mode != 'tracked_only'`, `booking_owner_user_id` is required.

This user is a technical scheduling owner, not necessarily an approver.

Default:
- set to project owner on creation
- editable by owner/admin in asset access settings

Edge cases:
- if the booking owner user is deleted, `ON DELETE SET NULL` sets `booking_owner_user_id = NULL`. The public slot API and booking API must check for a non-null booking owner before proceeding and return a clear error.
- the access settings API should validate that `booking_owner_user_id` is an active project member on save.
- the public hub API should exclude assets where `booking_owner_user_id IS NULL` even if `access_enabled = true`.

### 6.6 Access presets

V1 uses fixed access presets backed by `event_types.asset_id`.

Examples:
- `1-hour studio session`
- `3-hour rehearsal block`
- `2-day lawn mower loan`
- `7-day tool checkout`

Rules:
- `event_types.asset_id` must be set
- `event_types.user_id` must equal the asset's `booking_owner_user_id`
- `event_types.scheduling_type` must be `one_on_one` for v1 asset access
- preset duration determines `end_at`
- V1 does not support arbitrary duration entry by guests
- even for `loanable` assets, access is stored as exact datetimes in `bookings`; a "2-day loan" is represented as a preset whose duration spans 48 hours from the selected start slot

### 6.7 Validation rules by mode

When `access_mode` is changed from `tracked_only` to any other mode, the access settings API must enforce:
- `booking_owner_user_id` is required and must be an active project member
- `resource_slug` is required and must be URL-safe (lowercase alphanumeric + hyphens)
- `public_name` is required (falls back to `name` if not set)
- at least one access preset (`event_type` with matching `asset_id`) must exist before `access_enabled` can be set to `true`

When `access_mode` is set back to `tracked_only`:
- `access_enabled` is automatically set to `false`
- existing presets and approvals are preserved (not deleted) for easy re-enablement

### 6.8 Mode-specific behavior

The access mode changes admin and guest behavior:

- `tracked_only`
  - visible only in the internal Community Assets catalog
  - no public page
  - no access presets
- `reservable`
  - uses slot selection UI
  - `completed` is rarely used
  - primary internal surface is schedule/calendar + requests
- `loanable`
  - uses start date + due date semantics
  - `completed` means returned
  - primary internal surface is active loans + overdue tracking
- `hybrid`
  - uses the same asset record and approval model
  - exposes both schedule-style usage and return-required lifecycle
  - can be simplified in UI by showing both schedule and loans sections on the asset detail page

---

## 7. Person Approval Model

Add a new `Approved For` tab to the community person detail page.

An `Approved For` record means:
- the person is eligible to use the asset
- the person bypasses manual review when the asset policy allows it

### 7.1 Approval table

Create `community_asset_person_approvals` with:
- `id UUID PK`
- `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `asset_id UUID NOT NULL REFERENCES community_assets(id) ON DELETE CASCADE`
- `person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE`
- `status TEXT NOT NULL CHECK (status IN ('active', 'revoked'))`
- `notes TEXT`
- `expires_at TIMESTAMPTZ`
- `created_by UUID REFERENCES users(id)`
- `revoked_by UUID REFERENCES users(id)`
- `revoked_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- UNIQUE (`asset_id`, `person_id`)

### 7.2 Active approval logic

An approval is active only when:
- `status = 'active'`
- `expires_at IS NULL OR expires_at > NOW()`

Do not write a separate `expired` status in v1.

### 7.3 Admin workflows

Authorized staff can:
- grant a person access to an asset
- revoke that access
- add notes
- set an expiration date
- approve both access and a pending booking in one action

---

## 8. Availability and Conflict Model

This is the most important implementation-specific section.

### 8.1 Existing problem

The current slot engine and booking RPCs treat conflicts as host-user conflicts.

That is incorrect for asset-linked access because:
- two assets can share the same booking owner user and should not block each other
- a booking owner's synced calendar events should not block a room
- a returned tool should free the asset even though the technical host user never changed

### 8.2 Required behavior

For `event_types` where `asset_id IS NOT NULL`:
- availability is asset-scoped, not host-scoped
- conflicts are computed across all active bookings for event types with the same `asset_id`
- personal `synced_events` are ignored
- host calendar push is skipped by default
- `completed` frees capacity for loanable and hybrid assets

### 8.3 Slot engine changes

The current `getAvailableSlots()` in `lib/calendar/slots.ts` works as follows:
1. loads the event type and determines scheduling mode
2. resolves member user IDs
3. loads per-user availability (schedule rules, overrides, bookings by `host_user_id`, synced events)
4. computes slots by intersecting/unioning user availability

For asset-linked event types, add a branching path early in `getAvailableSlots()`:

When `eventType.asset_id IS NOT NULL`:
- **schedule**: use the event type's `schedule_id` (which the admin configures to define the asset's operating hours). If no `schedule_id`, fall back to the booking owner's default schedule. Do NOT load per-user schedules for team members.
- **bookings**: load by `event_type_id IN (SELECT id FROM event_types WHERE asset_id = ?)` with `status IN ('pending', 'confirmed')`, NOT by `host_user_id`
- **synced events**: skip entirely — the booking owner's personal calendar does not block the asset
- **overrides**: use the event type's schedule overrides only
- **capacity**: a slot is available if the count of overlapping active bookings < `concurrent_capacity` (loaded from the asset). For capacity > 1, a slot with 2 of 3 capacity used is still available.
- **timezone**: use the event type's `timezone` field. The public slots API must return this timezone so the client can render slots in the asset's local time.
- **scheduling type**: force `one_on_one` logic (no round robin or collective for assets in v1)

### 8.4 Booking creation changes

Add a new RPC in the migration:
- `create_asset_booking_if_available(...)`

Keep `create_booking_if_available(...)` unchanged for person scheduling.

The existing `create_booking_if_available()` (defined in `0122_calendar_core_fixes.sql`) works by:
1. `pg_advisory_xact_lock(hashtext(p_host_user_id::text))` — locks on host
2. overlap check on `host_user_id` + `effective_block` GiST range
3. daily/weekly limit checks on host
4. inserts into `bookings`

The new asset RPC must differ in these ways:
- lock on `hashtext(p_asset_id::text)` instead of host user
- accept `p_asset_id UUID` and `p_booking_owner_user_id UUID` as parameters
- overlap check: count bookings where `event_type_id IN (SELECT id FROM event_types WHERE asset_id = p_asset_id)` AND `status NOT IN ('cancelled', 'rescheduled', 'completed')` AND `effective_block && tstzrange(start, end)`
- reject if count >= `concurrent_capacity` (loaded from `community_assets`)
- skip daily/weekly limit checks (these are host-scoped concepts that don't apply to assets)
- insert into `bookings` with `host_user_id = p_booking_owner_user_id`
- set status via `p_requires_confirmation` parameter (same as existing RPC)
- return booking UUID on success

Grant execute to `authenticated` and `service_role`, matching the existing pattern.

Do not modify the existing `create_booking_if_available()` function.

### 8.5 Loanable capacity semantics

For `loanable` and `hybrid` assets:
- `confirmed` bookings consume capacity until marked `completed` (returned) or `cancelled`
- `pending` bookings also consume capacity to prevent over-allocation during review
- `completed` and `cancelled` bookings do not consume capacity
- the `overdue` derived state does NOT free capacity — the item is still out

---

## 9. Public Access Experience

### 9.1 Public routes

Add a project-level public resource hub:
- `/resources/[hubSlug]`

Add a per-asset page:
- `/resources/[hubSlug]/[resourceSlug]`

Add a verification page:
- `/resources/verify/[token]`

Add to `middleware.ts`: the `/resources/` and `/api/resources/` paths must be publicly accessible (no auth redirect). Match the existing pattern used for `/book/` routes.

The existing `/book/[profileSlug]` routes remain for person-hosted scheduling and must not be repurposed.

### 9.2 Guest flow

1. Guest opens the public hub or a direct asset page
2. Guest selects an asset
3. Guest selects an access preset
4. Guest selects an available slot or start date
5. Guest enters name and email
6. System creates an `asset_access_verifications` row and sends a verification email
7. Guest clicks the verification link
8. System validates the token, then matches or creates a lightweight `people` record
9. System creates the booking via the asset-aware booking RPC
10. The booking is auto-confirmed or queued based on policy

For the first executable slice:
- public flow is required for `reservable` assets
- `loanable` public flow may stay hidden until Slice B
- `hybrid` public flow is deferred until both reservable and loanable behavior are stable

### 9.3 Why person creation happens after verification

This avoids polluting `people` with spam or mistyped emails.

### 9.4 Slot hold behavior

No slot is held between submission and verification.

If capacity is taken before verification completes:
- token is still considered verified
- booking creation fails with a slot-taken response
- guest is returned to the asset page to select another time

### 9.5 No CRM login

Guests never log into the CRM.

Guest actions use secure tokens for:
- email verification (new `asset_access_verifications.token`)
- cancellation (reuses existing `bookings.cancel_token`)
- rescheduling (reuses existing `bookings.reschedule_token`) — for `reservable` assets only. Rescheduling a `loanable` booking changes the pickup date; `return_required` assets still need manual return regardless.
- ICS/calendar download (reuses existing `bookings.ics_token`)

### 9.6 Security requirements

Token generation:
- 32 bytes, hex-encoded (matching existing booking token pattern)
- single-use for verification tokens
- verification tokens expire after 30 minutes

Rate limiting (reuse existing `booking_rate_limits` table and `upsert_rate_limit()` RPC):
- booking submissions: 10 per IP per hour
- verification emails: 5 per email per hour

Input validation:
- all public inputs validated with Zod schemas (reuse from `lib/validators/asset-access.ts`)
- guest-supplied text (`guest_name`, `email`, notes) must be sanitized before rendering in admin views to prevent stored XSS

Identity matching:
- match by normalized (lowercased, trimmed) email within the same `project_id`
- if multiple `people` records share the same email, match the most recently updated
- name is for display only; never used for approval bypass

---

## 10. Internal Admin Experience

### 10.1 Community Assets page

Do not add a new sidebar item.

The existing Community Assets page becomes the internal admin home for:
- asset catalog
- access requests
- active reservations and loans
- overdue loans
- access-enabled asset setup

Recommended top-level tabs or filters inside Community Assets:
- All Assets
- Requests
- Active Access
- Overdue

Recommended table or card metadata on the main asset list:
- category
- access mode badge: `Tracked`, `Reservable`, `Loanable`, `Hybrid`
- public status badge: `Live`, `Draft`, `Internal`
- active allocation count vs `concurrent_capacity`
- overdue count for `loanable` and `hybrid` assets

The point of this page is that an admin can manage rooms, tools, and other resources from one list without mentally switching modules.

### 10.2 Asset detail tabs

Accessible assets should include:
- Details
- Access
- Calendar or Schedule
- Requests
- Approved People
- Activity

For `loanable` assets, the detail view must show active loans and allow manual return.

### 10.3 Approval and return actions

Authorized staff must be able to:
- approve booking only
- deny booking
- grant person access only
- grant person access and approve booking in one action
- mark a loanable or hybrid asset returned by setting the booking to `completed`

Denial behavior:
- set `bookings.status = 'cancelled'`
- write `asset_access_events.action = 'denied'`
- optionally set `cancellation_reason` to a safe generic value such as `Denied by approver`
- send generic denial email to guest

### 10.4 Approver fallback

When an asset has no assigned approvers:
- `owner` and `admin` remain eligible approvers
- notification fanout goes to all project `owner` and `admin` members
- `booking_owner_user_id` is not automatically treated as an approver unless that user is also an owner/admin or is explicitly assigned in `community_asset_approvers`

---

## 11. Permissions and RBAC

Asset access needs its own permission surface, even though the UI stays inside Community Assets.

### 11.1 TypeScript permission model

Add `asset_access` to the `CommunityResource` union type in `lib/projects/community-permissions.ts`.

Add an `asset_access` entry to every role in `COMMUNITY_PERMISSION_MATRIX`. The matrix currently has 8 roles that each need this key: `owner`, `admin`, `staff`, `case_manager`, `contractor`, `board_viewer`, `member`, `viewer`.

Use existing actions:
- `view`
- `manage`

Do not add a new action type in v1. Approval and return use `manage`.

### 11.2 Role matrix

- `owner`: `['view', 'manage']`
- `admin`: `['view', 'manage']`
- `staff`: `['view', 'manage']`
- `case_manager`: `['view']` — can see access status but cannot approve or return without being an assigned approver
- `contractor`, `board_viewer`, `member`, `viewer`: `NO_ACTIONS`

### 11.3 Assignment guard

Role access alone is not enough for staff.

Manage rule:
- `owner` and `admin` can manage all assets
- `staff` can manage only assets where they are listed in `community_asset_approvers`

Implement this in a dedicated helper such as:
- `requireAssetAccessManage(...)`

Do not encode per-asset assignment logic directly into the static permission matrix.

### 11.4 Project membership overrides

Because `project_membership_overrides` already exists by resource key, `asset_access` should be a valid override target for view access only. Write access still requires owner/admin or assigned-approver logic.

---

## 12. Data Model

### 12.1 Migration

Use:
- `supabase/migrations/0163_asset_access.sql`

### 12.2 New and changed tables

#### Extend `community_assets`

Add the fields from Section 6 with:
- `ADD COLUMN IF NOT EXISTS`
- indexes on `project_id, access_mode`, `project_id, resource_slug`
- UNIQUE (`project_id`, `resource_slug`) — partial: `WHERE resource_slug IS NOT NULL` (tracked-only assets don't need slugs)

#### `asset_access_settings`

One row per project:
- `id UUID PK`
- `project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE`
- `slug TEXT NOT NULL UNIQUE` — globally unique because it appears in the public URL `/resources/[hubSlug]` without a project prefix
- `title TEXT NOT NULL DEFAULT 'Community Resources'`
- `description TEXT`
- `logo_url TEXT`
- `accent_color TEXT`
- `is_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `community_asset_approvers`

- `id UUID PK`
- `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `asset_id UUID NOT NULL REFERENCES community_assets(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- UNIQUE (`asset_id`, `user_id`)

#### `community_asset_person_approvals`

See Section 7.

#### `asset_access_verifications`

- `id UUID PK`
- `token TEXT NOT NULL UNIQUE`
- `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `asset_id UUID NOT NULL REFERENCES community_assets(id) ON DELETE CASCADE`
- `event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE`
- `email TEXT NOT NULL`
- `guest_name TEXT NOT NULL`
- `requested_start_at TIMESTAMPTZ NOT NULL`
- `requested_end_at TIMESTAMPTZ NOT NULL`
- `responses JSONB NOT NULL DEFAULT '{}'`
- `status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'expired'))`
- `verified_at TIMESTAMPTZ`
- `expires_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `asset_access_events`

Immutable audit log:
- `id UUID PK`
- `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE`
- `verification_id UUID REFERENCES asset_access_verifications(id) ON DELETE CASCADE`
- `action TEXT NOT NULL CHECK (action IN ('submitted', 'verification_sent', 'verified', 'queued_for_review', 'auto_confirmed', 'approved', 'denied', 'cancelled', 'rescheduled', 'access_granted', 'returned'))`
- `actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'guest', 'user'))`
- `actor_id UUID`
- `notes TEXT`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- CHECK (`booking_id IS NOT NULL OR verification_id IS NOT NULL`) — at least one reference
- INDEX on (`booking_id`, `created_at`)

Note: `booking_id` is nullable because early lifecycle events (`submitted`, `verification_sent`) occur before a booking exists. These events reference `verification_id` instead.

### 12.3 Reused tables

- `event_types`
- `bookings`
- `people`
- `booking_rate_limits`

### 12.4 RLS

Public routes use `createServiceClient()` (defined in `lib/supabase/server.ts`).

New tables need RLS policies:
- `asset_access_settings`: owner/admin full CRUD via `community_has_permission(project_id, 'asset_access', 'manage')`
- `community_asset_approvers`: owner/admin full CRUD via same
- `community_asset_person_approvals`: owner/admin + assigned staff read/write (staff guard is in API layer, not RLS)
- `asset_access_verifications`: no authenticated RLS needed — only accessed via `createServiceClient()` in public routes
- `asset_access_events`: read-only for authenticated users with `asset_access:view`; inserts via service client only

Implementation rule:
- client components must not query the new asset-access tables directly with browser Supabase clients
- all reads and writes for these tables must go through the API routes listed in Section 13 so assignment-based authorization stays enforceable

### 12.5 SQL function changes

The `community_has_permission()` function (defined in `0133_community_project_type.sql`) hardcodes the resource list. The migration must:
- `CREATE OR REPLACE FUNCTION community_has_permission(...)` to add `asset_access` to the resource check
- ensure all RLS policies on the new tables use this function
- add `handle_updated_at()` triggers (defined in `0001_users.sql`) to all new tables with `updated_at` columns

---

## 13. API Routes

All internal routes follow:
- auth
- project lookup
- RBAC
- Zod validation
- query/service
- automation
- respond

All public routes use `createServiceClient()` and no auth.

### 13.0 Response conventions

To keep the first implementation consistent, new asset-access routes should use a simple shared error shape:

- success: route-specific JSON payloads described below
- validation error: `400` with `{ error: { code: 'validation_error', message, details } }`
- auth error: `401` with `{ error: { code: 'unauthorized', message } }`
- permission error: `403` with `{ error: { code: 'forbidden', message } }`
- not found: `404` with `{ error: { code: 'not_found', message } }`
- conflict: `409` with `{ error: { code: 'conflict', message } }`
- rate limit: `429` with `{ error: { code: 'rate_limited', message } }`

Asset-access-specific `409` codes for first ship:
- `slot_taken`
- `capacity_exhausted`
- `asset_disabled`
- `approval_expired`

### 13.1 Internal routes

| Route | Methods | RBAC | Notes |
|---|---|---|---|
| `app/api/projects/[slug]/community-assets/access-settings/route.ts` | GET, PUT | owner/admin | Resource hub settings upsert on `project_id` |
| `app/api/projects/[slug]/community-assets/[id]/access-settings/route.ts` | GET, PATCH | owner/admin | Access mode, approval policy, booking owner, public config |
| `app/api/projects/[slug]/community-assets/[id]/approvers/route.ts` | GET, POST | owner/admin | List/assign approvers |
| `app/api/projects/[slug]/community-assets/[id]/approvers/[userId]/route.ts` | DELETE | owner/admin | Remove approver |
| `app/api/projects/[slug]/community-assets/[id]/approved-people/route.ts` | GET, POST | owner/admin, assigned staff manage | List/create approvals |
| `app/api/projects/[slug]/community-assets/[id]/approved-people/[approvalId]/route.ts` | PATCH, DELETE | owner/admin, assigned staff manage | Revoke/update notes/expiry |
| `app/api/projects/[slug]/community-assets/[id]/bookings/route.ts` | GET, POST | view/update existing rules | Extend existing route for asset-scoped listing and internal manual create |
| `app/api/projects/[slug]/community-assets/requests/route.ts` | GET | owner/admin/all assigned staff | Queue/list view with filters |
| `app/api/projects/[slug]/community-assets/requests/[bookingId]/review/route.ts` | PATCH | owner/admin, assigned staff manage | Approve, deny, grant-access-and-approve |
| `app/api/projects/[slug]/community-assets/requests/[bookingId]/return/route.ts` | POST | owner/admin, assigned staff manage | Mark loanable/hybrid asset returned (`completed`) |

Request/response contracts for first ship:
- `PATCH .../[id]/access-settings`
  - body: `{ access_mode, access_enabled, resource_slug, public_name, public_description, approval_policy, public_visibility, access_instructions, booking_owner_user_id, concurrent_capacity, return_required }`
  - response: `{ asset }`
- `PATCH .../requests/[bookingId]/review`
  - body: `{ action: 'approve' | 'deny' | 'grant_access_and_approve', notes?: string, expires_at?: string | null }`
  - response: `{ booking, approval_created?: boolean }`
- `POST .../requests/[bookingId]/return`
  - body: `{ notes?: string }`
  - response: `{ booking }`

Route-level implementation notes:
- `GET .../requests` should support `status`, `asset_id`, `approver_scope`, and `cursor` query params so the page can ship with server-side filters
- `POST .../approved-people` should upsert by (`asset_id`, `person_id`) instead of creating duplicates
- `DELETE .../approvers` should use a `[userId]` route segment (e.g., `.../approvers/[userId]/route.ts`) rather than a body or query-string — HTTP DELETE with a request body is unreliable across clients

### 13.2 Public routes

| Route | Methods | Rate limit | Notes |
|---|---|---|---|
| `app/api/resources/[hubSlug]/route.ts` | GET | no | Resolve `hubSlug` → `asset_access_settings.slug` → `project_id`. Return hub config + listed assets where `access_enabled = true`, `booking_owner_user_id IS NOT NULL`, and `public_visibility = 'listed'` |
| `app/api/resources/[hubSlug]/[resourceSlug]/route.ts` | GET | no | Public asset detail + access presets |
| `app/api/resources/[hubSlug]/[resourceSlug]/slots/route.ts` | GET | no | Wrapper over asset-aware slot engine |
| `app/api/resources/[hubSlug]/[resourceSlug]/book/route.ts` | POST | IP 10/hr, email 5/hr | Create verification row, send email |
| `app/api/resources/verify/[token]/route.ts` | GET | no | Validate token and return pending request details |
| `app/api/resources/verify/[token]/route.ts` | POST | no | Consume token, create person + booking, return outcome |

Request/response contracts for first ship:
- `POST .../[resourceSlug]/book`
  - body: `{ event_type_id, start_at, guest_name, guest_email, responses?: Record<string, unknown> }`
  - response: `{ verification_sent: true }`
- `GET /api/resources/verify/[token]`
  - response: `{ asset_name, preset_name, requested_start_at, requested_end_at, expires_at, status }`
- `POST /api/resources/verify/[token]`
  - response when confirmed: `{ outcome: 'confirmed', booking_id, cancel_token, reschedule_token, ics_token }`
  - response when queued: `{ outcome: 'pending_review', booking_id }`
  - response when slot lost: `{ outcome: 'slot_taken' }`

Public-route implementation notes:
- `GET .../slots` should return the asset timezone and slot duration so the page does not have to infer them client-side
- `POST .../book` must re-check that the requested `event_type_id` belongs to the asset resolved by `[resourceSlug]`
- `POST /api/resources/verify/[token]` must be idempotent after success and return the final booking outcome for repeated page refreshes

### 13.3 Email notifications

Guest emails (via `lib/asset-access/notifications.ts`):
- **verification**: sent on submission — contains verification link, asset name, requested time
- **confirmed**: sent after auto-confirm or manual approval — contains ICS attachment, cancel link, reschedule link
- **queued**: sent after verified submission enters review — "your request is being reviewed"
- **denied**: sent on denial — generic message, no internal notes exposed
- **cancelled**: sent if admin cancels an approved booking

Approver emails:
- **new request**: sent to assigned approvers (or owner/admin if none assigned) when a booking enters `pending` status
- **overdue alert**: sent to assigned approvers when a loanable asset passes its `end_at` without being returned. Triggered via the existing time-trigger system (`lib/automations/time-triggers.ts`) — add a `booking` entity type with an `overdue_loan` time trigger that checks for `status = 'confirmed'` AND `end_at < NOW()` on asset-linked bookings where `return_required = true`

Notification fanout rule:
- if `community_asset_approvers` has rows for the asset, notify only those users
- otherwise notify all project owners and admins

### 13.4 Automation events

Emit:
- `asset_access.submitted`
- `asset_access.verified`
- `asset_access.confirmed`
- `asset_access.denied`
- `asset_access.cancelled`
- `asset_access.rescheduled`
- `asset_access.returned`

Use existing `emitAutomationEvent()` pattern.

---

## 14. Pages and Files

### 14.1 New pages

- `app/resources/layout.tsx`
- `app/resources/[hubSlug]/page.tsx`
- `app/resources/[hubSlug]/[resourceSlug]/page.tsx`
- `app/resources/verify/[token]/page.tsx`

### 14.2 New components

- `components/community/assets/access-settings-tab.tsx`
- `components/community/assets/approved-people-tab.tsx`
- `components/community/assets/asset-requests-tab.tsx`
- `components/community/assets/resource-approver-select.tsx`
- `components/community/assets/asset-access-queue.tsx`
- `components/community/assets/active-loans-panel.tsx`
- `components/community/people/person-approved-for-tab.tsx`
- `components/resources/public-resource-hub.tsx`
- `components/resources/public-resource-detail.tsx`
- `components/resources/resource-verification-result.tsx`

### 14.3 New service and validator files

- `lib/asset-access/service.ts`
- `lib/asset-access/notifications.ts`
- `lib/asset-access/queries.ts`
- `lib/validators/asset-access.ts`

### 14.4 MCP and chat agent tools

Per CLAUDE.md requirements, this feature must include:

MCP tools (in `lib/mcp/tools/`):
- `asset-access.getSettings` — read hub settings
- `asset-access.updateSettings` — update hub settings
- `asset-access.listApprovers` — list approvers for an asset
- `asset-access.addApprover` — assign approver
- `asset-access.removeApprover` — remove approver
- `asset-access.listApprovedPeople` — list person approvals for an asset
- `asset-access.grantAccess` — grant person access
- `asset-access.revokeAccess` — revoke person access
- `asset-access.listRequests` — list pending/active requests
- `asset-access.reviewRequest` — approve/deny a request
- `asset-access.markReturned` — mark loanable asset returned

Register via `registerAssetAccessTools()` in `lib/mcp/server.ts`.

Chat agent tools (in `lib/chat/tool-registry.ts`):
- Add corresponding `defineTool()` entries
- Add write operations to `MUTATING_TOOLS` in `hooks/use-chat.ts`
- Add tool category to `components/chat/chat-settings.tsx` and `components/chat/chat-message-list.tsx`
- Update `lib/chat/system-prompt.ts`

### 14.5 Existing files to modify

- `app/(dashboard)/projects/[slug]/community-assets/assets-page-client.tsx`
- `app/(dashboard)/projects/[slug]/community-assets/[id]/asset-detail-client.tsx`
- `app/(dashboard)/projects/[slug]/people/[id]/person-detail-client.tsx`
- `app/api/projects/[slug]/community-assets/[id]/bookings/route.ts`
- `lib/calendar/slots.ts`
- `lib/calendar/service.ts`
- `lib/projects/community-permissions.ts`
- `lib/validators/community/assets.ts`
- `lib/mcp/server.ts`
- `lib/chat/tool-registry.ts`
- `lib/chat/system-prompt.ts`
- `hooks/use-chat.ts`
- `components/chat/chat-settings.tsx`
- `components/chat/chat-message-list.tsx`
- `types/community.ts`
- `types/automation.ts`
- `middleware.ts`

---

## 15. Implementation Phases

### Recommended delivery order

Even though the model supports `reservable`, `loanable`, and `hybrid`, the lowest-risk delivery order is:

1. **Slice A: Reservable assets**
   Ship `tracked_only` + `reservable`, public request flow, approvals, and Community Assets queue.
2. **Slice B: Loanable assets**
   Add return flow, overdue state, and active-loan panels.
3. **Slice C: Hybrid assets**
   Enable assets that need both behaviors after the other two are stable.

This keeps the schema unified from day one but avoids building the hardest mixed-mode UI first.

### Ready-to-execute scope

If the team wants the fastest path to mergeable production code, the recommended first implementation scope is:

1. schema for all modes
2. internal Community Assets access settings and approvals
3. asset-scoped booking engine
4. public + internal flow for `reservable`
5. internal return and overdue support for `loanable`
6. MCP/chat tools after the core UX and APIs are stable

Do not start with `hybrid` UX. It is an enable-later mode on the shared schema.

### Build checklist for first coding pass

Use this as the implementation order for the first branch. The goal is to get schema and asset-scoped booking mechanics merged before public UI work.

#### Phase 1 checklist: schema, migration, types, validators

1. Create migration file: `supabase/migrations/0163_asset_access.sql`
2. In the migration, extend `community_assets` with the fields from Section 6.
3. In the migration, create:
   - `asset_access_settings`
   - `community_asset_approvers`
   - `community_asset_person_approvals`
   - `asset_access_verifications`
   - `asset_access_events`
4. In the migration, add:
   - indexes
   - partial unique constraint for `community_assets(project_id, resource_slug)`
   - `handle_updated_at()` triggers where needed
5. In the migration, `CREATE OR REPLACE FUNCTION community_has_permission(...)` so `asset_access` is a valid resource.
6. In the migration, add the new RPC `create_asset_booking_if_available(...)`.
7. Regenerate generated DB types after the migration is finalized.

File ownership for Phase 1:
- `supabase/migrations/0163_asset_access.sql`
  - all schema work
  - RLS policies
  - SQL function updates
  - booking RPC
- `types/database.ts`
  - regenerated types only
- `types/community.ts`
  - add asset-access-related app types and enums if this repo keeps local mirrors
- `lib/projects/community-permissions.ts`
  - add `asset_access` resource
  - update matrix
  - add or stub assignment-aware helper entry points
- `lib/validators/asset-access.ts`
  - create all new request schemas for internal and public routes
- `lib/validators/community/assets.ts`
  - extend existing asset validators so access settings and mode transitions validate cleanly

Definition of done for the Phase 1 PR:
- migration applies without manual SQL edits
- generated types are committed
- `asset_access` exists in TypeScript permission types and SQL permission checks
- every Phase 1 route payload mentioned in Section 13 has a validator shape ready to import

#### Phase 2 checklist: asset-scoped booking engine

Implementation order:

1. Branch the slot engine for `event_types.asset_id IS NOT NULL`.
2. Add service helpers that load asset settings, capacity, approvers, and active approvals.
3. Wire the new asset-aware RPC into booking creation paths.
4. Update internal asset booking queries so they read by asset, not booking owner.
5. Disable personal-calendar conflict handling for asset-linked event types.
6. Confirm cancel/reschedule/reminder/ICS flows still work for asset-linked bookings.

File ownership for Phase 2:
- `lib/calendar/slots.ts`
  - add early branch for asset-linked event types
  - use event-type schedule, not per-user team availability
  - ignore synced events for assets
  - compute capacity by overlapping asset-linked bookings
- `lib/calendar/service.ts`
  - route asset-linked booking creation through asset-aware service/RPC
  - keep existing person-booking path unchanged
- `lib/asset-access/service.ts`
  - create core helpers:
    - `getAssetAccessContext(...)`
    - `getAssetAvailability(...)`
    - `createAssetBooking(...)`
    - `evaluateAssetApprovalPolicy(...)`
    - `markAssetReturned(...)`
- `lib/asset-access/queries.ts`
  - centralize asset-linked reads for requests, approvals, approvers, and active allocations
- `app/api/projects/[slug]/community-assets/[id]/bookings/route.ts`
  - switch GET listing to asset-scoped query behavior
  - keep POST safe for internal/manual create only if already supported; otherwise make it read-only until later UI work lands

Guardrails for Phase 2:
- do not rewrite the existing person-booking service path
- do not modify `create_booking_if_available(...)`
- do not let booking-owner synced events block asset slots
- do not mix assignment authorization into SQL slot logic; keep it in API/service layer

Definition of done for the Phase 2 PR:
- one asset can create two non-overlapping bookings successfully
- overlapping bookings on the same asset fail at capacity `1`
- two assets sharing the same booking owner do not conflict
- existing `/book/...` scheduling continues to produce slots normally
- at least one internal route can list asset-linked bookings using the new asset-scoped query path

#### Phase 3 checklist: public verification flow

**Goal:** Guests can request reservable or loanable assets without logging in.

1. Build public hub/detail APIs
2. Build verification-create API
3. Build verification-consume API
4. Build public pages
5. Create/match person only after verification
6. Send verification email and generic denial email

File ownership for Phase 3:
- `app/api/resources/[hubSlug]/route.ts` — hub listing API
- `app/api/resources/[hubSlug]/[resourceSlug]/route.ts` — asset detail API
- `app/api/resources/[hubSlug]/[resourceSlug]/slots/route.ts` — slot API wrapper
- `app/api/resources/[hubSlug]/[resourceSlug]/book/route.ts` — verification creation
- `app/api/resources/verify/[token]/route.ts` — token validation and booking creation
- `app/resources/layout.tsx` — public layout
- `app/resources/[hubSlug]/page.tsx` — hub page
- `app/resources/[hubSlug]/[resourceSlug]/page.tsx` — asset page
- `app/resources/verify/[token]/page.tsx` — verification page
- `components/resources/public-resource-hub.tsx`
- `components/resources/public-resource-detail.tsx`
- `components/resources/resource-verification-result.tsx`
- `lib/asset-access/notifications.ts` — email sending
- `middleware.ts` — add `/resources/` and `/api/resources/` to public paths

**Verify**
- guest can request a room or tool
- token verifies once
- expired token fails
- capacity taken after verification is handled gracefully

**Exit criteria**
- public reservable flow works end-to-end without dashboard auth
- public `loanable` page can remain hidden without blocking merge

#### Phase 4 checklist: internal Community Assets UX

**Goal:** Admins and assigned staff can manage setup and approvals without a new module.

1. Add access settings tab to asset detail
2. Add approvers management
3. Add approved people management
4. Add requests and active-access views inside Community Assets
5. Add overdue view for loanable assets
6. Add person `Approved For` tab
7. Do not add a new sidebar entry

File ownership for Phase 4:
- `components/community/assets/access-settings-tab.tsx`
- `components/community/assets/approved-people-tab.tsx`
- `components/community/assets/asset-requests-tab.tsx`
- `components/community/assets/resource-approver-select.tsx`
- `components/community/assets/asset-access-queue.tsx`
- `components/community/assets/active-loans-panel.tsx`
- `components/community/people/person-approved-for-tab.tsx`
- `app/(dashboard)/projects/[slug]/community-assets/assets-page-client.tsx` — add queue/filter tabs
- `app/(dashboard)/projects/[slug]/community-assets/[id]/asset-detail-client.tsx` — add access/approvers/requests tabs
- `app/(dashboard)/projects/[slug]/people/[id]/person-detail-client.tsx` — add Approved For tab
- Internal API routes from Section 13.1

**Verify**
- owner/admin can configure all assets
- assigned staff can manage only assigned assets
- unassigned staff cannot approve or return assets

**Exit criteria**
- no new sidebar item is introduced
- a project admin can configure, review, approve, and return entirely from Community Assets and People detail pages

#### Phase 5 checklist: MCP and chat agent tools

**Goal:** AI assistants can manage asset access.

1. Create `lib/mcp/tools/asset-access.ts`
2. Register in `lib/mcp/server.ts`
3. Add chat agent tools in `lib/chat/tool-registry.ts`
4. Update `MUTATING_TOOLS`, chat settings, message list colors, and system prompt
5. Emit automation events from MCP tool handlers

**Verify**
- MCP tools respond correctly with RBAC enforcement
- chat agent can list requests and approve bookings

Note:
- if delivery pressure exists, this phase can follow the first merge and should not block the core asset-access rollout

#### Phase 6 checklist: testing and regression

**Goal:** Feature is safe to merge.

1. Add validator tests
2. Add API tests
3. Add permission tests
4. Add public verification-flow tests
5. Add asset-conflict tests
6. Add return/overdue tests
7. Re-run booking, events, and community-asset regressions

**Verify**
- `npm run typecheck`
- `npx vitest run --reporter=verbose`

---

## 16. Acceptance Criteria

### 16.1 First-ship acceptance criteria

- Admin can keep an asset tracked-only or mark it reservable
- Admin can configure access policy (`open_auto`, `open_review`, `approved_only`)
- Admin can create access presets (event types linked to the asset)
- Admin can assign specific approvers to an asset
- Admin can publish a project resource hub with a custom slug
- Guest can request a reservable asset without a CRM login
- Guest must verify email before booking creation
- Auto-approved reservable assets confirm after verification
- Approval-required reservable assets create pending bookings and notify approvers
- Slot taken after verification shows a clear error, not a silent failure
- Person detail page includes an `Approved For` tab
- `Approved For` controls both eligibility and bypass
- Expired approvals do not grant bypass
- Asset conflicts are asset-scoped, not host-scoped
- Booking owner's personal schedule is not blocked by asset bookings
- Community Assets remains the single internal admin surface for this feature
- All booking and approval actions are auditable via `asset_access_events`
- Existing `/book/...` scheduling flow is not broken

### 16.2 Full-scope acceptance criteria

- Admin can keep an asset tracked-only or mark it reservable, loanable, or hybrid
- Admin can configure access policy
- Admin can assign specific approvers to an asset
- Admin can publish a project resource hub
- Guest can request or borrow an asset without a CRM login
- Guest must verify email before booking creation
- Auto-approved assets confirm after verification
- Approval-required assets create pending bookings and notify approvers
- Person detail page includes an `Approved For` tab
- `Approved For` controls both eligibility and bypass
- Expired approvals do not bypass review
- Approver can grant access and approve in one action
- Loanable assets can be marked returned via `completed`
- Asset conflicts are asset-scoped, not host-scoped
- Existing `/book/...` scheduling flow is not broken
- Existing events pages are not broken
- Community Assets remains the single internal admin surface for this feature
- All booking, approval, and return actions are auditable

---

## 17. Test Plan

### 17.1 Validator tests

- asset access settings schema
- approver assignment schema
- approval grant/revoke schema
- verification payload schema
- review action schema

### 17.2 Service tests

- asset-scoped slot generation
- asset-scoped conflict detection
- `concurrent_capacity`
- approval-bypass decision logic
- person creation only after verification
- return/completion frees capacity
- overdue derived-state logic

### 17.3 API tests

- public hub/detail APIs
- verification creation and consumption
- internal queue listing
- approve booking
- deny booking
- grant access and approve
- return asset

Suggested file split:
- `tests/api/community/asset-access-settings.test.ts`
- `tests/api/community/asset-access-public.test.ts`
- `tests/api/community/asset-access-review.test.ts`
- `tests/api/community/asset-access-return.test.ts`

### 17.4 Permission tests

- owner/admin full access
- assigned staff manage assigned assets only
- unassigned staff denied manage
- unauthorized roles denied

Suggested file:
- `tests/permissions/asset-access-permissions.test.ts`

### 17.5 Loanable and capacity tests

- `concurrent_capacity = 1`: second booking rejected while first is active
- `concurrent_capacity = 3`: fourth booking rejected while three are active
- return (`completed`) frees one capacity slot
- `pending` bookings consume capacity
- overdue does not free capacity
- `return_required` assets stay `confirmed` until manually completed

### 17.6 Security tests

- expired token rejected
- reused token rejected
- rate limits enforced
- unverified email cannot bypass
- verified approved email can bypass
- booking_owner_user_id must be active project member

### 17.7 Email and notification tests

- verification email sent on submission
- confirmation email with ICS sent on auto-confirm and manual approval
- queued email sent on pending review
- denial email contains no internal notes
- approver notification sent on new pending request

### 17.8 Regression tests

- existing person scheduling still works (slot engine branching is clean)
- existing public events still work
- existing community asset CRUD still works (new columns have defaults)
- booking owner's personal scheduling is not affected by asset bookings

Suggested file:
- `tests/api/community/asset-access-regression.test.ts`

### 17.9 Manual smoke checklist

Run this before first production rollout:

1. Create a `tracked_only` asset and confirm it does not appear publicly.
2. Convert an asset to `reservable`, add a preset, enable access, and confirm it appears on the public hub.
3. Submit a public request, verify the email, and confirm auto-confirm works for `open_auto`.
4. Change the asset to `open_review`, submit again, and confirm the request lands in the Community Assets queue.
5. Approve once as assigned staff and confirm an unassigned staff member is blocked.
6. Grant `Approved For` to a person and confirm `approved_only` bypasses manual review after verification.
7. Create two overlapping bookings on the same asset and confirm the second one is rejected at capacity `1`.
8. Create overlapping bookings on different assets with the same booking owner and confirm both succeed.
9. Mark a `loanable` asset returned and confirm capacity frees only after return.
10. Confirm `/book/[profileSlug]` still offers normal person scheduling.

---

## 18. Out of Scope for V1

- payments
- memberships or subscriptions
- arbitrary duration entry
- recurring standing reservations
- guest self-service dashboard
- usage billing
- waitlists
- multi-asset bookings
- personal calendar sync for asset access
