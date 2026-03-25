# Public Event Calendar & Registration PRD

**Version:** 1.0
**Date:** 2026-03-25
**Status:** Ready for Implementation

---

## 1. Overview

A public-facing event calendar with registration for community projects, replacing the need for Eventbrite. Events are project-scoped, publicly discoverable, date-bound occurrences with capacity management, ticket types, and self-service registration.

**Two event modes:**
1. **Standalone events** — one-off galas, fundraisers, workshops (no program link)
2. **Program-linked recurring events** — a program defines a recurrence rule (e.g., "every Tuesday 6-8pm, Jan-May"). The system auto-generates individual event instances, each with its own registration and attendance. Registering for any event auto-enrolls the person in the parent program.

**Scope constraints:**
- Free events only (no Stripe/payments). `price_cents` column exists for future-proofing.
- Community projects only (`project_type='community'`).
- URL structure: `/events/[calendarSlug]` top-level public path.

---

## 2. Features

### 2.1 Event Management (Admin)

- Create, edit, publish, duplicate, cancel, and delete events
- Draft/published/cancelled/postponed/completed status lifecycle
- Public/unlisted/private visibility controls
- Cover image upload
- Category and tags
- In-person, virtual, or hybrid location types with venue details and map coordinates
- Custom registration questions (text, textarea, select, radio, checkbox, phone, email)
- Configurable capacity, waitlist, and approval settings
- `add_to_crm` toggle: when true, registrants auto-added as CRM contacts via `matchOrCreateContact()`
- Attach one or more waiver templates (from existing `contract_templates`) that registrants must sign

### 2.2 Ticket Types

- Multiple ticket tiers per event (e.g., "General Admission", "VIP")
- Per-type quantity limits and per-order max
- Sales windows (start/end dates)
- Active/hidden toggles
- All free for now (`price_cents = 0`)

### 2.3 Recurring Event Series

- **Series template**: Holds recurrence rule + template fields (time, location, capacity, ticket types)
- **Recurrence patterns**: Daily, weekly, biweekly, monthly
- **Positional recurrence**: "1st Tuesday", "2nd Wednesday", "last Friday" via RRULE `BYDAY` + `BYSETPOS`
- **Instance generation**: Materializes individual `events` rows from the recurrence rule. Each instance has its own registrations, capacity, and attendance.
- **Instance editing**: Individual instances can be edited (different time, location, capacity) without affecting the series template. `series_instance_modified` flag prevents template updates from overwriting.
- **Instance cancellation**: Cancel individual instances without affecting the series.
- **Generation strategy**: Auto-generate instances for the program's date range or a configurable horizon (default 90 days). Cron job extends the horizon as needed.
- **Program linkage**: `event_series.program_id` links to a program. Registering for any instance auto-enrolls the person in the program.
- **Library**: `rrule` npm package for RFC 5545 recurrence expansion.

### 2.4 Registration

#### Public Self-Registration
- Multi-step registration form: ticket selection → contact info → custom questions → confirm
- Atomic registration via `register_for_event` SECURITY DEFINER RPC with `pg_advisory_xact_lock`
- Capacity check counts **tickets** (not registrations) — one registration can have multiple tickets
- Rate limiting: IP 10/hr, email 5/day via existing `checkRateLimit()`
- If event has waivers: registration created as `pending_waiver` → waiver emails sent automatically → registrant signs via `/sign/[token]` → all signed → status promoted to `confirmed`
- If event has NO waivers: registration is `confirmed` immediately
- Confirmation page uses token-based routing: `/events/confirmation/[token]` (fetches details server-side — more secure than query params, no PII in URL)
- **Add to Calendar** buttons on confirmation page and public event detail page:
  - **Google Calendar**: Direct link via `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...` (no API needed, works for anyone)
  - **Apple Calendar / Outlook / Other**: `.ics` file download via `/api/events/ics?token={confirmation_token}` (uses existing `generateIcs()` from `lib/calendar/ics.ts`). ICS files are universally supported — Apple Calendar, Outlook, Yahoo Calendar, etc. all import `.ics` natively.
  - **Public event page** (pre-registration): "Add to Calendar" dropdown with Google Calendar link + `.ics` download. Uses event slug instead of token: `/api/events/ics?calendar={calendarSlug}&event={eventSlug}`. No auth needed — public events are public.
  - **Confirmation email**: Include both Google Calendar link and `.ics` attachment (already planned via `generateIcs()`)
- Token-based cancellation via `/events/cancel/[token]`

#### Series Registration
- Register for entire series: creates `event_series_registrations` row + individual `event_registrations` for all future published instances
- New instances auto-get registrations for series registrants
- Cancel series registration: cancels all future instance registrations; past/checked-in left as-is
- Per-instance capacity: if one instance is full, series registrant is waitlisted for that instance but confirmed for others

#### Admin Manual Registration
- Add registrants via `PersonCombobox` (search existing people)
- Walk-in support: create registration with `source: 'manual'`

### 2.5 Waitlist

- Enabled per event via `waitlist_enabled` toggle
- When capacity is full: new registrations get `waitlisted` status
- On cancellation: oldest waitlisted registration auto-promoted to `confirmed`
- Promotion triggers notification email with ICS attachment

### 2.6 Check-in & Attendance

#### QR Code Check-in
- Each ticket gets a unique QR code (`qr_code` column with `qrcode.react`)
- Check-in via QR scan or manual lookup by registration ID
- Sets `checked_in_at` and `checked_in_by`

#### Admin Batch Attendance
- Batch attendance grid (reusing `BatchAttendance` component pattern from programs)
- Status options: present/absent/excused
- "Mark All Present" bulk action
- Non-registered walk-ins: search existing people or create new person inline

#### Program Attendance Bridge
- When an event instance is linked to a program and a registrant is checked in:
  - Auto-create/update `program_attendance` row for that person + date
  - Uses upsert on `program_attendance_unique` constraint

#### Sign-in Sheet OCR Scanning
- **Upload**: Admin uploads photo/scan of handwritten sign-in sheet
- **OCR**: Server-side via OpenRouter API, reusing the existing pattern from `lib/assistant/ocr.ts` (receipt OCR). Uses `getProjectSecret(projectId, 'openrouter_api_key')` for auth. Model: `openai/gpt-4o-mini` for images (proven for handwriting in receipt OCR). Image converted to base64 data URL and sent as `image_url` content type. No new dependencies needed — `@anthropic-ai/sdk` is NOT used.
- **Fuzzy matching**: Each parsed name matched against project's people using `jaroWinkler()` from `lib/deduplication/detector.ts`
  - \>0.85 confidence = auto-match
  - 0.65-0.85 = suggested match (admin confirms)
  - <0.65 = no match (create new person)
- **Admin review**: Presented with match results, can correct/confirm
- **Confirmation**: Creates new people for unmatched names, marks attendance for all
- Rate limit: 10 scans per event per day

### 2.7 Event Feedback & Observations

- Extends existing polymorphic `notes` table with `event_id` + `category` columns
- Categories: `feedback` (from attendees/stakeholders), `observation` (staff observations), `general`
- Visible on event detail page in "Feedback & Observations" tab
- Uses existing `NotesPanel` component with category filter tabs
- Admin-only (not shown on public event pages)

### 2.8 Attendance Reporting

**Metrics:**
- Total registrations vs. actual attendees (show-up rate)
- Capacity utilization (registered / total_capacity)
- New vs. returning attendees
- Trend comparisons: WoW, MoM, YoY

**Report locations:**
1. **Event detail page**: "Analytics" tab — registration and attendance for this event
2. **Program detail page**: "Analytics" tab — aggregated attendance across all events in the program series with trend charts
3. **Community reports page**: "Event & Program Attendance" report type with date range filter

**Charts**: recharts `AreaChart` for trends, `BarChart` for comparisons (matching existing `revenue-area-chart.tsx` pattern).

### 2.9 Public Calendar

- Month calendar view (FullCalendar, already installed) + list view toggle
- Filterable by category
- Event cards: title, date/time, location, capacity remaining
- `generateMetadata()` for SEO/OpenGraph on all public pages
- Embed support: `/events/embed/[calendarSlug]` with iframe-permissive headers
- `postMessage` on registration for parent frame communication

### 2.10 Notifications

- **Confirmation email**: HTML email with event details + cancel link + ICS attachment
- **Cancellation email**: Sent to registrant on cancellation
- **Waitlist promotion email**: Sent when promoted, includes ICS
- **24h and 1h reminders**: Via extended booking-reminders cron
- **In-app notification**: Created for project admin on new registration (`type: 'event_registration'`)
- **Gmail connection**: Project-scoped lookup — query `gmail_connections` joined with `project_memberships`, prefer owner then admin. Skip email if none found.

### 2.11 CRM Integration

- **Person creation**: Via `matchOrCreateContact()` when `add_to_crm = true`
- **Program enrollment**: Auto-created when event is linked to a program and person exists
- **Automation events**: All mutations emit via `emitAutomationEvent()`
- **Google Calendar sync**: Published events sync when `project.calendar_sync_enabled`
- **MCP tools**: Full CRUD for events, registrations, ticket types, series
- **Chat tools**: AI chat agent can manage events via `defineCommunityTool()` pattern

### 2.12 Waivers

Events reuse the existing contract/waiver infrastructure built for programs. Admins can require one or more waivers per event, selecting from existing `contract_templates` (category `'waiver'`). The same `CreateWaiverTemplateDialog` (write WYSIWYG or upload PDF) is reused on the event detail page.

**Schema model** (mirrors `program_waivers` / `enrollment_waivers`):
- `event_waivers` join table links `contract_templates` → `events` (like `program_waivers` → `programs`)
- `registration_waivers` tracks per-registration, per-waiver signing status (like `enrollment_waivers` → `program_enrollments`)
- `events.requires_waiver` is auto-synced via trigger (same pattern as `sync_program_requires_waiver()`)

**Registration flow with waivers:**
1. Registrant completes registration form on public page
2. If event has waivers: registration status is set to `pending_waiver` (not `confirmed`)
3. After RPC returns, `createWaiversForRegistration()` fires — creates `contract_document` per waiver template, adds registrant as `contract_recipient`, sends signing email via connected Gmail
4. Registrant clicks `/sign/{token}` link → consent → sign → submit (existing public signing flow, no changes needed)
5. On completion, `syncRegistrationFromCompletedWaiver()` checks if all `registration_waivers` are signed → promotes registration from `pending_waiver` to `confirmed`
6. If event is program-linked, the program enrollment auto-created during registration also gets its waivers via the existing program waiver flow

**Standalone events (no program link):**
- Waivers are event-scoped via `event_waivers`. Admin selects templates on event detail page.
- Signing flow is identical to program waivers — same `/sign/[token]` page, same contract infrastructure.

**Program-linked events:**
- The event can have its OWN waivers (via `event_waivers`) AND the program can have separate waivers (via `program_waivers`).
- When a person registers for a program-linked event: event waivers are created for the registration, and program waivers are created for the auto-enrollment. Both must be signed independently.
- Common case: admin configures waivers on the program only, and events inherit the requirement via `autoEnrollInProgram()`. No need to duplicate waivers on every event instance.

**Admin UI:**
- Event detail page "Waivers" tab:
  - List linked waiver templates with status (active template count)
  - "Add Existing Waiver" dropdown — select from project's existing `contract_templates` where `category = 'waiver'`, creates `event_waivers` link
  - "Create New Waiver" button → opens `CreateWaiverTemplateDialog` with `eventId` prop (supports both WYSIWYG "write" mode for lightweight waivers and PDF "upload" mode). On creation, template is auto-linked to event via `event_waivers`.
  - Remove waiver button per template (DELETE from `event_waivers`)
- Registration detail shows waiver status per waiver (signed/pending) with links to view signed documents

**`add_to_crm = false` handling:**
- When `add_to_crm = false`, no person record exists (`person_id` is null on the registration)
- Unlike `createWaiverForEnrollment()` which returns early when `personId` is null, `createWaiverForRegistration()` must use `registrant_email` and `registrant_name` from the registration record directly
- The waiver email is sent to `registrant_email`, the contract recipient uses `registrant_name`

**Lightweight waiver flow:**
- Waivers created via WYSIWYG editor store `html_content` on `contract_templates` (migration 0148)
- `createWaiverForRegistration()` passes `template.html_content` through `custom_fields` on the `contract_document`
- The signing page renders HTML directly with checkbox + type-name-to-sign (no PDF viewer needed)
- This lightweight flow is the default for community waivers — simpler and more family-friendly

**Key reuse:**
- `createWaiverForEnrollment()` from `lib/community/waivers.ts` — adapted to `createWaiverForRegistration()` in `lib/events/waivers.ts` (same logic, but handles null `person_id` by falling back to `registrant_email`/`registrant_name`)
- `syncEnrollmentFromCompletedWaiver()` — adapted to `syncRegistrationFromCompletedWaiver()` (same pattern: check all waivers signed → promote status)
- `CreateWaiverTemplateDialog` — reused with `eventId` prop
- `WaiverEditor` — reused as-is
- `/sign/[token]` flow — **requires update**: signing page GET route hardcodes `kind === 'program_waiver'` for lightweight waiver detection (line 92 of `app/api/sign/[token]/route.ts`). Must change to `typeof customFields?.html_content === 'string'` so event waivers with HTML also get the lightweight flow.
- `htmlToPdf()` from `lib/contracts/html-to-pdf.ts` — reused as-is. Note: waivers created via WYSIWYG now also store `html_content` on `contract_templates` (migration 0148) for lightweight rendering. The PDF is still generated for archival, but the signing page renders HTML directly when `html_content` is available.

---

## 3. Database Schema

### Migration: `0149_events_calendar.sql`

All tables use `IF NOT EXISTS`, `handle_updated_at()` trigger, and RLS enabled.

### 3.1 `event_calendar_settings`

1:1 per project. Public URL configuration and branding.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL FK → projects | UNIQUE |
| is_enabled | BOOLEAN DEFAULT FALSE | |
| slug | TEXT NOT NULL UNIQUE | Public URL segment. Format: `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (min 2 chars). Zod validator must use `.min(2)` to match. |
| title | TEXT DEFAULT 'Events' | |
| description | TEXT | |
| logo_url | TEXT | |
| primary_color | TEXT DEFAULT '#3b82f6' | |
| timezone | TEXT DEFAULT 'America/Denver' | |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.2 `event_series`

Recurrence template. Generates individual event instances.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL FK → projects | |
| program_id | UUID FK → programs ON DELETE SET NULL | |
| created_by | UUID FK → users ON DELETE SET NULL | Nullable (not NOT NULL) |
| title | TEXT NOT NULL | Template title inherited by instances |
| description, description_html | TEXT | |
| recurrence_frequency | TEXT NOT NULL | CHECK: daily, weekly, biweekly, monthly |
| recurrence_days_of_week | TEXT[] DEFAULT '{}' | RFC 5545 day codes: MO, TU, WE, etc. |
| recurrence_interval | INTEGER DEFAULT 1 | Every N frequency units |
| recurrence_until | DATE | End date (null = use program end_date or manual) |
| recurrence_count | INTEGER | Max occurrences (alternative to until) |
| recurrence_day_position | INTEGER | For monthly: 1=1st, 2=2nd, 3=3rd, 4=4th, 5=last |
| template_start_time | TIME NOT NULL | e.g., '18:00:00' |
| template_end_time | TIME NOT NULL | e.g., '20:00:00' |
| timezone | TEXT DEFAULT 'America/Denver' | |
| location_type | TEXT DEFAULT 'in_person' | CHECK: in_person, virtual, hybrid |
| venue_name, venue_address | TEXT | |
| venue_latitude, venue_longitude | DOUBLE PRECISION | |
| virtual_url | TEXT | |
| registration_enabled | BOOLEAN DEFAULT TRUE | |
| total_capacity | INTEGER | null = unlimited |
| waitlist_enabled | BOOLEAN DEFAULT FALSE | |
| max_tickets_per_registration | INTEGER DEFAULT 10 | |
| require_approval | BOOLEAN DEFAULT FALSE | |
| custom_questions | JSONB NOT NULL DEFAULT '[]' | |
| cover_image_url, category | TEXT | |
| tags | TEXT[] DEFAULT '{}' | |
| visibility | TEXT DEFAULT 'public' | CHECK: public, unlisted, private |
| confirmation_message, cancellation_policy | TEXT | |
| organizer_name, organizer_email | TEXT | |
| last_generated_date | DATE | Tracks generation progress |
| generation_horizon_days | INTEGER DEFAULT 90 | |
| status | TEXT DEFAULT 'draft' | CHECK: draft, active, paused, completed |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.3 `event_series_registrations`

Whole-series registration tracking.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| series_id | UUID NOT NULL FK → event_series | |
| person_id | UUID FK → people ON DELETE SET NULL | |
| registrant_name | TEXT NOT NULL | |
| registrant_email | TEXT NOT NULL | |
| registrant_phone | TEXT | |
| status | TEXT DEFAULT 'active' | CHECK: active, cancelled |
| responses | JSONB NOT NULL DEFAULT '{}' | |
| cancel_token | TEXT UNIQUE | Auto-generated |
| source | TEXT DEFAULT 'web' | CHECK: web, embed, api, manual, import |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.4 `events`

Core events table. Can be standalone or series instances.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL FK → projects | |
| program_id | UUID FK → programs ON DELETE SET NULL | |
| series_id | UUID FK → event_series ON DELETE SET NULL | null = standalone |
| series_index | INTEGER | Ordinal in series (1, 2, 3...) |
| series_instance_modified | BOOLEAN DEFAULT FALSE | True if individually edited |
| created_by | UUID FK → users ON DELETE SET NULL | Nullable |
| title | TEXT NOT NULL | |
| slug | TEXT NOT NULL | UNIQUE per (project_id, slug) |
| description, description_html | TEXT | |
| cover_image_url, category | TEXT | |
| tags | TEXT[] DEFAULT '{}' | |
| starts_at | TIMESTAMPTZ NOT NULL | |
| ends_at | TIMESTAMPTZ NOT NULL | CHECK: ends_at > starts_at |
| timezone | TEXT DEFAULT 'America/Denver' | |
| is_all_day | BOOLEAN DEFAULT FALSE | |
| location_type | TEXT DEFAULT 'in_person' | CHECK: in_person, virtual, hybrid |
| venue_name, venue_address | TEXT | |
| venue_latitude, venue_longitude | DOUBLE PRECISION | |
| virtual_url | TEXT | |
| registration_enabled | BOOLEAN DEFAULT TRUE | |
| registration_opens_at, registration_closes_at | TIMESTAMPTZ | |
| total_capacity | INTEGER | null = unlimited. CHECK: > 0 |
| waitlist_enabled | BOOLEAN DEFAULT FALSE | |
| max_tickets_per_registration | INTEGER DEFAULT 10 | |
| require_approval | BOOLEAN DEFAULT FALSE | |
| add_to_crm | BOOLEAN DEFAULT TRUE | |
| custom_questions | JSONB NOT NULL DEFAULT '[]' | |
| status | TEXT DEFAULT 'draft' | CHECK: draft, published, cancelled, postponed, completed |
| visibility | TEXT DEFAULT 'public' | CHECK: public, unlisted, private |
| published_at | TIMESTAMPTZ | |
| organizer_name, organizer_email | TEXT | |
| confirmation_message, cancellation_policy | TEXT | |
| requires_waiver | BOOLEAN DEFAULT FALSE | Auto-synced via trigger from `event_waivers` rows. No `waiver_template_id` column — use `event_waivers` join table instead. |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.5 `event_ticket_types`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID NOT NULL FK → events | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| price_cents | INTEGER DEFAULT 0 | CHECK: >= 0. Always 0 for now. |
| currency | TEXT DEFAULT 'usd' | |
| quantity_available | INTEGER | null = unlimited. CHECK: > 0 |
| max_per_order | INTEGER DEFAULT 10 | |
| sort_order | INTEGER DEFAULT 0 | |
| sales_start_at, sales_end_at | TIMESTAMPTZ | |
| is_active | BOOLEAN DEFAULT TRUE | |
| is_hidden | BOOLEAN DEFAULT FALSE | |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.6 `event_registrations`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID NOT NULL FK → events | |
| series_registration_id | UUID FK → event_series_registrations ON DELETE SET NULL | |
| person_id | UUID FK → people ON DELETE SET NULL | |
| registrant_name | TEXT NOT NULL | |
| registrant_email | TEXT NOT NULL | |
| registrant_phone | TEXT | |
| status | TEXT DEFAULT 'confirmed' | CHECK: pending_approval, pending_waiver, confirmed, waitlisted, cancelled |
| responses | JSONB NOT NULL DEFAULT '{}' | |
| confirmation_token | TEXT UNIQUE | Auto-generated |
| cancel_token | TEXT UNIQUE | Auto-generated |
| checked_in_at | TIMESTAMPTZ | |
| checked_in_by | UUID FK → users ON DELETE SET NULL | |
| waiver_status | TEXT DEFAULT 'not_required' | CHECK: not_required, pending, signed |
| waiver_signed_at | TIMESTAMPTZ | |
| reminder_sent_24h, reminder_sent_1h | BOOLEAN DEFAULT FALSE | |
| source | TEXT DEFAULT 'web' | CHECK: web, embed, api, manual, import |
| ip_address | TEXT | TEXT not INET — x-forwarded-for may be null/malformed |
| user_agent | TEXT | |
| created_at, updated_at | TIMESTAMPTZ | |

### 3.7 `event_registration_tickets`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| registration_id | UUID NOT NULL FK → event_registrations | |
| ticket_type_id | UUID NOT NULL FK → event_ticket_types ON DELETE RESTRICT | |
| attendee_name, attendee_email | TEXT | |
| qr_code | TEXT UNIQUE | Auto-generated |
| checked_in_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### 3.8 `event_waivers`

Join table linking contract templates to events as required waivers. Mirrors `program_waivers` pattern exactly.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID NOT NULL FK → events ON DELETE CASCADE | |
| template_id | UUID NOT NULL FK → contract_templates ON DELETE CASCADE | |
| created_at, updated_at | TIMESTAMPTZ | |

UNIQUE constraint on `(event_id, template_id)`.

**Auto-sync trigger** (mirrors `sync_program_requires_waiver()`):
```sql
CREATE OR REPLACE FUNCTION public.sync_event_requires_waiver()
RETURNS TRIGGER AS $$
DECLARE target_event_id UUID;
BEGIN
  target_event_id := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.events
  SET requires_waiver = EXISTS(
    SELECT 1 FROM public.event_waivers WHERE event_id = target_event_id
  )
  WHERE id = target_event_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### 3.9 `registration_waivers`

Per-registration, per-waiver signing status. Mirrors `enrollment_waivers` pattern exactly.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| registration_id | UUID NOT NULL FK → event_registrations ON DELETE CASCADE | |
| event_waiver_id | UUID NOT NULL FK → event_waivers ON DELETE CASCADE | |
| contract_document_id | UUID FK → contract_documents ON DELETE SET NULL | |
| signed_at | TIMESTAMPTZ | null = pending, non-null = signed |
| created_at, updated_at | TIMESTAMPTZ | |

UNIQUE constraint on `(registration_id, event_waiver_id)`.

**RLS**: Access via event's project_id through `event_waivers` → `events` join, using `community_has_permission(project_id, 'events', 'view'/'create')`.

### 3.10 Schema Modifications to Existing Tables

**`notes` table (migration 0024):**
- ADD COLUMN `event_id UUID REFERENCES public.events(id) ON DELETE CASCADE`
- ADD COLUMN `category TEXT` (values: feedback, observation, general)
- ADD INDEX on `event_id`

**`notifications` table (migration 0034):**
- ALTER CHECK constraint on `type` column to add `'event_registration'` and `'event_reminder'`

**Storage:**
- Create `event-covers` bucket (`public: true`) with RLS policy

### 3.11 RPCs

#### `register_for_event` (SECURITY DEFINER)

Atomic registration with capacity check. Uses `pg_advisory_xact_lock(hashtext(event_id::text))` to serialize concurrent registrations.

**Parameters:** `p_event_id UUID, p_registrant_name TEXT, p_registrant_email TEXT, p_registrant_phone TEXT, p_ticket_selections JSONB, p_responses JSONB, p_source TEXT, p_ip_address TEXT, p_user_agent TEXT`

**Returns:** UUID (registration ID)

**Logic:**
1. Validate event exists, is published, registration enabled, within registration window
2. Validate ticket selections non-empty and belong to this event
3. Acquire advisory lock
4. Count total tickets (not registrations) for capacity check
5. Check per-ticket-type availability (active, within sales window, quantity)
6. Check `max_tickets_per_registration` (event-level cap across all ticket types)
7. Determine status (**priority order — capacity checked FIRST**):
   - If capacity full + `waitlist_enabled` → `waitlisted` (regardless of waivers/approval)
   - If capacity full + no waitlist → RAISE EXCEPTION `CAPACITY_FULL`
   - If `require_approval` → `pending_approval` (takes precedence over waiver)
   - If `requires_waiver` → `pending_waiver`
   - Otherwise → `confirmed`
8. INSERT registration + tickets
9. Return registration ID. Waiver creation happens in the API route AFTER the RPC returns (not inside the RPC).

**Note:** Waitlisted registrations do NOT get waivers sent. Waivers are only sent when a registration is `pending_waiver` or promoted from waitlist to `pending_waiver`. When a waitlisted registration is promoted via `promoteFromWaitlist()`, the promotion function checks if the event has waivers and sets status to `pending_waiver` (not `confirmed`) if so.

**IMPORTANT:** The `event_registrations` CHECK constraint must include `pending_waiver` alongside the other status values. The plan file's RPC SQL omits it — make sure the migration CREATE TABLE has: `CHECK (status IN ('pending_approval', 'pending_waiver', 'confirmed', 'waitlisted', 'cancelled'))`.

**Error pattern:** `RAISE EXCEPTION 'ERROR_CODE: message'` — caller parses via `error.message.includes('ERROR_CODE')`.

**Error codes:** `EVENT_NOT_FOUND`, `REGISTRATION_CLOSED`, `INVALID_INPUT`, `INVALID_TICKET_TYPE`, `TICKET_SOLD_OUT`, `CAPACITY_FULL`

**Grants:** `service_role` only (public routes use `createServiceClient()`).

#### `get_public_events` / `get_public_event_detail` (SECURITY DEFINER)

Public-facing event listing and detail. Join calendar settings with events where `status='published'` and `visibility='public'` (detail also allows `'unlisted'`). Include registration counts and remaining capacity.

### 3.12 RLS Policies

All tables get RLS enabled + service_role bypass.

Community tables use `community_has_permission(project_id, 'events', action)`. The migration **must update** the `community_has_permission()` function to add `'events'` as a valid resource with role permissions:
- owner/admin: view, create, update, delete, export_pii, manage
- staff/case_manager: view, create, update
- contractor/board_viewer: NO_ACTIONS

Public registration goes through SECURITY DEFINER RPCs (bypasses RLS).

### 3.13 Indexes

- `idx_events_project_status (project_id, status)`
- `idx_events_starts_at (starts_at)`
- `idx_events_program_id (program_id)`
- `idx_events_series_id (series_id)`
- `idx_event_registrations_event (event_id, status)`
- `idx_event_registrations_email (registrant_email)`
- `idx_event_registrations_person (person_id)`
- `idx_event_registrations_cancel_token (cancel_token)`
- `idx_event_registrations_confirmation_token (confirmation_token)`
- `idx_event_reg_tickets_registration (registration_id)`
- `idx_event_reg_tickets_qr (qr_code)`
- `idx_event_series_project (project_id)`
- `idx_event_series_program (program_id)`
- `idx_event_series_reg_series (series_id)`
- `idx_event_series_reg_email (registrant_email)`
- `idx_event_ticket_types_event (event_id)`
- `idx_event_waivers_event (event_id)`
- `idx_registration_waivers_registration (registration_id)`
- `idx_registration_waivers_contract (contract_document_id)`

---

## 4. API Routes

### 4.1 Admin Routes — `/api/projects/[slug]/events/`

All follow the pattern from `programs/route.ts`: auth → project lookup → RBAC → Zod validation → query → automation → respond.

| Route | Methods | RBAC | Notes |
|---|---|---|---|
| `route.ts` | GET, POST | view/create | Pagination, search, status/category filter |
| `[id]/route.ts` | GET, PATCH, DELETE | view/update/delete | Includes registration count + ticket types |
| `[id]/publish/route.ts` | POST | update | Toggle published/draft |
| `[id]/duplicate/route.ts` | POST | create | Clone event + ticket types |
| `[id]/ticket-types/route.ts` | GET, POST | view/create | |
| `[id]/ticket-types/[tid]/route.ts` | PATCH, DELETE | update/delete | |
| `[id]/registrations/route.ts` | GET | view | Pagination + search + status filter |
| `[id]/registrations/[rid]/route.ts` | GET, PATCH | view/update | Status change, manual check-in |
| `[id]/check-in/route.ts` | POST | update | QR code or registration ID lookup |
| `[id]/export/route.ts` | GET | export_pii | CSV download via `rowsToCsv()` |
| `[id]/upload-cover/route.ts` | POST | update | Multipart form, jpeg/png/webp, ≤5MB |
| `[id]/attendance/route.ts` | GET, POST | view/update | Batch attendance + program bridge |
| `[id]/scan-attendance/route.ts` | POST | update | Sign-in sheet OCR via Claude Vision |
| `[id]/confirm-attendance/route.ts` | POST | update | Confirm OCR matches, create people |
| `[id]/notes/route.ts` | GET, POST | view/create | Event feedback/observations |
| `[id]/notes/[noteId]/route.ts` | PATCH, DELETE | update/delete | |
| `[id]/waivers/route.ts` | GET, POST, DELETE | view/create/delete | List linked waivers, add template as waiver, remove waiver. POST backfills `registration_waivers` for existing registrations (mirrors program_waivers POST). DELETE accepts `waiverId` query param. |
| `[id]/registrations/[rid]/waivers/route.ts` | GET | view | List `registration_waivers` for a registration with signing status |
| `series/route.ts` | GET, POST | view/create | Series CRUD + auto-generate instances |
| `series/[seriesId]/route.ts` | GET, PATCH, DELETE | view/update/delete | Template update propagates to future instances |
| `series/[seriesId]/generate/route.ts` | POST | update | Manual instance generation |
| `series/[seriesId]/registrations/route.ts` | GET | view | Series-level registrations |
| `calendar-settings/route.ts` | GET, PUT | manage | Upsert on `project_id` conflict |

### 4.2 Public Routes — `/api/events/`

All use `createServiceClient()` (sync, no await). No auth required.

| Route | Methods | Rate Limit | Notes |
|---|---|---|---|
| `[calendarSlug]/route.ts` | GET | no | Public event listing |
| `[calendarSlug]/[eventSlug]/route.ts` | GET | no | Public event detail |
| `register/route.ts` | POST | IP: 10/hr, Email: 5/day | Registration flow (see §2.4) |
| `register-series/route.ts` | POST | IP: 10/hr, Email: 5/day | Series registration |
| `cancel/route.ts` | POST | no | Token-based cancellation |
| `ics/route.ts` | GET | no | ICS file download. Two modes: (1) `?token={confirmation_token}` — registrant's personalized ICS with their name as attendee. (2) `?calendar={calendarSlug}&event={eventSlug}` — public event ICS for "Add to Calendar" on public pages (no registration needed). Returns `Content-Type: text/calendar`, `Content-Disposition: attachment; filename=event.ics`. |

---

## 5. Pages

### 5.1 Admin Pages — `app/(dashboard)/projects/[slug]/events/`

| Page | Description |
|---|---|
| `page.tsx` | Event list with calendar/list toggle (FullCalendar), status tabs, search, create button |
| `[id]/page.tsx` | Event detail with tabs: Info, Registrations, Attendance, Waivers, Feedback & Observations, Analytics, Check-in |
| `settings/page.tsx` | Calendar settings: enable/disable, slug, branding, timezone |

### 5.2 Public Pages — `app/events/`

| Page | Description |
|---|---|
| `layout.tsx` | Minimal layout matching `app/book/layout.tsx` — "Powered by GoodRev" footer |
| `[calendarSlug]/page.tsx` | Calendar + list view, category filter. `generateMetadata()` for SEO. |
| `[calendarSlug]/[eventSlug]/page.tsx` | Event detail + multi-step registration form. `generateMetadata()` with OpenGraph. |
| `[calendarSlug]/series/[seriesSlug]/page.tsx` | Series overview with schedule and "Register for Entire Series" |
| `cancel/[token]/page.tsx` | Token-based cancellation confirmation |
| `confirmation/[token]/page.tsx` | Confirmation details, ICS download, cancel link |
| `embed/[calendarSlug]/page.tsx` | Embeddable calendar (iframe) |
| `embed/[calendarSlug]/[eventSlug]/page.tsx` | Embeddable registration form with `postMessage` on success |

---

## 6. Integration Points

### 6.1 Existing Code Reused (Import Directly)

| What | Source | Usage |
|---|---|---|
| Rate limiting | `checkRateLimit()` from `lib/calendar/service.ts` | Public registration routes |
| ICS generation | `generateIcs()` from `lib/calendar/ics.ts` | Confirmation emails, ICS download |
| Person creation | `matchOrCreateContact()` from `lib/calendar/crm-bridge.ts` | Registration CRM bridge |
| Email sending | `sendEmail()` from `lib/gmail/service.ts` | All notification emails |
| Slug generation | `generateSlug()` from `lib/validation-helpers.ts` | Event/series slug creation |
| Custom questions | `customQuestionSchema` from `lib/validators/calendar.ts` | Event custom questions |
| Fuzzy matching | `jaroWinkler()`, `scorePersonMatch()` from `lib/deduplication/detector.ts` | Sign-in sheet name matching |
| OCR infrastructure | `callOpenRouterForJson()` pattern from `lib/assistant/ocr.ts`, `getProjectSecret()` from `lib/secrets.ts` | Sign-in sheet handwriting extraction via OpenRouter (gpt-4o-mini). Reuse the image→base64→data URL→image_url content pattern. |
| CSV export | `rowsToCsv()` from `lib/reports/csv-export.ts` | Registration export |
| Publish controls | `PublishControls` from `components/community/public-dashboard/publish-controls.tsx` | Draft/publish toggle |
| Person search | `PersonCombobox` from `components/ui/person-combobox.tsx` | Manual registration |
| Notes panel | `NotesPanel` from `components/notes/notes-panel.tsx` | Event feedback/observations |
| Charts | recharts + `components/ui/chart.tsx` | Attendance trend charts |
| Waiver creation | `createWaiverForEnrollment()` from `lib/community/waivers.ts` | Pattern adapted for `createWaiverForRegistration()` in `lib/events/waivers.ts` |
| Waiver sync | `syncEnrollmentFromCompletedWaiver()` from `lib/community/waivers.ts` | Pattern adapted for `syncRegistrationFromCompletedWaiver()` |
| Waiver template dialog | `CreateWaiverTemplateDialog` from `components/community/programs/create-waiver-template-dialog.tsx` | Reused on event detail page with `eventId` prop |
| Waiver editor | `WaiverEditor` from `components/community/programs/waiver-editor.tsx` | Reused as-is |
| HTML to PDF | `htmlToPdf()` from `lib/contracts/html-to-pdf.ts` | Reused for WYSIWYG waiver generation |
| Public signing | `/sign/[token]` page + `contract_documents`/`contract_recipients` | Reused as-is — entity-agnostic signing flow |

### 6.2 Files to Modify

| File | Change |
|---|---|
| `middleware.ts` | Add `/events` to publicRoutes, embed iframe headers |
| `lib/projects/community-permissions.ts` | Add `'events'` to `CommunityResource`, permission matrix |
| `types/automation.ts` | Add entity types and trigger types for events |
| `types/community.ts` | Add event-related interfaces and type unions |
| `components/layout/project-sidebar.tsx` | Add "Events" nav item (CalendarDays icon) |
| `hooks/use-chat.ts` | Add event tools to `MUTATING_TOOLS` |
| `components/chat/chat-message-list.tsx` | Add events to `TOOL_COLORS` |
| `components/chat/chat-settings.tsx` | Add Events tool group |
| `lib/chat/system-prompt.ts` | Add events description |
| `app/api/cron/booking-reminders/route.ts` | Extend with event reminders + series instance generation |
| `lib/assistant/calendar-bridge.ts` | Add `syncEvent()` for Google Calendar sync |
| `lib/community/reports.ts` | Add `generateAttendanceTrendReport()` |
| `app/api/sign/[token]/route.ts` | Change lightweight waiver detection from `kind === 'program_waiver'` to `typeof customFields?.html_content === 'string'` so event waivers also get HTML rendering |
| `app/api/sign/[token]/submit/route.ts` | Add dispatch for event waivers: if `custom_fields.kind === 'event_waiver'`, call `syncRegistrationFromCompletedWaiver()` alongside existing `syncEnrollmentFromCompletedWaiver()` call |
| `components/community/programs/create-waiver-template-dialog.tsx` | Add optional `eventId` prop alongside existing `programId`. Pass `event_id` to from-html route when provided. |
| `lib/validators/contract.ts` | Add `event_id: z.string().uuid().optional()` to `createWaiverFromHtmlSchema` |
| `app/api/projects/[slug]/contracts/templates/from-html/route.ts` | Handle `event_id` param: auto-link template to event via `event_waivers` table (in addition to existing `program_id` → `program_waivers` logic) |

### 6.3 New Files

| File | Purpose |
|---|---|
| `lib/events/service.ts` | Core service: waitlist promotion, capacity status, program enrollment bridge |
| `lib/events/series.ts` | Series instance generation, template updates, series registration |
| `lib/events/notifications.ts` | Gmail connection lookup, confirmation/cancellation/reminder emails |
| `lib/events/waivers.ts` | Waiver creation for registrations, completion sync (mirrors `lib/community/waivers.ts`) |
| `lib/events/scan-attendance.ts` | Sign-in sheet OCR parsing and fuzzy matching |
| `lib/validators/event.ts` | Zod schemas for all event-related validation |
| `lib/mcp/tools/events.ts` | MCP tool definitions |

### 6.4 New Dependencies

| Package | Purpose |
|---|---|
| `rrule` | RFC 5545 recurrence rule expansion |
| `qrcode.react` | QR code rendering for check-in tickets |

---

## 7. Key Design Decisions

### 7.1 Why a New `events` Table (Not Extending Programs or Bookings)

**Not programs:** Programs model ongoing services with rolling enrollment, impact dimensions, and internal tracking. Events are discrete public-facing occurrences with tickets and self-service registration. Merging would add 15+ irrelevant columns to programs and force public routing concerns onto an internal entity.

**Not bookings:** Bookings are user-scoped (calendar profiles), slot-based (availability windows), and 1:1 focused. Events are project-scoped, date-bound, and many-to-one. The `create_booking_if_available` RPC logic (slot overlap, daily/weekly host limits) doesn't apply.

**Clean relationship:** `events.program_id → programs.id` lets a program "publish" events while keeping concerns separate.

### 7.2 Materialized Instances (Not Query-Time Expansion)

Each event instance needs its own registrations, capacity tracking, and attendance. RRULE expansion at query time would make these operations impossible. Materializing instances as real `events` rows is required.

### 7.3 Service Functions Create Their Own Supabase Clients

Following the pattern from `lib/calendar/service.ts` where `createBooking()` and `checkRateLimit()` call `createServiceClient()` internally. Exception: `matchOrCreateContact()` accepts a client parameter.

### 7.4 Capacity Counts Tickets, Not Registrations

One registration can include multiple tickets (e.g., "register 3 people"). `total_capacity` represents total attendee slots. The RPC counts `event_registration_tickets` joined through `event_registrations` for the capacity check.

### 7.5 `ip_address` as TEXT, Not INET

The `x-forwarded-for` header may be null or malformed. Using TEXT avoids INET parsing errors.

### 7.6 `created_by` Nullable (No NOT NULL)

`ON DELETE SET NULL` requires the column to be nullable. `NOT NULL` + `ON DELETE SET NULL` would cause DB errors on user deletion.

---

## 8. Architectural Constraints & Gotchas

1. **`community_has_permission()` SQL function must be updated** in migration 0149 (CREATE OR REPLACE) to add `'events'` as the 17th resource (currently 16 resources in migration 0133). Both SQL and TypeScript permission matrices must stay in sync.

2. **Notifications `type` CHECK constraint** is auto-named (likely `notifications_type_check`). Must ALTER to add `'event_registration'` and `'event_reminder'` while preserving all 22 existing values (`task_assigned`, `task_due`, `task_overdue`, `task_completed`, `opportunity_assigned`, `opportunity_won`, `opportunity_lost`, `opportunity_stage_changed`, `mention`, `comment`, `reply`, `email_received`, `email_opened`, `email_replied`, `meeting_reminder`, `meeting_scheduled`, `import_completed`, `export_ready`, `team_invite`, `team_member_joined`, `system`, `custom`). Use a `DO $$` block to query `pg_constraint` for the exact constraint name.

3. **`AutomationEntityType` is a constrained union** — must add new entity types or `emitAutomationEvent()` calls will fail TypeScript compilation. Event triggers go in a **new `events` group** in `triggerTypeGroups` (separate from the existing `community` group which has 23 triggers).

4. **Zod `.partial()` strips `.refine()` validation** — use `.superRefine()` after `.partial()` for update schemas.

5. **`createClient()` is async, `createServiceClient()` is sync** — public routes must use `createServiceClient()` (no await, no cookies).

6. **Rate limit key format** must match booking pattern: `ip:${ip}` and `email:${email}`.

7. **RPC returns UUID on success**, not JSONB. Tokens are column defaults — fetch them in a separate query after the RPC returns.

8. **`program_enrollments` has no unique constraint** on `(person_id, program_id)` — must guard against duplicates with a check query before insert.

9. **MCP tools use community RBAC** — `defineCommunityTool()` with `resource: 'events'`, NOT `checkPermission(ctx.role, 'viewer')`.

10. **Sidebar nav items are role-conditional** — Events must be hidden for `board_viewer` and `contractor`.

11. **`event_calendar_settings` PUT needs upsert** — use `.upsert()` with `onConflict: 'project_id'` to handle concurrent requests.

12. **Event waivers mirror program waivers exactly** — `event_waivers` join table + `registration_waivers` tracking table + auto-sync trigger on `events.requires_waiver`. The `contract_documents.custom_fields` must include `kind: 'event_waiver'`, `event_registration_id`, and `event_waiver_id` so `syncRegistrationFromCompletedWaiver()` can find the right registration.

13. **`/sign/[token]/submit` route must dispatch on `kind`** — The existing signing completion route calls `syncEnrollmentFromCompletedWaiver()` unconditionally. It must be updated to check `custom_fields.kind`: if `'program_waiver'` → existing function, if `'event_waiver'` → `syncRegistrationFromCompletedWaiver()`. Without this, event waiver signing will never promote registrations.

14. **`CreateWaiverTemplateDialog` needs `eventId` prop** — Currently only accepts `programId`. Must be updated to accept either, and the `from-html` API route must handle `event_id` to auto-link via `event_waivers` (not just `program_waivers`).

15. **`event_series` does NOT have `requires_waiver`** — Waivers are per-instance (on `events` table), not per-series. Series templates do not define waiver requirements. When generating instances from a series, waivers must be configured on each instance individually (or batch-applied via admin UI).

16. **Waitlisted registrations skip waivers** — Waivers are only sent when status is `pending_waiver`. Waitlisted registrants get waivers when promoted via `promoteFromWaitlist()`, which sets status to `pending_waiver` (not `confirmed`) if the event has waivers.

17. **`generate_series` in RPC duplicates attendee info** across expanded tickets with quantity > 1. This is correct for V1 — individual attendee assignment is a future enhancement.

18. **`add_to_crm = false` + waivers: no person record** — When `add_to_crm = false`, no `people` record is created, so `person_id` is null. But `createWaiverForEnrollment()` returns early with `sent: false` when `personId` is null. `createWaiverForRegistration()` must handle this differently: use `registrant_email` and `registrant_name` from `event_registrations` directly instead of looking up a person record. The waiver email still goes to the registrant, just not via a CRM person.

19. **Signing page lightweight waiver detection is kind-specific** — `app/api/sign/[token]/route.ts` line 92 checks `kind === 'program_waiver'` to determine lightweight rendering. Must change to `typeof customFields?.html_content === 'string'` so event waivers (`kind: 'event_waiver'`) also get the lightweight HTML signing flow instead of falling through to PDF rendering.

20. **`contract_templates.html_content`** — Migration 0148 added this column. Waivers created via WYSIWYG store their original HTML here. `createWaiverForRegistration()` must pass `template.html_content` through `custom_fields` on the `contract_document` (matching the pattern in `createWaiverForEnrollment()`), so the signing page can render HTML directly.

21. **Remove `waiver_template_id` from `events` table** — The column is orphaned. There is no `waiver_templates` table, and the many-to-many relationship is properly handled by the `event_waivers` join table. Including a dangling `waiver_template_id UUID` with no FK and no purpose is confusing. Remove it entirely from the schema.

22. **`event_registrations` CHECK constraint must include `pending_waiver`** — The plan file's RPC SQL only lists `pending_approval, confirmed, waitlisted, cancelled` in the CHECK. The CHECK must also include `pending_waiver` since the RPC sets this status when `requires_waiver = true`. Without it, the INSERT will fail with a constraint violation.

23. **`createEventSeriesSchema` needs frequency-dependent validation** — When `recurrence_frequency` is `weekly` or `biweekly`, `recurrence_days_of_week` must be non-empty (at least one day). The schema currently has `.optional()` which allows omission, resulting in zero events generated. Add a `.refine()` to enforce this.

24. **Rate limit entries share `booking_rate_limits` table** — `checkRateLimit()` writes to the `booking_rate_limits` table via the `upsert_rate_limit` RPC. Event registrations will share this table despite the "booking" name. This is intentional — the table is shared rate-limiting infrastructure.

---

## 9. Implementation Steps

## Phase 1: Foundation (Schema, Types, Permissions, Validators)

**Goal:** Database exists, types compile, permissions enforced, validators ready. No UI, no API routes yet.

### 1.1 Install Dependencies

```bash
npm install rrule qrcode.react
```

No additional AI dependencies needed — sign-in sheet OCR uses the existing OpenRouter integration (`lib/openrouter/client.ts` + `lib/assistant/ocr.ts` pattern) with per-project API keys via `getProjectSecret()`.

### 1.2 Migration — `supabase/migrations/0149_events_calendar.sql`

Write the full migration file. This is the largest single file in the feature. Structure it in this order:

**1.2.1 Storage bucket**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;
```
Add RLS policy on `storage.objects` for the `event-covers` bucket matching the `logos` bucket pattern from `0042_logo_storage.sql`.

**1.2.2 Tables (in FK dependency order)**
1. `event_calendar_settings` — no FKs to other new tables
2. `event_series` — FKs to `projects`, `programs`, `users`
3. `event_series_registrations` — FK to `event_series`
4. `events` — FKs to `projects`, `programs`, `event_series`, `users`. **No `waiver_template_id` column** (gotcha #21). Include `requires_waiver BOOLEAN NOT NULL DEFAULT FALSE`.
5. `event_ticket_types` — FK to `events`
6. `event_registrations` — FKs to `events`, `event_series_registrations`, `people`, `users`. **CHECK must include `pending_waiver`** (gotcha #22): `CHECK (status IN ('pending_approval', 'pending_waiver', 'confirmed', 'waitlisted', 'cancelled'))`
7. `event_registration_tickets` — FKs to `event_registrations`, `event_ticket_types`
8. `event_waivers` — FKs to `events`, `contract_templates`. UNIQUE on `(event_id, template_id)`.
9. `registration_waivers` — FKs to `event_registrations`, `event_waivers`, `contract_documents`. UNIQUE on `(registration_id, event_waiver_id)`.

Each table gets:
- `IF NOT EXISTS`
- `gen_random_uuid()` PKs
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (where applicable)
- `handle_updated_at()` trigger
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- Service-role bypass policy: `CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true);` limited to `service_role`

**1.2.3 Indexes**
All 19 indexes from §3.13. Create each with `IF NOT EXISTS`.

**1.2.4 Triggers**
- `handle_updated_at()` on all tables with `updated_at`
- `sync_event_requires_waiver()` function + trigger on `event_waivers` (AFTER INSERT OR DELETE, mirrors `sync_program_requires_waiver()` from migration 0147 exactly)

**1.2.5 Update `community_has_permission()` function**
```sql
CREATE OR REPLACE FUNCTION public.community_has_permission(
  p_project_id UUID, p_resource TEXT, p_action TEXT
) RETURNS BOOLEAN ...
```
Copy the existing function body from migration 0133, add `'events'` as the 17th resource in the permission matrix:
- owner/admin: `view, create, update, delete, export_pii, manage`
- staff/case_manager: `view, create, update`
- contractor/board_viewer: (no access)

**1.2.6 RLS Policies**
For each table, create access policies using `community_has_permission(project_id, 'events', 'view'/'create')`. Tables without direct `project_id` (ticket_types, registrations, tickets, event_waivers, registration_waivers) use EXISTS joins through parent tables. Follow exact patterns from `program_waivers` RLS in migration 0147.

**1.2.7 ALTER existing tables**

**Notes table:**
```sql
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_event_id ON public.notes(event_id);
```

**Notifications CHECK constraint:**
```sql
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'task_assigned', 'task_due', 'task_overdue', 'task_completed',
      'opportunity_assigned', 'opportunity_won', 'opportunity_lost', 'opportunity_stage_changed',
      'mention', 'comment', 'reply',
      'email_received', 'email_opened', 'email_replied',
      'meeting_reminder', 'meeting_scheduled',
      'import_completed', 'export_ready',
      'team_invite', 'team_member_joined',
      'system', 'custom',
      'event_registration', 'event_reminder'
    ));
END $$;
```

**1.2.8 RPCs**

**`register_for_event`** — Full SQL body from the plan file, with these corrections:
- Status determination must include `pending_waiver`: `IF v_event.requires_waiver THEN v_status := 'pending_waiver';`
- `p_ip_address TEXT` (not INET)
- Returns `UUID` (registration ID)
- Uses `RAISE EXCEPTION 'ERROR_CODE: message'` pattern
- `GRANT EXECUTE ON FUNCTION public.register_for_event(...) TO service_role;`

**`get_public_events(p_calendar_slug TEXT)`** — SECURITY DEFINER. Joins `event_calendar_settings` + `events` where `status='published'` AND `visibility='public'` AND `starts_at > NOW() - INTERVAL '1 day'`. Returns JSONB array. Includes per-event registration count (tickets) and remaining capacity. `GRANT ... TO service_role;`

**`get_public_event_detail(p_calendar_slug TEXT, p_event_slug TEXT)`** — SECURITY DEFINER. Returns single event JSONB with active `event_ticket_types` and per-type remaining counts. Allows `visibility IN ('public', 'unlisted')`. `GRANT ... TO service_role;`

### 1.3 Push Migration

```bash
# Deallocate prepared statements
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres' });
c.connect().then(() => c.query('DEALLOCATE ALL')).then(() => { console.log('Deallocated'); return c.end(); }).catch(e => { console.error(e.message); c.end(); });
"

# Push migration
npx supabase db push --db-url 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
```

### 1.4 Regenerate TypeScript Types

```bash
npx supabase gen types typescript --db-url 'postgresql://postgres.oljvcakgpksulsszojgx:@Cbz.BzDh9LN@rt@aws-0-us-west-2.pooler.supabase.com:6543/postgres' > types/database.ts
```

Run `npm run typecheck` — fix any issues from schema changes.

### 1.5 TypeScript Type Definitions — `types/community.ts`

Add after the existing Program types:

```typescript
// Event status types
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'postponed' | 'completed';
export type EventVisibility = 'public' | 'unlisted' | 'private';
export type EventLocationType = 'in_person' | 'virtual' | 'hybrid';
export type EventRegistrationStatus = 'pending_approval' | 'pending_waiver' | 'confirmed' | 'waitlisted' | 'cancelled';
export type EventSeriesStatus = 'draft' | 'active' | 'paused' | 'completed';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type EventWaiverStatus = 'not_required' | 'pending' | 'signed';
export type EventRegistrationSource = 'web' | 'embed' | 'api' | 'manual' | 'import';

// Event interfaces (derive from Database types where possible)
export type Event = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

export type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'];
export type EventRegistration = Database['public']['Tables']['event_registrations']['Row'];
export type EventRegistrationTicket = Database['public']['Tables']['event_registration_tickets']['Row'];
export type EventCalendarSettings = Database['public']['Tables']['event_calendar_settings']['Row'];

export type EventSeries = Database['public']['Tables']['event_series']['Row'];
export type EventSeriesInsert = Database['public']['Tables']['event_series']['Insert'];
export type EventSeriesUpdate = Database['public']['Tables']['event_series']['Update'];
export type EventSeriesRegistration = Database['public']['Tables']['event_series_registrations']['Row'];

export type EventWaiver = Database['public']['Tables']['event_waivers']['Row'];
export type RegistrationWaiver = Database['public']['Tables']['registration_waivers']['Row'];
```

### 1.6 Community Permissions — `lib/projects/community-permissions.ts`

**Add to `CommunityResource` union** (line ~22, after `'public_dashboard'`):
```typescript
| 'events';
```

**Add to `COMMUNITY_PERMISSION_MATRIX`** for each role:
```typescript
// owner:
events: ['view', 'create', 'update', 'delete', 'export_pii', 'manage'],
// admin:
events: ['view', 'create', 'update', 'delete', 'export_pii', 'manage'],
// staff:
events: ['view', 'create', 'update'],
// case_manager:
events: ['view', 'create', 'update'],
// contractor:
events: [],
// board_viewer:
events: [],
// member:
events: ['view'],
// viewer:
events: ['view'],
```

### 1.7 Automation Types — `types/automation.ts`

**Add to `AutomationEntityType` union** (after `'service_type'`):
```typescript
| 'event'
| 'event_registration'
| 'event_ticket_type'
| 'event_series'
| 'event_series_registration';
```

**Add new `events` trigger group** to `triggerTypeGroups` (as a new group, NOT inside the existing `community` group):
```typescript
events: {
  label: 'Event Calendar',
  triggers: [
    { type: 'event.created', label: 'Event Created' },
    { type: 'event.published', label: 'Event Published' },
    { type: 'event.cancelled', label: 'Event Cancelled' },
    { type: 'event.registration.created', label: 'Registration Created' },
    { type: 'event.registration.confirmed', label: 'Registration Confirmed' },
    { type: 'event.registration.cancelled', label: 'Registration Cancelled' },
    { type: 'event.registration.waitlisted', label: 'Registration Waitlisted' },
    { type: 'event.registration.checked_in', label: 'Attendee Checked In' },
    { type: 'event.capacity_reached', label: 'Event Capacity Reached' },
  ],
},
```

**Add to `TriggerType` union:**
```typescript
| 'event.created' | 'event.published' | 'event.cancelled'
| 'event.registration.created' | 'event.registration.confirmed'
| 'event.registration.cancelled' | 'event.registration.waitlisted'
| 'event.registration.checked_in' | 'event.capacity_reached'
```

### 1.8 Validators — `lib/validators/event.ts`

Create new file with all Zod schemas from §3 of the PRD. Import `customQuestionSchema` from `lib/validators/calendar.ts`. Key schemas:

- `createEventSchema` — with `.refine()` for `ends_at > starts_at`
- `updateEventSchema` — `eventBaseFields.partial().superRefine()` (gotcha #4)
- `createTicketTypeSchema`
- `updateTicketTypeSchema` — `createTicketTypeSchema.partial()`
- `publicEventRegistrationSchema` — public registration input
- `publicSeriesRegistrationSchema` — series registration input
- `checkInSchema` — `.refine()` requiring at least one of `qr_code`, `registration_id`, `ticket_id`
- `createEventSeriesSchema` — with `.refine()` for mutual exclusion of `recurrence_until`/`recurrence_count`, `.refine()` for `template_end_time > template_start_time`, **and `.refine()` for `recurrence_days_of_week` required when frequency is `weekly`/`biweekly`** (gotcha #23)
- `updateEventSeriesSchema` — `.partial()` of base fields
- `eventCalendarSettingsSchema` — slug regex, hex color regex. **Slug `.min(2)`** to match DB regex.
- `batchAttendanceSchema` — array of `{ registration_id, status: 'present' | 'absent' | 'excused' }`
- `scanAttendanceConfirmSchema` — array of `{ raw_text, person_id?, create_new: boolean }`

### 1.9 Verify Phase 1

```bash
npm run typecheck  # Must pass with zero errors
```

**Phase 1 deliverables:**
- [x] Migration pushed, DB has all 9 new tables + 2 altered tables + 3 RPCs + RLS + triggers
- [x] `types/database.ts` regenerated
- [x] `types/community.ts` has all event interfaces
- [x] `types/automation.ts` has event entity types and trigger types
- [x] `lib/projects/community-permissions.ts` has `'events'` resource
- [x] `lib/validators/event.ts` has all Zod schemas
- [x] `npm run typecheck` passes

---

## Phase 2: Service Layer + Admin API Routes

**Goal:** All backend logic works. Admin can CRUD events, manage registrations, check in attendees. No public pages, no UI yet — but fully testable via API.

### 2.1 Core Event Service — `lib/events/service.ts`

Each function creates its own `createServiceClient()` internally (matching `lib/calendar/service.ts` pattern).

**`promoteFromWaitlist(eventId: string)`**
- Query oldest waitlisted registration: `ORDER BY created_at ASC LIMIT 1`
- If event `requires_waiver`: set status to `'pending_waiver'`, call `createWaiversForRegistration()`
- If no waivers: set status to `'confirmed'`
- Call `sendWaitlistPromotionNotification()` (fire-and-forget)
- Return promoted registration ID or null

**`getEventCapacityStatus(eventId: string)`**
- Count tickets (not registrations) with parent status IN `('confirmed', 'pending_approval', 'pending_waiver')`
- Return `{ total: number | null, registered: number, remaining: number | null, waitlisted: number }`

**`autoEnrollInProgram(personId: string, programId: string, projectId: string)`**
- Guard: query if enrollment already exists for `(person_id, program_id)` — if yes, skip (gotcha #8)
- Check `program.requires_waiver` → set enrollment status to `'waitlisted'` if true, `'active'` if false
- Insert `program_enrollment`
- Fire-and-forget `emitAutomationEvent()` with `entityType: 'program_enrollment'`, `triggerType: 'entity.created'`
- If program has waivers, call `createWaiversForEnrollment()` from `lib/community/waivers.ts`

**`bridgeCheckInToAttendance(eventId: string, personId: string)`**
- Load event to get `program_id` and `starts_at`
- If `program_id` is null, return (no bridge needed)
- Upsert `program_attendance` with `(program_id, person_id, date: starts_at::date, status: 'present')` on `program_attendance_unique` constraint

### 2.2 Event Notifications — `lib/events/notifications.ts`

**`getProjectGmailConnection(projectId: string)`**
- Creates own service client
- Query `gmail_connections` joined with `project_memberships` WHERE `project_id = projectId` AND `role IN ('owner', 'admin')` ORDER BY `CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 END`
- Return `{ gmailConnection, userId }` or `null` (log warning if null, don't throw)

**`sendEventRegistrationConfirmation(registrationId: string)`**
- Creates own service client
- Load registration + event + calendar settings
- Get gmail connection via `getProjectGmailConnection()`
- If no connection: log warning, return (don't throw)
- Build Google Calendar link: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGCalDate(event.starts_at)}/${formatGCalDate(event.ends_at)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.venue_name || '')}`
- Generate ICS via `generateIcs()` from `lib/calendar/ics.ts`
- Build HTML email: event details + cancel link (`/events/cancel/${registration.cancel_token}`) + "Add to Google Calendar" button + "Download .ics" link (`/api/events/ics?token=${registration.confirmation_token}`)
- Send via `sendEmail()` with ICS attachment
- Create in-app notification: INSERT into `notifications` with `type: 'event_registration'`, `user_id: gmailConnection.userId`, `entity_type: 'event_registration'`, `entity_id: registrationId`

**`sendEventCancellationConfirmation(registrationId: string)`**
- Cancellation email to registrant

**`sendWaitlistPromotionNotification(registrationId: string)`**
- Notify registrant when promoted from waitlist, includes new ICS attachment and "Add to Calendar" links

**`sendEventReminders()`**
- Query `event_registrations` joined with `events` WHERE `events.starts_at` within 24h/1h AND `reminder_sent_24h`/`reminder_sent_1h` is false AND `status IN ('confirmed')`
- Send reminder emails with "Add to Calendar" links, update reminder flags
- Called from booking-reminders cron

**Helper: `formatGCalDate(isoDate: string)`**
- Converts ISO 8601 to Google Calendar format: `20260325T180000Z`

### 2.3 Event Series — `lib/events/series.ts`

**`generateSeriesInstances(seriesId: string, fromDate?: Date, toDate?: Date)`**
- Creates own service client
- Load series template
- Build `RRule` from series fields:
  ```typescript
  import { RRule, RRuleSet } from 'rrule';
  const rule = new RRule({
    freq: frequencyMap[series.recurrence_frequency],
    interval: series.recurrence_interval,
    byweekday: series.recurrence_days_of_week.map(d => dayMap[d]),
    dtstart: fromDate || new Date(),
    until: toDate || (series.recurrence_until ? new Date(series.recurrence_until) : addDays(new Date(), series.generation_horizon_days)),
    count: series.recurrence_count || undefined,
    ...(series.recurrence_day_position ? { bysetpos: series.recurrence_day_position === 5 ? -1 : series.recurrence_day_position } : {}),
  });
  ```
- For each date from `rule.all()`:
  - Skip if already exists (`events` with matching `series_id` + `series_index`)
  - Calculate `starts_at` = date + `template_start_time` in series timezone
  - Calculate `ends_at` = date + `template_end_time` in series timezone
  - Generate slug via `generateSlug(series.title + '-' + formatDate(date))`
  - INSERT into `events` with `series_id`, `series_index`, all template fields, `status: 'published'` (if series is active)
  - Copy series ticket type templates into `event_ticket_types` for each instance
  - If active `event_series_registrations` exist, create `event_registrations` for each series registrant on the new instance
- Update `event_series.last_generated_date`
- Return count of instances generated

**`updateFutureInstances(seriesId: string, updates: Partial<EventUpdate>)`**
- Updates all future instances WHERE `series_instance_modified = false` AND `starts_at > NOW()`
- Skips individually modified instances

**`registerForSeries(seriesId, registrantData)`** — see §2.4

**`cancelSeriesRegistration(seriesRegistrationId)`** — see §2.4

**`generateUpcomingSeriesInstances()`**
- Query all active series WHERE `last_generated_date < NOW() + generation_horizon_days`
- Call `generateSeriesInstances()` for each
- Called from cron

### 2.4 Event Waivers — `lib/events/waivers.ts`

Mirrors `lib/community/waivers.ts` with these differences:

**`createWaiverForRegistration(registrationId, eventWaiverId, supabase)`**
- Load registration + event_waiver + contract_template
- **If `registration.person_id` is null** (the `add_to_crm = false` case): use `registration.registrant_email` and `registration.registrant_name` directly as recipient info (gotcha #18). Do NOT call `createWaiverForEnrollment()` which returns early on null personId.
- Create `contract_document` with `custom_fields: { kind: 'event_waiver', event_registration_id: registrationId, event_waiver_id: eventWaiverId, ...(template.html_content ? { html_content: template.html_content } : {}) }` (gotcha #20)
- Create `contract_recipient` with registrant info
- Send signing email via `getProjectGmailConnection()`
- Update `registration_waivers` row with `contract_document_id`

**`createWaiversForRegistration(registrationId)`**
- Load event's `event_waivers`
- For each: create `registration_waivers` row, call `createWaiverForRegistration()`

**`syncRegistrationFromCompletedWaiver(contractDocumentId)`**
- Load contract_document, extract `event_registration_id` from `custom_fields`
- Check if ALL `registration_waivers` for this registration are signed
- If all signed: promote registration from `pending_waiver` to `confirmed`
- Update `event_registrations.waiver_status = 'signed'`, `waiver_signed_at = NOW()`

### 2.5 Sign-in Sheet OCR — `lib/events/scan-attendance.ts`

**`parseSignInSheet(projectId: string, imageBuffer: Buffer, mimeType: string)`**
- Reuse the OpenRouter vision pattern from `lib/assistant/ocr.ts`:
  ```typescript
  const apiKey = await getProjectSecret(projectId, 'openrouter_api_key');
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  // Call OpenRouter with gpt-4o-mini (same model as receipt OCR for images)
  ```
- System prompt: "You are extracting handwritten names from a sign-in sheet."
- User prompt with image: "Extract all handwritten names from this sign-in sheet. Return as JSON: `{ \"names\": [\"First Last\", ...] }`. Include only names, not headers, dates, check marks, or other text."
- Model: `openai/gpt-4o-mini` via OpenRouter (proven for handwriting in existing receipt OCR)
- Response format: `json_object`
- Validate with Zod: `z.object({ names: z.array(z.string()) })`
- Return `string[]`

**`matchParsedNames(names: string[], projectId: string)`**
- Query all people in project
- For each name: run `scorePersonMatch()` from `lib/deduplication/detector.ts`
- Return `{ raw_text, matched_person_id?, match_confidence, suggested_name, match_status: 'matched'|'possible'|'unmatched' }[]`

**`confirmScannedAttendance(eventId, confirmations, userId)`**
- For each: if `create_new`, call `matchOrCreateContact()`. Then create/update registration with `source: 'scan'`, mark checked in.

### 2.6 Update Existing Waiver Files

**`app/api/sign/[token]/route.ts`** — Line 92: Change:
```typescript
// FROM:
const isLightweightWaiver = customFields?.kind === 'program_waiver' && typeof customFields?.html_content === 'string';
// TO:
const isLightweightWaiver = typeof customFields?.html_content === 'string';
```

**`app/api/sign/[token]/submit/route.ts`** — After existing `syncEnrollmentFromCompletedWaiver()` call, add:
```typescript
if (customFields?.kind === 'event_waiver') {
  const { syncRegistrationFromCompletedWaiver } = await import('@/lib/events/waivers');
  await syncRegistrationFromCompletedWaiver(document.id).catch(err =>
    console.error('[WAIVER_SUBMIT] Event registration sync failed:', err)
  );
}
```

**`lib/validators/contract.ts`** — Add to `createWaiverFromHtmlSchema`:
```typescript
event_id: z.string().uuid().optional(),
```

**`app/api/projects/[slug]/contracts/templates/from-html/route.ts`** — After the existing `program_waivers` insert block, add:
```typescript
if (event_id) {
  const { data: eventWaiver, error: ewError } = await supabase
    .from('event_waivers')
    .insert({ event_id, template_id: template.id })
    .select()
    .single();
  if (ewError) console.error('[WAIVER_FROM_HTML] Event waiver link failed:', ewError);
  else waiver = eventWaiver; // reuse the waiver response field
}
```

**`components/community/programs/create-waiver-template-dialog.tsx`** — Add optional `eventId?: string` prop. When `eventId` is provided, pass `event_id: eventId` in the API body instead of `program_id`.

### 2.7 Admin API Routes — `app/api/projects/[slug]/events/`

Each route follows the exact pattern from `programs/route.ts`:
1. `const supabase = await createClient()` (async)
2. `supabase.auth.getUser()` → 401 if no user
3. Project lookup by slug with `.is('deleted_at', null)` → 404 if not found
4. `await requireCommunityPermission(supabase, user.id, project.id, 'events', action)` → throws `ProjectAccessError` → caught as 403
5. Zod validation on POST/PATCH → 400 with `error.flatten()`
6. Supabase query → 500 on error
7. `emitAutomationEvent()` fire-and-forget on mutations
8. Wrap in try/catch: `ProjectAccessError` → 403, everything else → 500

**Create these route files:**

| File | Key implementation details |
|---|---|
| `route.ts` (GET, POST) | GET: pagination (page/limit/search/status/category/sort), `ALLOWED_SORT = ['title','status','starts_at','created_at']`. POST: validate with `createEventSchema`, generate slug via `generateSlug(title)` if not provided, INSERT, emit `event.created`. |
| `[id]/route.ts` (GET, PATCH, DELETE) | GET: include `registration_count` (count tickets via join), `ticket_types` (select from `event_ticket_types`), `waiver_count` (count `event_waivers`). PATCH: validate with `updateEventSchema`, **fetch old record BEFORE update** for accurate `previousData` in automation events, emit `entity.updated` + `field.changed` per field. DELETE: hard delete (matching programs pattern), emit `entity.deleted`. |
| `[id]/publish/route.ts` (POST) | Toggle: if current `status === 'draft'` → set `published`, `published_at = NOW()`. If `published` → set `draft`, clear `published_at`. Emit `event.published`. If `project.calendar_sync_enabled`, call `syncEvent()` (Phase 3). |
| `[id]/duplicate/route.ts` (POST) | Clone event + ticket types. Reset: slug (append `-copy`), status → `draft`, `published_at` → null, clear dates or offset by 1 week. |
| `[id]/ticket-types/route.ts` (GET, POST) | GET: sorted by `sort_order`. POST: validate with `createTicketTypeSchema`, INSERT with `event_id`. |
| `[id]/ticket-types/[tid]/route.ts` (PATCH, DELETE) | Standard CRUD. Verify ticket_type belongs to event via `event_id` check. |
| `[id]/registrations/route.ts` (GET) | Pagination + search by name/email + status filter. Include ticket count per registration. |
| `[id]/registrations/[rid]/route.ts` (GET, PATCH) | GET: include `registration_waivers` with signing status. PATCH: status change (confirm/cancel/waitlist). On cancel → call `promoteFromWaitlist()`. On confirm → emit `event.registration.confirmed`. |
| `[id]/check-in/route.ts` (POST) | Validate with `checkInSchema`. Lookup by `qr_code` OR `registration_id` OR `ticket_id`. Set `checked_in_at = NOW()`, `checked_in_by = user.id` on ticket. Also set on parent registration if first ticket check-in. Call `bridgeCheckInToAttendance()` if program-linked. Emit `event.registration.checked_in`. |
| `[id]/export/route.ts` (GET) | RBAC: `export_pii`. Query registrations with tickets. Use `rowsToCsv()` from `lib/reports/csv-export.ts`. Return with `Content-Type: text/csv`, `Content-Disposition: attachment`. |
| `[id]/upload-cover/route.ts` (POST) | Accept `multipart/form-data`. Validate: jpeg/png/webp, ≤5MB. Upload to `event-covers` bucket: `${project.id}/${event.id}/${filename}`. Update `events.cover_image_url` with public URL. |
| `[id]/attendance/route.ts` (GET, POST) | GET: list registrations with check-in status. POST: validate with `batchAttendanceSchema`. For each: set `checked_in_at`/clear it. Bridge to program attendance. |
| `[id]/scan-attendance/route.ts` (POST) | Accept `multipart/form-data` with image. Call `parseSignInSheet()` + `matchParsedNames()`. Return match results. Rate limit: 10 scans per event per day (use `checkRateLimit()` with key `scan:${eventId}`). |
| `[id]/confirm-attendance/route.ts` (POST) | Validate with `scanAttendanceConfirmSchema`. Call `confirmScannedAttendance()`. |
| `[id]/notes/route.ts` (GET, POST) | GET: filter by `event_id`, optional `category` filter. POST: INSERT note with `event_id`, `category`, `project_id`, `created_by`. |
| `[id]/notes/[noteId]/route.ts` (PATCH, DELETE) | Standard CRUD on notes. Verify note belongs to event via `event_id`. |
| `[id]/waivers/route.ts` (GET, POST, DELETE) | GET: list `event_waivers` joined with `contract_templates`. POST: link existing template as waiver (INSERT `event_waivers`), backfill `registration_waivers` for existing non-cancelled registrations. DELETE: remove waiver link (DELETE from `event_waivers`). |
| `[id]/registrations/[rid]/waivers/route.ts` (GET) | List `registration_waivers` for registration with signing status + contract_document links. |
| `series/route.ts` (GET, POST) | GET: list series for project. POST: validate with `createEventSeriesSchema`, INSERT series, call `generateSeriesInstances()`, return `{ series, instancesGenerated }`. |
| `series/[seriesId]/route.ts` (GET, PATCH, DELETE) | PATCH: update template, call `updateFutureInstances()`. DELETE: hard delete (CASCADE removes all instances). |
| `series/[seriesId]/generate/route.ts` (POST) | Manual trigger: call `generateSeriesInstances()`, return count. |
| `series/[seriesId]/registrations/route.ts` (GET) | List `event_series_registrations` for series. |
| `calendar-settings/route.ts` (GET, PUT) | GET: query by `project_id`. PUT: validate with `eventCalendarSettingsSchema`, upsert with `onConflict: 'project_id'` (gotcha #11). |

### 2.8 Public API Routes — `app/api/events/`

All use `const supabase = createServiceClient()` (sync, no await). No auth.

| File | Key implementation details |
|---|---|
| `[calendarSlug]/route.ts` (GET) | Validate slug format. Call `get_public_events` RPC. Return events array. |
| `[calendarSlug]/[eventSlug]/route.ts` (GET) | Call `get_public_event_detail` RPC. Return event with ticket types. |
| `register/route.ts` (POST) | **Full flow:** 1. Validate with `publicEventRegistrationSchema`. 2. Extract IP from `x-forwarded-for`. 3. Rate limit: `checkRateLimit(\`ip:${ip}\`, 10, 60)` and `checkRateLimit(\`email:${email}\`, 5, 1440)` — return 429 if either fails. 4. Call `register_for_event` RPC. 5. Map RPC error codes → HTTP (see §3.11). 6. Fetch tokens from created registration. 7. If `event.add_to_crm`: query project owner from `project_memberships`, call `matchOrCreateContact()`, UPDATE registration's `person_id`. 8. If `event.requires_waiver` and status is `pending_waiver`: call `createWaiversForRegistration()`. 9. If event has `program_id` and `personId` is not null: fire-and-forget `autoEnrollInProgram()`. 10. Fire-and-forget `sendEventRegistrationConfirmation()`. 11. Fire-and-forget `emitAutomationEvent()` with `entityType: 'event_registration'`, `triggerType: 'event.registration.created'`. 12. Return `{ registration: { id, status, confirmation_token, cancel_token } }` with 201. |
| `register-series/route.ts` (POST) | Validate with `publicSeriesRegistrationSchema`. Rate limit same as above. Create `event_series_registrations` row. Iterate all future published instances: call `register_for_event` RPC for each. Handle per-instance capacity failures gracefully. Person creation + program enrollment same as single register. Return `{ seriesRegistration, instanceCount, failedInstances }`. |
| `cancel/route.ts` (POST) | Accept `{ cancel_token }`. Check both `event_registrations.cancel_token` (single) and `event_series_registrations.cancel_token` (series). Update status to `'cancelled'`. For series: cancel all future instance registrations. Call `promoteFromWaitlist()` for each freed spot. Fire-and-forget cancellation email. |
| `ics/route.ts` (GET) | **Two modes:** (1) `?token={confirmation_token}` — look up registration + event, generate personalized ICS with registrant as attendee. (2) `?calendar={calendarSlug}&event={eventSlug}` — look up event via RPC, generate generic ICS (no attendee). Return `Content-Type: text/calendar`, `Content-Disposition: attachment; filename=event.ics`. |

### 2.9 Verify Phase 2

```bash
npm run typecheck  # Must pass
```

Test key flows via curl or API client:
- POST event → GET event → PATCH event → DELETE event
- POST ticket types → GET ticket types
- POST register (public) → verify registration created → verify person created (if `add_to_crm`)
- Cancel registration → verify waitlist promotion
- POST series → verify instances generated
- POST calendar-settings → GET calendar-settings

**Phase 2 deliverables:**
- [x] `lib/events/service.ts` — waitlist, capacity, enrollment bridge, attendance bridge
- [x] `lib/events/series.ts` — RRULE expansion, instance generation, template updates
- [x] `lib/events/notifications.ts` — Gmail lookup, confirmation/cancellation/reminder/promotion emails with Add to Calendar links
- [x] `lib/events/waivers.ts` — registration waivers, completion sync
- [x] `lib/events/scan-attendance.ts` — OCR + fuzzy matching
- [x] All admin API routes (23 route files)
- [x] All public API routes (6 route files) with rate limiting
- [x] Waiver integration files updated (sign route, submit route, dialog, validator, from-html route)
- [x] `npm run typecheck` passes

---

## Phase 3: UI, Middleware, Chat/MCP Integration, Cron, Reporting

**Goal:** Full user-facing feature. Admin UI, public pages, AI chat tools, cron jobs, reporting.

### 3.1 Middleware — `middleware.ts`

**Add `/events` to `publicRoutes`** (line 43):
```typescript
const publicRoutes = ['/login', '/auth/callback', '/invite', '/sign', '/book', '/events'];
```

**Add embed iframe headers** (after the `/book/embed` block at line 71):
```typescript
if (pathname.startsWith('/events/embed')) {
  supabaseResponse.headers.delete('X-Frame-Options');
  supabaseResponse.headers.set('Content-Security-Policy', 'frame-ancestors *');
}
```

### 3.2 Sidebar — `components/layout/project-sidebar.tsx`

**Add to `communityNavItems` array** (after Programs, before Referrals):
```typescript
{ title: 'Events', href: '/events', icon: CalendarDays },
```

Import `CalendarDays` from `lucide-react` (already available — Programs uses `CalendarRange`).

Role-conditional logic already handles this correctly:
- `board_viewer`: only sees Dashboard + Reporting (Events filtered out)
- `contractor`: empty nav (Events filtered out)
- Others: see Events

### 3.3 Admin Pages — `app/(dashboard)/projects/[slug]/events/`

**3.3.1 Event List Page — `page.tsx`**

Server component with `<Suspense>` wrapping a client component `events-page-client.tsx`.

Pattern: follow `programs/page.tsx` exactly.

Client component features:
- Calendar/list view toggle (FullCalendar for calendar, card grid for list — `md:grid-cols-2 xl:grid-cols-3`)
- Status tabs: All / Draft / Published / Completed / Cancelled
- Search bar (title search)
- Category filter dropdown
- "Create Event" button → opens `CreateEventDialog`
- Each event card shows: title, date/time, location, status badge, registration count / capacity
- Click card → navigate to `events/${event.id}`

**`CreateEventDialog`** — follow `new-program-dialog.tsx` pattern:
- Form fields: title, description (rich text), dates (start/end with time picker), location type, venue details, capacity, visibility
- "Recurring" toggle that expands to show: frequency, days of week checkboxes, day position (for monthly), until date or count
- "Add registrants to CRM" toggle (default on)
- On submit: POST to `/api/projects/${slug}/events` (or `/events/series` if recurring)

**3.3.2 Event Detail Page — `[id]/page.tsx`**

Server component with `<Suspense>` wrapping `event-detail-client.tsx`.

Tabs:
1. **Info** — Event details display + edit form. `PublishControls` component for draft/publish toggle. Cover image with upload button.
2. **Registrations** — Searchable table of registrations. Status badges. Actions: confirm, cancel, check-in. "Add Registration" button with `PersonCombobox`. CSV export button.
3. **Attendance** — `BatchAttendance`-style grid. "Upload Sign-in Sheet" button for OCR flow. "Mark All Present" bulk action.
4. **Waivers** — List linked waiver templates with remove button per template. "Add Existing Waiver" dropdown (project's `contract_templates` where `category='waiver'`). "Create New Waiver" button → opens `CreateWaiverTemplateDialog` with `eventId` (supports both WYSIWYG lightweight waiver creation and PDF upload). Per-registration waiver status visible in Registrations tab.
5. **Feedback & Observations** — `NotesPanel` filtered by `event_id`. Category tabs: All / Feedback / Observations. Category selector on note creation.
6. **Analytics** — recharts `AreaChart` for registration trend over time. Summary cards: total registered, attended, show-up rate, capacity utilization.
7. **Check-in** — QR scanner (camera-based or manual text input). Lookup result shows registrant info + check-in button. Uses `qrcode.react` to display QR codes on registration detail.

**3.3.3 Settings Page — `settings/page.tsx`**

- Enable/disable events calendar toggle
- Calendar slug (auto-generated from project name, editable)
- Title, description
- Logo upload
- Primary color picker
- Timezone selector
- Preview link to public calendar

### 3.4 Public Pages — `app/events/`

**3.4.1 Layout — `layout.tsx`**

Minimal layout matching `app/book/layout.tsx`:
```tsx
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </div>
      <footer className="py-8 text-center text-sm text-gray-500">
        Powered by <a href="https://goodrev.com" className="underline">GoodRev</a>
      </footer>
    </div>
  );
}
```

**3.4.2 Calendar Page — `[calendarSlug]/page.tsx`**

`'use client'` component. Fetches from `/api/events/${calendarSlug}`.

- FullCalendar month view + list view toggle
- Category filter
- Event cards: title, date/time, location, spots remaining
- Click → navigate to `events/${calendarSlug}/${event.slug}`
- Export `generateMetadata()` for SEO (fetch calendar settings for title/description)

**3.4.3 Event Detail + Registration — `[calendarSlug]/[eventSlug]/page.tsx`**

- Hero section: cover image, title, date/time, location
- Description (rendered HTML)
- **"Add to Calendar" dropdown**: Google Calendar link + Download .ics button (using `/api/events/ics?calendar=${calendarSlug}&event=${eventSlug}`)
- Location with embedded map (if coordinates available)
- Organizer info
- Multi-step registration form (if `registration_enabled`):
  1. **Ticket selection**: show ticket types with quantity selectors and remaining counts
  2. **Contact info**: name, email, phone
  3. **Custom questions**: rendered from `custom_questions` JSONB
  4. **Confirm**: review + submit
- If series event: show "Register for this event" AND "Register for entire series" options
- Error handling: capacity full (409), registration closed (410), rate limited (429)
- Export `generateMetadata()` with OpenGraph tags (title, description, `cover_image_url`)

**3.4.4 Series Overview — `[calendarSlug]/series/[seriesSlug]/page.tsx`**

- Series description, schedule summary ("Every Tuesday 6-8pm")
- List of upcoming instances with capacity indicators
- "Register for Entire Series" button

**3.4.5 Confirmation Page — `confirmation/[token]/page.tsx`**

Server component that fetches registration + event details using `confirmation_token` via service client.

Shows: event title, date/time, location, registrant name, status badge, ticket summary.

**"Add to Calendar" section:**
- Google Calendar button (direct link)
- Apple Calendar / Outlook button (`.ics` download via `/api/events/ics?token=${token}`)
- Cancel registration link (`/events/cancel/${cancel_token}`)

**3.4.6 Cancellation Page — `cancel/[token]/page.tsx`**

- Confirm cancellation (POST to `/api/events/cancel` with `cancel_token`)
- Success message with event details

### 3.5 Embed Pages — `app/events/embed/`

**`[calendarSlug]/page.tsx`** — Minimal chrome calendar. No header/footer.

**`[calendarSlug]/[eventSlug]/page.tsx`** — Minimal chrome registration form. On success:
```typescript
window.parent.postMessage({
  type: 'goodrev:event:registered',
  registrationId,
  eventTitle,
}, '*');
```

### 3.6 Dashboard Card — `components/community/dashboard/event-cards.tsx`

New component showing upcoming events with registration counts. Pattern matches `ProgramCards`. Add to community dashboard page.

### 3.7 MCP Tools — `lib/mcp/tools/events.ts`

Create `registerEventTools(server, getContext)` function. Register these tools:

```typescript
const EVENT_TOOLS: CommunityChatTool[] = [
  // events.list (events:view)
  // events.get (events:view) — include registration counts
  // events.create (events:create) — emit event.created
  // events.update (events:update) — emit field changes
  // events.delete (events:delete)
  // events.publish (events:update) — emit event.published
  // events.list_registrations (events:view)
  // events.check_in (events:update) — by registration ID or QR
  // events.cancel_registration (events:update) — promote waitlist
  // events.create_ticket_type (events:create)
  // events.create_series (events:create) — auto-generate instances
  // events.list_series (events:view)
  // events.update_series (events:update) — propagate to future instances
];
```

Each tool follows the `defineCommunityTool()` pattern from `lib/chat/community-tool-registry.ts`.

**Register in `lib/mcp/server.ts`** — Inside the `if (context.projectType === 'community')` block:
```typescript
registerEventTools(server, getContext);
```

**Add `'events'` to `CORE_PREFIXES`** in `lib/mcp/tools/community.ts`:
```typescript
const CORE_PREFIXES = new Set([
  'households', 'programs', 'contributions', 'assets',
  'referrals', 'relationships', 'broadcasts', 'grants',
  'census', 'events',  // ← add
]);
```

### 3.8 Chat Tool Integration

**`lib/chat/community-tool-registry.ts`** — Add `defineCommunityTool()` entries for all event tools. Each specifies `resource: 'events'` and the corresponding action.

**`hooks/use-chat.ts`** — Add to `MUTATING_TOOLS` set:
```typescript
'events.create', 'events_create',
'events.update', 'events_update',
'events.delete', 'events_delete',
'events.publish', 'events_publish',
'events.check_in', 'events_check_in',
'events.cancel_registration', 'events_cancel_registration',
'events.create_ticket_type', 'events_create_ticket_type',
'events.create_series', 'events_create_series',
'events.update_series', 'events_update_series',
```

**`components/chat/chat-message-list.tsx`** — Add to `TOOL_COLORS`:
```typescript
events: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200' },
```

**`components/chat/chat-settings.tsx`** — Add inside community `isCommunity` block:
```tsx
<ToolGroup name="Events" tools={['list', 'get', 'create', 'update', 'publish', 'list_registrations', 'check_in', 'cancel_registration', 'create_ticket_type', 'create_series', 'list_series', 'update_series']} />
```

**`lib/chat/system-prompt.ts`** — Add to community capabilities:
```
- **Events**: List, create, update, publish/unpublish events. Manage registrations, check-in attendees, cancel registrations. Create ticket types and recurring event series.
```

### 3.9 Cron — `app/api/cron/booking-reminders/route.ts`

Extend the existing GET handler. After the booking reminders section, add:

```typescript
// Event reminders
try {
  const { sendEventReminders } = await import('@/lib/events/notifications');
  await sendEventReminders();
} catch (err) {
  console.error('[CRON] Event reminders failed:', err);
}

// Series instance generation
try {
  const { generateUpcomingSeriesInstances } = await import('@/lib/events/series');
  await generateUpcomingSeriesInstances();
} catch (err) {
  console.error('[CRON] Series generation failed:', err);
}
```

### 3.10 Google Calendar Sync — `lib/assistant/calendar-bridge.ts`

Add `syncEvent(eventId: string)` function following `syncProgramSession()` pattern:
- Load event
- If not published, skip
- Create/update Google Calendar event via the project owner's connected calendar
- On cancel/delete: remove from Google Calendar

Called from `[id]/publish/route.ts` when `project.calendar_sync_enabled`.

### 3.11 Attendance Reporting — `lib/community/reports.ts`

Add `generateAttendanceTrendReport(projectId, programId?, dateRange?)`:
- Query `event_registrations` joined with `events` (and optionally filtered by `program_id`)
- Aggregate by week/month/year using Map-based aggregation (matching existing report functions)
- Return `{ weekly: [...], monthly: [...], yearly: [...], summary: { totalEvents, totalRegistrations, totalAttendees, avgShowUpRate, avgCapacityUtil } }`

Add "Event & Program Attendance" report type to the community reports page UI.

### 3.12 Verify Phase 3

```bash
npm run typecheck   # Must pass
npm test            # Run full test suite
```

Manual smoke tests:
- Create event → publish → view on public calendar → register → verify email + ICS + Add to Calendar links
- Click "Add to Google Calendar" → verify Google Calendar opens with pre-filled event
- Download .ics from public event page (pre-registration) → verify opens in Apple Calendar/Outlook
- Download .ics from confirmation page → verify includes registrant as attendee
- Fill to capacity → verify waitlist → cancel → verify auto-promotion
- Create series → verify instance generation → register for series
- Upload sign-in sheet → OCR → confirm → verify attendance
- Check-in via QR → verify program attendance bridge
- Add waiver to event → register → sign → verify promotion
- Verify automation triggers, Google Calendar sync, cron reminders
- Embed calendar in iframe → register → verify postMessage
- Test AI chat: "create an event called Spring Gala on April 15th"

**Phase 3 deliverables:**
- [x] Middleware updated (public routes + embed headers)
- [x] Sidebar nav item added
- [x] Admin pages: list, detail (7 tabs), settings, create/edit dialogs
- [x] Public pages: layout, calendar, event detail + registration, series, confirmation (with Add to Calendar), cancellation, embeds
- [x] Dashboard event cards component
- [x] MCP tools registered
- [x] Chat tools registered (registry, MUTATING_TOOLS, colors, settings, system prompt)
- [x] Cron extended (reminders + series generation)
- [x] Google Calendar sync
- [x] Attendance reporting
- [x] All smoke tests pass

---

## 10. Testing Plan

### Unit Tests (`tests/events/`)

- **validators.test.ts** — Schema validation: valid/invalid inputs for all schemas
- **series.test.ts** — Recurrence: weekly/biweekly/monthly generation, day position, count/until limits, instance updates
- **service.test.ts** — Waitlist promotion, capacity math, Gmail connection lookup, program enrollment
- **notifications.test.ts** — ICS content, email templates, missing connection handling
- **permissions.test.ts** — RBAC for all roles across all actions

### Integration Tests

- **registration-flow.test.ts** — Full registration lifecycle: register → capacity → waitlist → cancel → promote
- **rls.test.ts** — RLS enforcement on all tables

### Smoke Tests (Manual)

- Create event → publish → register from public page → verify confirmation email + ICS
- Fill to capacity → verify waitlist → cancel → verify auto-promotion
- Create recurring series → verify instance generation → register for series
- Upload sign-in sheet → verify OCR → confirm matches → verify attendance
- Check-in via QR → verify program attendance bridge
- Export CSV → verify PII columns
- Embed in iframe → verify postMessage on registration
- Verify automation triggers, Google Calendar sync, cron reminders
- Add waiver to event → register → verify waiver email sent → sign via /sign/[token] → verify registration promoted to confirmed
- Event with multiple waivers → verify all must be signed before confirmation
- Program-linked event with both event waivers and program waivers → verify both sets created independently
