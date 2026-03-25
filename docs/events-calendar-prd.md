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
- Confirmation page uses query params (matching booking pattern)
- ICS calendar file download via `/api/events/ics?token={confirmation_token}`
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
- **OCR**: Image sent to Claude Vision API (Anthropic SDK) for name extraction
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

---

## 3. Database Schema

### Migration: `0147_events_calendar.sql`

All tables use `IF NOT EXISTS`, `handle_updated_at()` trigger, and RLS enabled.

### 3.1 `event_calendar_settings`

1:1 per project. Public URL configuration and branding.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL FK → projects | UNIQUE |
| is_enabled | BOOLEAN DEFAULT FALSE | |
| slug | TEXT NOT NULL UNIQUE | Public URL segment. Format: `^[a-z0-9][a-z0-9-]*[a-z0-9]$` |
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
| requires_waiver | BOOLEAN DEFAULT FALSE | |
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
| requires_waiver | BOOLEAN DEFAULT FALSE | |
| waiver_template_id | UUID | Plain column, no FK (table doesn't exist yet) |
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
| status | TEXT DEFAULT 'confirmed' | CHECK: pending_approval, confirmed, waitlisted, cancelled |
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

### 3.8 Schema Modifications to Existing Tables

**`notes` table (migration 0024):**
- ADD COLUMN `event_id UUID REFERENCES public.events(id) ON DELETE CASCADE`
- ADD COLUMN `category TEXT` (values: feedback, observation, general)
- ADD INDEX on `event_id`

**`notifications` table (migration 0034):**
- ALTER CHECK constraint on `type` column to add `'event_registration'` and `'event_reminder'`

**Storage:**
- Create `event-covers` bucket (`public: true`) with RLS policy

### 3.9 RPCs

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
7. Determine status: confirmed, waitlisted (if full + waitlist enabled), or pending_approval
8. INSERT registration + tickets
9. Return registration ID

**Error pattern:** `RAISE EXCEPTION 'ERROR_CODE: message'` — caller parses via `error.message.includes('ERROR_CODE')`.

**Error codes:** `EVENT_NOT_FOUND`, `REGISTRATION_CLOSED`, `INVALID_INPUT`, `INVALID_TICKET_TYPE`, `TICKET_SOLD_OUT`, `CAPACITY_FULL`

**Grants:** `service_role` only (public routes use `createServiceClient()`).

#### `get_public_events` / `get_public_event_detail` (SECURITY DEFINER)

Public-facing event listing and detail. Join calendar settings with events where `status='published'` and `visibility='public'` (detail also allows `'unlisted'`). Include registration counts and remaining capacity.

### 3.10 RLS Policies

All tables get RLS enabled + service_role bypass.

Community tables use `community_has_permission(project_id, 'events', action)`. The migration **must update** the `community_has_permission()` function to add `'events'` as a valid resource with role permissions:
- owner/admin: view, create, update, delete, export_pii, manage
- staff/case_manager: view, create, update
- contractor/board_viewer: NO_ACTIONS

Public registration goes through SECURITY DEFINER RPCs (bypasses RLS).

### 3.11 Indexes

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
| `ics/route.ts` | GET | no | ICS file download by confirmation_token |

---

## 5. Pages

### 5.1 Admin Pages — `app/(dashboard)/projects/[slug]/events/`

| Page | Description |
|---|---|
| `page.tsx` | Event list with calendar/list toggle (FullCalendar), status tabs, search, create button |
| `[id]/page.tsx` | Event detail with tabs: Info, Registrations, Attendance, Feedback & Observations, Analytics, Check-in |
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
| Fuzzy matching | `jaroWinkler()`, `scorePersonMatch()` from `lib/deduplication/detector.ts` | Sign-in sheet OCR matching |
| CSV export | `rowsToCsv()` from `lib/reports/csv-export.ts` | Registration export |
| Publish controls | `PublishControls` from `components/community/public-dashboard/publish-controls.tsx` | Draft/publish toggle |
| Person search | `PersonCombobox` from `components/ui/person-combobox.tsx` | Manual registration |
| Notes panel | `NotesPanel` from `components/notes/notes-panel.tsx` | Event feedback/observations |
| Charts | recharts + `components/ui/chart.tsx` | Attendance trend charts |

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

### 6.3 New Files

| File | Purpose |
|---|---|
| `lib/events/service.ts` | Core service: waitlist promotion, capacity status, program enrollment bridge |
| `lib/events/series.ts` | Series instance generation, template updates, series registration |
| `lib/events/notifications.ts` | Gmail connection lookup, confirmation/cancellation/reminder emails |
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

1. **`community_has_permission()` SQL function must be updated** in migration 0147 (CREATE OR REPLACE) to add `'events'` as the 18th resource. Both SQL and TypeScript permission matrices must stay in sync.

2. **Notifications `type` CHECK constraint** is auto-named (likely `notifications_type_check`). Must ALTER to add new values. Use a `DO $$` block to query `pg_constraint` for the exact name.

3. **`AutomationEntityType` is a constrained union** — must add new entity types or `emitAutomationEvent()` calls will fail TypeScript compilation.

4. **Zod `.partial()` strips `.refine()` validation** — use `.superRefine()` after `.partial()` for update schemas.

5. **`createClient()` is async, `createServiceClient()` is sync** — public routes must use `createServiceClient()` (no await, no cookies).

6. **Rate limit key format** must match booking pattern: `ip:${ip}` and `email:${email}`.

7. **RPC returns UUID on success**, not JSONB. Tokens are column defaults — fetch them in a separate query after the RPC returns.

8. **`program_enrollments` has no unique constraint** on `(person_id, program_id)` — must guard against duplicates with a check query before insert.

9. **MCP tools use community RBAC** — `defineCommunityTool()` with `resource: 'events'`, NOT `checkPermission(ctx.role, 'viewer')`.

10. **Sidebar nav items are role-conditional** — Events must be hidden for `board_viewer` and `contractor`.

11. **`event_calendar_settings` PUT needs upsert** — use `.upsert()` with `onConflict: 'project_id'` to handle concurrent requests.

12. **`waiver_template_id` has no FK** — the `waiver_templates` table doesn't exist. Keep as plain UUID column.

13. **`generate_series` in RPC duplicates attendee info** across expanded tickets with quantity > 1. This is correct for V1 — individual attendee assignment is a future enhancement.

---

## 9. Implementation Steps

### Step 1: Migration + Types (Foundation)
- Create `0147_events_calendar.sql` with all tables, constraints, indexes, RPCs, RLS, triggers
- Update `community_has_permission()`, notifications CHECK constraint
- Create storage bucket
- Deallocate prepared statements + push migration
- Regenerate TypeScript types
- Run typecheck, fix issues
- Add interfaces to `types/community.ts`
- Install `qrcode.react` and `rrule`

### Step 2: Permissions + Automation Types
- Add `'events'` to `CommunityResource` in `lib/projects/community-permissions.ts`
- Add event trigger/entity types to `types/automation.ts`

### Step 3: Validators
- Create `lib/validators/event.ts`
- Write validator tests

### Step 4: Service Layer
- Create `lib/events/service.ts` (waitlist, capacity, enrollment bridge)
- Create `lib/events/series.ts` (instance generation, template updates)
- Create `lib/events/notifications.ts` (Gmail lookup, emails)
- Create `lib/events/scan-attendance.ts` (OCR + fuzzy matching)
- Write service tests

### Step 5: Admin API Routes
- Create all routes under `app/api/projects/[slug]/events/`
- Write permission tests

### Step 6: Admin UI
- Sidebar nav, dashboard cards
- Event list page with calendar/list toggle
- Event detail page with all tabs
- Settings page
- Create/edit dialogs
- Series management UI
- Sign-in sheet scan UI

### Step 7: Public API + Pages
- Update middleware
- Create public API routes
- Create public pages (calendar, detail, confirmation, cancellation)
- Write registration flow tests

### Step 8: MCP + Chat Tools
- Create MCP tools, register in server
- Add chat tools, update MUTATING_TOOLS, colors, settings, system prompt

### Step 9: Cron + Calendar Sync
- Extend booking-reminders cron with event reminders + series instance generation
- Add `syncEvent()` to calendar bridge

### Step 10: Attendance Reporting
- Add `generateAttendanceTrendReport()` to reports
- Add report type to community reports page
- Add analytics tabs to event and program detail pages

### Step 11: Embeds
- Create embed pages with iframe headers and postMessage

### Step 12: Final Verification
- Full test suite, typecheck, manual smoke tests

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
