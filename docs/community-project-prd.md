# GoodRev for Non-Profits — Product Requirements Document

**Version:** 3.5
**Date:** 2026-03-20
**Status:** Draft

---

## 1. Executive Summary

GoodRev for Non-Profits adds a **"Community Center" project type** to the existing GoodRevCRM platform, plus enhanced AI assistant capabilities for non-profit operations.

**The AI Assistant** is the existing chat panel (`components/chat/`, `lib/chat/`) with new tool capabilities: receipt OCR, QuickBooks integration, contractor onboarding, and job management. It is not a separate application — it's the same chat infrastructure, extended with new tools registered via `lib/chat/tool-registry.ts`. The "mobile-first" requirement means making the existing chat panel responsive on phone screens.

**The Community Center Platform** is a new project type that replaces the B2B-oriented modules (Opportunities, RFPs, Sequences) with community-specific modules (Households, Programs, Grants, Contractors, Community Assets, Map). It shares the existing project/people/organizations infrastructure.

Everything is designed to minimize administrative burden on small, stretched-thin non-profit teams.

### What's New in v3.5

- **Digital Assistant** — existing chat panel extended with new tools for AP management, contractor lifecycle, and job tracking (mobile-responsive)
- **Dual Accounting Target** — AP workflow supports both GoodRev's built-in accounting module and QuickBooks Online, selectable per project during setup
- **Calendar Integration** — program sessions, job assignments, and grant deadlines sync to Google Calendar via existing calendar infrastructure
- **Contractor & Volunteer Management** — full lifecycle from onboarding through scope of work, document collection, job assignment, time tracking, and invoicing
- **Grant Management elevated** — grant discovery, deadline tracking, grantor outreach, grant writing support, status tracking
- **Framework Agnosticism** — support CCF, 7 Vital Conditions for Health, or custom impact frameworks (not locked to CCF)
- **Needs Assessment Isolation** — sensitive intake data stored in separate `household_intake` table with case-manager-only permissions
- **Fundraising deprioritized** — campaigns, donor pipeline, fund accounting moved to "Future Enhancements" (client uses QuickBooks for financial tracking)
- **Mobile-first design** — assistant and key workflows must be fully functional on mobile
- **Public Dashboard (V2)** — admin-curated, unauthenticated public view of aggregate community impact data with min-count thresholds, share links, and hard PII restrictions

### What was removed or deprioritized from v2.x

- Fundraising Campaigns UI (client: "I doubt I'd use this")
- Donor Pipeline / Kanban (client: "maybe?")
- Fund Accounting (client: "easy enough to use QB for this")
- Pledges & Recurring Giving
- Fundraising Events / Tickets / Sponsorships
- Tax Receipt Generation
- Donor Stewardship Touches
- Capital Depletion Tracking (client uncertain — marked for future)
- LYBUNT/SYBUNT donor analysis

These features remain in the data model as future enhancements but are not in the MVP build.

### Research Sources

- [Community Capitals Framework — MSU Extension](https://www.canr.msu.edu/news/what_are_community_capitals)
- [CCF Indicators & Metrics — Purdue Center for Regional Development](https://pcrd.purdue.edu/wp-content/uploads/2020/09/Community-Capitals-Framework-Writeup-Oct-2014.pdf)
- [7 Vital Conditions for Health and Well-Being — Well Being In the Nation Network](https://winnetwork.org/vital-conditions)
- [Community Center Management Software Guide — Plinth](https://www.plinth.org.uk/complete-guide/community-centre-management-software)
- [Closed-Loop Referrals — Unite Us](https://uniteus.com/products/closed-loop-referral-system/)
- [Grant Management for Nonprofits — NetSuite](https://www.netsuite.com/portal/resource/articles/crm/grant-management.shtml)
- [Volunteer Hour Value — Independent Sector / Civic Champs](https://www.civicchamps.com/post/how-to-calculate-volunteer-hours-value)
- [Community Asset Mapping — KU Community Tool Box](https://ctb.ku.edu/en/table-of-contents/assessment/assessing-community-needs-and-resources/geographic-information-systems/main)
- [IRS Charitable Contribution Acknowledgments](https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contributions-written-acknowledgments)

---

## 1.5 MVP / V2 / Out of Scope

**MVP (Launch Slice)** — what must ship for the product to be usable:

| Feature | Rationale |
|---------|-----------|
| Community project type + conditional sidebar | Foundation — everything else depends on this |
| Households CRUD + intake flow | Core unit of community work |
| Programs + batch attendance | Primary daily workflow for staff; dosage data for funders |
| Contributions (donations/time log) | Track value flowing through the community |
| Impact framework system (CCF default) | Tags everything; powers the dashboard and reporting |
| Community dashboard (radar + key metrics) | The "home screen" — proves value on day one |
| AI assistant: receipt OCR + bill creation (built-in or QB) | Highest-value assistant workflow per client; accounting target is a project setting |
| Calendar sync (program sessions + job assignments) | Reuses existing calendar infrastructure; low incremental effort |
| Contractor onboarding (scope + doc collection) | Second-highest-value assistant workflow |
| Job assignment + time tracking | Completes the contractor lifecycle |
| Waivers (reuse e-signature module) | Required for program enrollment compliance |
| Basic reporting (program performance, unduplicated counts) | Funders need this immediately |

**V2 (Fast Follow)** — ships within weeks after MVP:

| Feature | Rationale |
|---------|-----------|
| Grant management (pipeline, deadlines, compliance) | High value but complex; needs MVP data to be useful |
| Community Map (Leaflet + geocoding) | Visual impact — powerful but not blocking daily ops |
| Referral management (closed-loop tracking) | Needs partner directory + household data in place first |
| Household risk index | Needs enrollment + relationship data to score against |
| Broadcast messaging | Reuses existing Telnyx/Gmail; lower priority than core CRUD |
| Facility booking / events calendar | Nice-to-have; programs and assets must exist first |
| Relationships + social network tracking | Enrichment layer on top of people data |
| AI grant writing support | Needs program/attendance data to pull from |
| Grantor outreach (multi-touch emails) | Reuses sequences infrastructure |
| Public dashboard (curated, aggregate-only) | Admin-published public view of impact data; requires reporting + dashboard to exist first |

**Out of Scope (Future)** — not in the current build:

- Fundraising suite (campaigns, donor pipeline, fund accounting, pledges, events, tax receipts)
- Capital depletion tracking
- Self-service portal, kiosk mode, native mobile app
- Network graph visualization, participatory budgeting, time banking
- SDOH screening, multi-language, online giving, incident reporting
- AI legal review, background checks, payment processing
- SMS/WhatsApp as primary assistant channels (in-app chat only for MVP)

---

## 2. Impact Frameworks

### 2.1 Framework Agnosticism

The platform is **not locked to a single framework**. Community centers can select from pre-built frameworks or define their own. Each framework provides a set of **capitals/dimensions** that tag contributions, programs, assets, and reporting.

**Pre-built Frameworks:**

| Framework | Dimensions | Source |
|-----------|-----------|--------|
| Community Capitals Framework (CCF) | Natural, Cultural, Human, Social, Political, Financial, Built | MSU Extension |
| 7 Vital Conditions for Health | Humility & Willingness to Learn, Belonging & Civic Muscle, Thriving Natural World, Basic Needs, Lifelong Learning, Meaningful Work & Wealth, Reliable Transportation | Well Being In the Nation Network |
| Custom | User-defined dimensions with colors, icons, and descriptions | — |

**Implementation:** Frameworks are stored in an `impact_frameworks` table, with dimensions in a related `impact_dimensions` table (see §7 Data Model). The `project_id` column is **nullable** — rows with `project_id = NULL` are global templates (CCF, Vital Conditions), seeded during migration. When a community project selects a framework, the template and its dimensions are **cloned** into project-specific rows (with `project_id` set). Each project links to its cloned framework via `projects.impact_framework_id`. Each dimension has: `key` (slug), `label`, `color`, `icon`, `description`. Contributions, assets, and programs reference dimensions via `dimension_id` FK — there is no hardcoded capital enum.

### 2.2 Default Framework: Community Capitals (CCF)

The CCF identifies seven forms of community wealth. This is the default framework.

| Capital | Definition | Color | Icon |
|---------|-----------|-------|------|
| **Natural** | Land, water, air, biodiversity, environment, food | Green `#22c55e` | Leaf |
| **Cultural** | Heritage, arts, identity, practices, traditions | Purple `#a855f7` | Palette |
| **Human** | Education, skills, health, workforce development | Blue `#3b82f6` | GraduationCap |
| **Social** | Relationships, trust, belonging, bridging, bonding, linking | Orange `#f97316` | Handshake |
| **Political** | Civic engagement, advocacy, representation, self-organization | Red `#ef4444` | Vote |
| **Financial** | Donations, grants, fundraising, economic resources | Emerald `#10b981` | DollarSign |
| **Built** | Facilities, infrastructure, technology, housing | Slate `#64748b` | Hammer |

### 2.3 Example Workflows by Capital

**Natural Capital — Community Garden Program:**
1. Staff registers garden plot as Community Asset (capital: natural)
2. "Spring Growing Season" program created targeting Natural + Social
3. Households enroll; weekly batch attendance taken
4. Volunteer hours auto-tagged as "natural" capital (inherited from program)
5. In-kind donations (seeds, tools) tracked as contributions
6. Dashboard shows natural capital trending up

**Social Capital — Neighbor-to-Neighbor Mutual Aid:**
1. New household registered during community welcome visit
2. Staff logs neighbor relationships (bridging, bonding, linking types)
3. Service exchanges logged as contributions (capital: social)
4. Community Map shows relationship density by neighborhood — sparse areas flagged
5. Reporting shows social capital growth through new connections

**Human Capital — Job Skills Training:**
1. Grant secured and logged (type: grant, capital: human)
2. "Digital Literacy for Seniors" program created
3. Waiver required → signed via e-signature before enrollment goes active
4. Weekly batch attendance tracks dosage for funder reporting
5. Instructor volunteer hours auto-tagged as "human" capital

---

## 3. Product 1: Digital Assistant

### 3.1 Overview

The Digital Assistant is the **existing GoodRev chat panel** (`components/chat/`, `lib/chat/`, `hooks/use-chat.ts`) extended with new tool capabilities for non-profit operations. It is not a separate application.

**What exists today:** A chat panel that can query and mutate CRM data via registered tools (`lib/chat/tool-registry.ts`), with a `MUTATING_TOOLS` list for confirmation-required actions and a system prompt providing project context.

**What's new:** Receipt OCR tools, accounting integration tools (built-in or QuickBooks — configurable per project), contractor onboarding tools, job management tools, calendar sync tools, and contractor-facing query tools — all registered through the existing tool infrastructure.

**Primary interaction:** In-app chat panel (must be mobile-responsive)
**Future channel expansion:** SMS/WhatsApp integration (post-MVP — see §1.5)
**Key principle:** Staff describes what they need in plain language; the assistant handles the data entry, document generation, and notifications.

**File upload flow:** The existing chat infrastructure does not support file uploads to the LLM tool pipeline. For receipt OCR, the flow is: (1) chat client presents a file upload button (camera icon on mobile), (2) client uploads the image to cloud storage via a presigned URL, (3) client sends a chat message containing the file URL + any user context, (4) the OCR tool fetches the image from the URL for processing. The LLM never receives raw image bytes — it receives a URL and the extracted OCR data. This pattern also applies to any future file-based tool (document attachments, photo evidence for job completion).

### 3.2 Accounts Payable Management

**The problem:** Staff are in the field, at events, buying supplies. Receipts get lost. Invoices pile up. Data entry is a bottleneck.

**Accounting Target (project setting):** Each community project selects its AP target during setup:

| Option | What happens on receipt confirmation | Best for |
|--------|--------------------------------------|----------|
| **GoodRev Accounting** (built-in) | Bill created in GoodRev's accounting module (`app/api/accounting/bills`), receipt attached. Reconciled against bank transactions imported via CSV. | Orgs that want one platform for everything |
| **QuickBooks Online** | Bill created in QB via API, receipt image attached. Reconciled in QB during normal bank rec. | Orgs already using QB who don't want to switch |

This is configured in Settings → Accounting Integration (see §9) and can be changed at any time. The OCR extraction, confirmation workflow, and cloud storage steps are identical regardless of target.

**Switching accounting targets:** Changing from GoodRev Accounting to QuickBooks (or vice versa) only affects **future receipts**. Historical bills remain in the system where they were created and are displayed as read-only in GoodRev's receipt log with a badge indicating which system holds the original (e.g., "Created in QuickBooks" or "Created in GoodRev Accounting"). There is no migration of existing bills between systems. Reports pull from the receipt log (which records all confirmations regardless of target), so contribution and impact reporting is unaffected by a switch. The Settings UI shows a confirmation dialog explaining this before the change takes effect.

**Workflow:**
1. Staff takes a mobile photo of a receipt or invoice
2. Sends the scan to the assistant via chat
3. Staff speaks or types enough context for the assistant to infer:
   - **Account** (expense category)
   - **Class/Program** (program/department)
   - **Description**
4. Assistant extracts data and sends back for confirmation:
   > "Got it: **$47.23** from **Home Depot** on **3/18/2026**, Account: **Supplies**, Class: **Youth Programs**, Description: **Garden supplies for spring planting**. Is this correct?"
5. Upon confirmation:
   - Assistant uploads the receipt image to the relevant cloud folder
   - **If GoodRev Accounting:** Creates a bill in the built-in accounting module via `POST /api/accounting/bills`, maps the account/class to the project's chart of accounts, attaches receipt. Bill appears in Accounting → Bills for reconciliation.
   - **If QuickBooks:** Creates a bill in QB via API with the extracted data and attaches the receipt image. Bill can be matched to bank transactions during normal QB reconciliation.
   - **V2 enhancement (both targets):** Automatic transaction matching — assistant monitors bank feed (GoodRev bank transactions or QB bank feed) and auto-matches bills when vendor/amount/date align.

**Key capabilities:**
- OCR extraction from receipt/invoice photos (date, vendor, amount, line items)
- Account and class inference from context + historical patterns
- Dual accounting target: GoodRev built-in (`lib/accounting/`) or QuickBooks Online API, routed via an `AccountingProvider` abstraction (`lib/assistant/accounting-bridge.ts`) so UI and assistant code never branch on the target directly
- Cloud storage integration (Google Drive or similar) for receipt filing
- Confirmation loop before any action is taken

### 3.3 Contractor Management

**The problem:** Onboarding contractors is paperwork-heavy — scope of work, W9, waivers, background checks. It's all manual and things fall through the cracks.

**Workflow:**
1. User messages assistant: *"Set up John Smith as a new contractor"*
2. Assistant responds:
   > "Ok, provide details on the following to create a scope of work:
   > - Start date
   > - End date (or month-to-month)
   > - Job description
   > - Key provisions (be detailed, be short, include compensation terms)"
3. User provides details (text or voice)
4. Assistant generates a scope of work document and presents it:
   > "Here is the scope of work. What changes do you need?"
5. Revision loop until user accepts
6. Assistant asks which forms to send:
   - [ ] All
   - [ ] W9
   - [ ] Liability Waiver
   - [ ] Photo Release
   - [ ] Contractor Scope of Work
   - [ ] Policy Documents (handbook acknowledgments)
7. User selects forms
8. Assistant asks for contractor's mobile number and/or email
9. Documents sent out for signature (via existing e-signature module or DocuSign integration)
10. Assistant notifies user when all documents are signed

**Future add-on:** AI legal review of scope of work before sending
**Future add-on:** Background check integration with trusted vendor

**Document storage:** Signed documents are stored in:
- Email to all parties
- CRM (linked to person/contractor record)
- Cloud folder (user-configurable destination)

### 3.4 Job Assignment & Time Tracking

**The problem:** Assigning work to contractors is informal (texts, calls). There's no record of what was assigned, accepted, started, or completed. Time tracking is on the honor system.

**Job Assignment Workflow:**
1. Non-profit user messages: *"Assign a job to John Smith"*
2. Assistant: *"Ok, what's the job?"*
3. User describes:
   - Description of work
   - Desired start time
   - Deadline
   - Priority (High / Medium / Low)
   - Service address (when applicable)
4. Assistant checks if job fits within contractor's scope of work:
   - **If yes** → proceeds to notify contractor
   - **If no** → tells user and recommends scope addendum. User can:
     - Find another contractor
     - Accept/edit the scope revision and send for signature
     - **"Go Cowboy Mode"** — send it anyway (logged as out-of-scope)
5. Assistant notifies contractor of job request: *"You have a new job request. Accept or Reject?"*

**Job Acceptance:**
1. Contractor accepts → Assistant: *"Can you start [desired start time]?"*
2. Contractor confirms or proposes new time
3. If proposed time is past the deadline, assistant flags it and asks for another time
4. Job appears on contractor's job list in the app

**Time Tracking:**
1. When contractor opens the app, they see their active jobs
2. Select a job → press **Start** to begin the clock
3. **Pause** for breaks, **Stop** when done
4. **Complete** checkbox marks job as finished and stops clock
5. Upon completion: *"What notes or description can you add?"*
6. Contractor adds notes
7. Non-profit user notified: *"John Smith completed [job name]. Total time: 3h 45m. Notes: [contractor's notes]"*

**Safety Rails:**
- If clock runs for over X hours continuously → assistant messages contractor: *"Do you know your clock is still running?"*
- If job not started by desired start date → assistant reminds contractor: *"Today is the day to work on [job]. Want to be reminded again today?"*

**Job Decline:**
1. Contractor declines → Assistant: *"Reason?"*
2. Contractor provides reason
3. Rejection with reason sent back to non-profit user

**Job Management:**
- Non-profit user can pull a job at any time: *"Pull job Y from contractor X"*
- If accepted but no action after X days → assistant asks non-profit user: *"Want to pull this job from [contractor] and assign to someone else?"*
- Inaction warnings sent to contractor: *"It's been X days since you accepted this job — it may be pulled due to inaction"*
- Deadline warnings: *"There's only X days until the deadline — job may be pulled"*

**Unassigned Jobs:**
- Support contractors taking jobs they aren't specifically assigned to but are authorized for (based on their scope)

### 3.5 Approval Model & Audit Trail

All assistant actions that create, modify, or send external data follow a **draft → confirm → execute** pattern. The assistant never takes irreversible action without explicit user confirmation.

**Action States:**

| State | Meaning |
|-------|---------|
| `draft` | Assistant has prepared the action (extracted receipt data, generated scope, composed job request) |
| `pending_approval` | Presented to user for review — user can edit, approve, or reject |
| `approved` | User confirmed — assistant executes (creates QB bill, sends documents, notifies contractor) |
| `executed` | Action completed successfully |
| `failed` | Execution failed — user notified with error details and manual fallback |

**Audit logging:** Every assistant action is logged with: timestamp, user who approved, action type, input data, result, and whether it was modified during review. This log is queryable in Settings → Activity Log.

**Role permissions:**
- **Admin/Owner**: Can approve all assistant actions (AP, contractor onboarding, job management)
- **Staff**: Can approve AP receipts and job assignments within their programs (Staff has "Assign + manage" on jobs per §8)
- **Case Manager**: Can approve AP receipts only — no job assignment or contractor management (Case Manager has "View" on jobs per §8)
- **Contractor**: Can accept/decline jobs and manage their own time entries only — no access to household data, other contractors, or financial information

**"Go Cowboy Mode" (out-of-scope job assignment):** When a job doesn't fit a contractor's scope, the user can override. This is logged as `is_out_of_scope = true` on the job record and flagged in reporting. It does not bypass the confirmation step.

### 3.6 Contractor Support via Assistant

Contractors can also interact with the assistant for their own needs:

- *"What's on my calendar this week?"* → Lists accepted jobs in chronological order
- *"How should I approach the week?"* → Assistant uses deadlines and priorities to create a suggested work plan
- *"What jobs are available?"* → Shows unassigned jobs they're authorized for

---

## 4. Product 2: Community Center Platform

### 4.1 Project Type Selection

When creating a new project, users select the type **first**, then enter name/slug/description.

**Step 1 — Type Selection (two large cards):**

| Type | Description |
|------|-------------|
| **Standard CRM** | B2B sales pipeline, outreach sequences, RFPs, contracts |
| **Community Center** | Household-based community development with impact framework tracking |

**Step 2 — Framework Selection** (community projects only):
- Community Capitals Framework (CCF) — 7 capitals (default)
- 7 Vital Conditions for Health — 7 dimensions
- Custom — define your own dimensions

**Step 3 — Accounting Integration** (community projects only):
- **GoodRev Accounting** (built-in) — creates a linked accounting company automatically. No external setup needed.
- **QuickBooks Online** — prompts for QB OAuth connection. Account/class mapping configured after project creation.
- **Skip for now** — can be configured later in Settings. AP assistant features are disabled until an accounting target is selected.

**Step 4 — Project Details:** Name, slug (auto-generated), description.

### 4.2 Households

The fundamental unit of a community project. Households group people into family/living units.

**Fields:**
- Name (e.g., "The Martinez Family")
- Address (street, city, state, postal code, country)
- Geo coordinates (latitude, longitude) — auto-geocoded or manually placed on map
- Geocoded status (pending, success, failed, manual)
- Household size
- Primary contact (linked person)
- Notes, custom fields (JSONB)

**Household Members:**
- Person linked with relationship type: head of household, spouse/partner, child, dependent, extended family, other
- One member marked as primary contact
- **start_date / end_date** — temporal tracking when people join or leave households
- A person can belong to multiple households (e.g., split custody)

**Key views:**
- Household list with search, filter by neighborhood/address
- Household detail page: members (with date ranges), contribution history, program enrollments, relationships, notes, timeline
- Quick-add: register a new household + members in a single flow (intake form)

**Intake workflow:**
1. Walk-in or referral arrives at community center
2. Staff opens "New Household" dialog (or tells the assistant)
3. Enters household name, address, size
4. Adds members (new people or links existing) — each with start_date
5. Marks primary contact
6. Optional: immediate program enrollment
7. Optional: needs assessment notes captured
8. Address queued for background geocoding

### 4.3 Programs & Attendance

Structured activities, services, classes, and initiatives run by the community center.

**Program Fields:**
- Name, description
- Target capitals/dimensions (multi-select from active framework — used as default for contribution tagging)
- Status: planning, active, completed, suspended
- Capacity (max participants)
- Schedule (recurring: weekly Tuesday 6-8pm, or date range)
- Location (text + lat/lng for map)
- Start/end dates
- **Requires waiver** (boolean — if true, enrollment requires signed waiver before going "active")

**Program Enrollments:**
- Link a person or household to a program
- Status: active, completed, withdrawn, waitlisted
- Waiver status: not_required, pending, signed
- Enrolled date, completion date, notes

**Batch Attendance:**
- Select program → select date → see grid of enrolled members
- Click Present / Absent / Excused for each person → bulk save
- Auto-generates attendance records (person, date, status, hours)
- Attendance heatmap: color-coded grid showing attendance history
- Attendance hours feed directly into funder reporting (dosage tracking)

**Key views:**
- Program list as cards with status badges, capital dots, enrollment/capacity bar
- Program detail: description, schedule, enrollment list (with waiver status), attendance grid, contribution history
- Program performance: total attendance, unique visitors, completion rates

### 4.4 Contributions (Donations / Time)

Tracks every type of value exchange — monetary and non-monetary. Unified data model, distinct UI entry modes.

**Contribution Types:**

| Type | UI Entry Mode | Key Fields |
|------|--------------|------------|
| `monetary` | **Donations** tab | value, currency, donor (funder org) |
| `in_kind` | **Donations** tab | value (fair market estimate), description of goods |
| `volunteer_hours` | **Time Log** tab | person, hours, program (capital auto-inherited) |
| `grant` | **Donations** tab (MVP) / auto-created from grant pipeline (V2) | funder org, value, grant_id (nullable) |
| `service` | **Time Log** tab | hours, value, service description, program |

The `grant` type is a valid contribution type at all phases. It represents the **financial event** of receiving grant money — not the pipeline lifecycle. See below for the precise relationship.

**Every contribution is tagged with:**
- **Capital/dimension** — auto-inherited from linked Program's target, overridable
- **Donor** — person, organization, or household
- **Status** — pledged → received → completed (or cancelled)
- **Date** — when the contribution occurred

**Volunteer hour valuation:**
- Default rate: $33.49/hr (Independent Sector 2025 rate)
- Configurable per-project; specialized skills can override rate

**Grants vs. Contributions — source of truth:**
- The `grants` table (§4.5, V2) is the **pipeline object** — it tracks discovery, application, deadlines, compliance, and status.
- A `contribution` of type `grant` is the **financial event** — it records the value received, the date, and the impact dimension. It exists at all phases (MVP and V2).
- **In MVP** (no grant pipeline): Users log grant revenue manually via the Donations tab as a `grant`-type contribution. The `grant_id` FK is NULL because there is no linked pipeline record yet.
- **In V2** (with grant pipeline): When a grant's status changes to `awarded`, the system auto-creates a `grant`-type contribution linked via `grant_id` FK. Users can still manually create unlinked grant contributions for grants not tracked in the pipeline.
- **Reporting rule:** Impact/contribution reports pull from `contributions`. Grant pipeline reports (V2) pull from `grants`. Grant compliance reports (V2) join both tables via `grant_id` to show pipeline status alongside financial data.
- **No duplication:** A grant award produces exactly one contribution record. The `grants` row and the `contributions` row are complementary views of the same event — pipeline vs. financial.

### 4.5 Grant Management

**The problem:** Grant management is fragmented — finding opportunities in one place, tracking deadlines in another, writing proposals in a third, reporting in a fourth.

**Grant Discovery:**
- AI-assisted grant search: staff describes their programs and the assistant suggests matching grant opportunities
- Finding contacts at grantor organizations
- Track fit/interest level for each opportunity

**Grant Pipeline:**
- Status tracking: Researching → Preparing → Submitted → Under Review → Awarded / Declined
- Deadline tracking with automated reminders (LOI due, application due, report due)
- Assigned staff member per grant

**Grantor Outreach:**
- Creating and sending multi-touch email sequences for meetings with program officers
- Track communication history with grantor contacts
- Integrate with existing email infrastructure (Gmail)

**Grant Writing Support:**
- AI-assisted grant writing aligned with individual funder priorities and the organization's unfunded budget
- Pull program data, attendance, impact metrics directly into grant narratives
- Draft budget narratives from actual program costs

**Grant Compliance & Reporting:**
- Per-grant tracking: spend against budget, unduplicated participants, hours delivered
- Automated compliance reminders (monthly, quarterly, annual)
- Export grant reports with the metrics funders actually ask for

### 4.6 Contractor & Volunteer Management

Full lifecycle management for contractors and volunteers. Contractors are managed primarily through the Digital Assistant (§3.3-3.4) but the platform provides the data views and management UI.

**Contractor Records:**
- Person record with `is_contractor` flag
- Linked scope of work document(s)
- Document status: W9, waiver, photo release, policy acknowledgments (sent, signed, expired)
- Active jobs, completed jobs, total hours
- Invoicing history

**Volunteer Records:**
- Person record with volunteer program enrollments
- Hour logging via Time Log entry mode → capital auto-inherited from program
- Link to households/people supported
- Recognition: milestone badges at configurable thresholds

**Shared capabilities:**
- Waivers and key documents generated and sent for signature, stored in CRM
- Hours tracking linked to programs and households served
- Invoicing capabilities (contractors)

**Key views:**
- Contractor directory with document status, active jobs, hours
- Volunteer directory with programs, hours, recognition milestones
- Time log reports by person, program, date range

### 4.7 Community Assets & Facilities

Physical and non-physical resources owned, shared, or stewarded by the community.

**Fields:**
- Name, description, category (facility, land, equipment, vehicle, technology, other)
- Capital/dimension type
- Location (address + lat/lng), geocoded_status
- Condition: excellent, good, fair, poor
- Value estimate, steward (person or org), notes

**Facility Booking:**
- Calendar view (day/week/month) with color-coded bookings
- Conflict detection — prevent double-booking
- Linked to programs via `program_id` on `event_types` (not on `bookings` — each program session is an event type, and individual bookings/occurrences inherit the program link from their event type)

**Key views:**
- Asset list with filters: category, capital, condition
- Asset detail: info, mini-map, steward, condition history, linked programs, events calendar

### 4.8 Community Map

Interactive, full-page map built on OpenStreetMap via Leaflet/react-leaflet.

**Layers (toggleable):**

| Layer | Marker Style | Data Source |
|-------|-------------|-------------|
| Households | House icon, blue | households with lat/lng |
| Community Assets | Category-specific icons, condition-colored | community_assets with lat/lng |
| Programs | Calendar icon, status-colored | programs with lat/lng |
| Organizations | Building icon, purple | organizations with lat/lng |

**Features:**
- Click marker → popup with summary + detail link
- Filter sidebar: capital type, category, condition, program status
- Marker clustering at zoom-out
- Identify underserved areas (sparse household coverage)

**Geocoding:**
- Background queue via Nominatim (1 req/sec rate limit)
- Manual pin placement fallback

### 4.9 Relationships & Social Networks

Person-to-person connections that map the social fabric.

**Relationship Types:** Neighbor, Family, Mentor/Mentee, Friend, Caregiver, Colleague, Service Provider/Client, Other

**Views:**
- On person detail page: "Relationships" tab (community projects only)
- Relationship list at project level with filters by type
- **Identify local influencers** — people with highest relationship counts / most bridging connections
- Identify socially isolated individuals for outreach

### 4.10 Household Risk Index

Configurable vulnerability scoring to support proactive outreach. This is a **decision-support tool, not an automated action trigger** — it surfaces households for human review, never triggers adverse actions automatically.

**Default scoring signals** (all weights configurable per-project in Settings):
- Not enrolled in any programs
- No social relationships recorded
- Open referrals that haven't been resolved
- No recent contributions or engagement

**Optional demographic signals** (disabled by default — must be explicitly enabled):
- Young children in the household
- Single-adult household

These demographic signals are proxies, not risk factors. They are off by default because using them uncritically can be stigmatizing. When enabled, the UI shows a disclaimer explaining what the score means and what it doesn't.

**Governance rules:**
- The risk score is **visible only to staff with case management permissions** — not contractors, not board members, not in exports unless explicitly included
- The score **cannot trigger automated outreach, status changes, or service denials** — it only populates a review list for case managers
- Every score is **explainable** — clicking a score shows which signals contributed and their weights
- Staff can **override or dismiss** a risk flag with a note explaining why

**Views:**
- Risk score column on household list (sortable, visible to case managers only)
- Risk distribution chart on dashboard
- High-risk alert list for case managers with explainability drill-down

### 4.11 Referral Management

Closed-loop tracking for service referrals to partner organizations.

**Workflow:**
- Maintain partner directory (organizations marked as `is_referral_partner`)
- Create referrals with status: Submitted → Acknowledged → In Progress → Completed / Closed
- Automatic follow-up reminders at 7, 14, and 30 days
- Track outcomes, not just that a referral was made
- Reporting by partner and service type

### 4.12 Community Dashboard

The landing page for community projects — holistic health check.

**MVP Components:**

1. **Impact Framework Radar Chart** — spider chart scored across all active framework dimensions
2. **Key Metrics Cards:**
   - Total Households
   - Active Programs
   - Total Volunteer Hours (this period)
   - Total Contributions Value
   - Total Attendance (all programs)
   - Unique Visitors (unduplicated across programs)
3. **Program Performance:** Active programs with enrollment bars, attendance rates, completion rates
4. **Recent Activity Feed:** Latest contributions, enrollments, new households

**V2 Additions:**

5. **At-Risk Household Alerts:** Households flagged by risk index (requires V2 risk index)
6. **Geographic Coverage:** Mini-map showing household distribution (requires V2 map)
7. **% of Population/Households Impacted** — configurable denominator (census tract, zip code, or manual)

### 4.13 Broadcast Messaging

Simplified mass communication for weather alerts, schedule changes, event reminders.

- Compose message, send via email, SMS, or both
- Filter recipients by program enrollment, household, or custom criteria
- Preview recipient list before sending
- Message history

Reuses existing Telnyx SMS + Gmail email infrastructure.

### 4.14 Waivers

Reuses the existing e-signature/contracts module for liability waivers, photo releases, and policy documents.

- Programs can set `requires_waiver = true`
- On enrollment, system prompts for waiver signature
- Enrollment `waiver_status` tracks: not_required, pending, signed
- Status "active" blocked until waiver is signed
- Waiver status visible in enrollment list and batch attendance grid

### 4.15 Case Management & Intake

For community centers providing direct services.

**Intake Flow:**
1. Person/household arrives at center
2. Staff creates or finds household record
3. Needs assessment captured in a **separate `household_intake` record** (not in the household's general `custom_fields`)
4. Service referrals logged as contributions (type: service, status: pledged)
5. Follow-up tasks created

**Needs assessment isolation:** Intake/needs assessment data is stored in a dedicated `household_intake` table, not in the household's general `custom_fields` JSONB. This allows sensitive intake data (housing instability, food insecurity, health needs) to be permissioned separately from basic household CRUD. Staff can create and manage households without seeing needs assessments. Only users with case management permissions (Case Manager, Admin, Owner) can read or write intake records. See §8 permission matrix.

**Referral tracking** covered in §4.11.

### 4.16 Calendar & Accounting Integration

Community projects hook into two existing GoodRev modules — the **Calendar** (`lib/calendar/`, `app/(dashboard)/calendar/`) and **Accounting** (`lib/accounting/`, `app/(dashboard)/accounting/`) systems. These are not rebuilt for community — they're reused via cross-references and assistant tools.

**Calendar Integration (uni-directional: GoodRev → Google Calendar):**

Community calendar sync is **write-only** — GoodRev creates, updates, and deletes events in Google Calendar, but does not read back changes made in Google Calendar. If a user deletes or modifies a synced event in Google Calendar, the GoodRev record is unaffected. This avoids the complexity of bi-directional sync and conflict resolution. The existing `lib/calendar/google-calendar.ts` already supports this pattern via `createEvent()` and `deleteEvent()`.

| Community Feature | How it uses Calendar |
|---|---|
| **Program Sessions** | Programs with schedules can auto-create calendar events for each session. Staff and enrolled participants see sessions on their calendar. |
| **Facility Booking** (V2) | Reuses the existing booking infrastructure — each community asset marked as bookable gets an event type. Availability rules, conflict detection, and Google Calendar sync already built. |
| **Contractor Jobs** | Job assignments with `desired_start` and `deadline` create calendar events synced to the contractor's Google Calendar (if connected). |
| **Grant Deadlines** (V2) | LOI, submission, and report deadlines create calendar events with reminders. Assigned staff member gets the event. |

**Accounting Integration:**

| Community Feature | How it uses Accounting |
|---|---|
| **AP / Receipt Processing** | Bills created in GoodRev Accounting or QuickBooks (configurable per project — see §3.2). Receipt OCR → bill creation uses `POST /api/accounting/bills` when built-in accounting is selected. |
| **Contractor Invoicing** | Contractor hours → invoice generation via `POST /api/accounting/invoices`. Links to contractor's person record and job records. |
| **Volunteer Hour Valuation** | Volunteer hours × dollar rate can generate journal entries recording in-kind contribution value for grant reporting. |
| **Grant Fund Tracking** (V2) | Grant awards can be recorded as accounting transactions — restricted fund accounting via chart of accounts. Grant spend tracked against budget via accounting reports. |
| **Program Costs** | Program expenses tracked as bills/journal entries, enabling per-program cost reporting for funders. |

**No duplication:** Community contributions (§4.4) track the *impact framework* side of value exchanges (which capital, which program, which household). Accounting tracks the *financial* side (which GL account, debit/credit, reconciliation). A single receipt confirmation can create both a contribution record (for impact reporting) and a bill (for accounting) in one step.

### 4.17 Reporting & Analytics

**MVP Reports:**

| Report | Description |
|--------|-------------|
| Impact Framework Summary | Radar chart + table across all active dimensions |
| Contribution Summary | Totals by type, dimension, donor, status |
| Program Performance | Enrollment, attendance dosage, completion, total attendance, unique visitors |
| Household Demographics | Count, size distribution, geographic spread |
| Volunteer Impact | Hours, FTE equivalent, dollar value, top volunteers |
| Asset Condition | All assets with condition, trend, steward |
| Contractor Hours | By contractor, job, date range, scope compliance |
| Performance to Goals | Program targets vs. actuals |

**V2 Reports:**

| Report | Description |
|--------|-------------|
| Relationship Network | Connection counts, type distribution, density, key influencers |
| Grant Compliance | Per-grant: spend, unduplicated participants, hours, outcomes |
| Referral Outcomes | By partner, service type, completion rate |
| % Population Impacted | Unduplicated people served / total population |

**Unduplicated Counts:** All funder-facing reports use `COUNT(DISTINCT person_id)`.

### 4.18 Public Dashboard (V2)

A published, unauthenticated view of community impact data — curated by admins, designed for funders, board members, elected officials, and the general public.

**This is not an extension of `board_viewer`.** `board_viewer` is an authenticated internal role with project membership. The public dashboard is a published artifact with explicit admin curation and no authentication required.

**Admin curation controls:**

| Control | Options |
|---------|---------|
| Widget selection | Toggle which sections are visible (radar, metrics, program totals, contribution totals, map coverage) |
| Date range | Fixed range or rolling window (e.g., "last 12 months") |
| Data freshness | Live (real-time aggregation) or snapshot (frozen at publish time) |
| Geography granularity | Coarse only — zip code / neighborhood level. Never exact household lat/lng. |
| Branding | Custom title, intro text, logo, project description |
| Access control | Public URL, password-protected URL, or signed share link with expiration |

**Hard restrictions (not configurable — enforced at the API/rendering layer):**
- **Aggregate-only** — no individual names, household names, person records, or organization names
- **No activity feed** — no recent events, no audit trail, no timeline
- **No drill-through** — public dashboard links do not lead to internal detail pages
- **Minimum-count thresholds** — any metric derived from fewer than N records (configurable, default 5) is suppressed with "< 5" to prevent deanonymization via small cohorts
- **Excluded categories** — minors data, intake/needs assessments, risk scores, referral details, contractor details, and any PII are never shown regardless of widget selection
- **No export** — the public dashboard is view-only, no CSV/PDF export buttons

**Publish model:**

| State | Meaning |
|-------|---------|
| `draft` | Admin is configuring widgets, not accessible externally |
| `preview` | Accessible via a preview URL (admin only, authenticated) |
| `published` | Live at public URL, accessible per access control settings |
| `archived` | Previously published, no longer accessible. Snapshot data retained. |

**Widgets available for public dashboard:**

| Widget | Data shown | Notes |
|--------|-----------|-------|
| Impact Radar | Dimension scores across active framework | Same radar as internal dashboard |
| Aggregate Metrics | Total households served, active programs, volunteer hours, contribution value, attendance, unique visitors | Counts only — no names |
| Program Totals | Number of programs by status, total enrollment, total attendance hours | Program names visible (they are not PII), but no enrollee names |
| Contribution Totals | Total by type and dimension | No donor names |
| Map Coverage (V2) | Heatmap or zone shading showing service area coverage | **Never** individual household/asset markers — only aggregated density by zip/neighborhood |

**Key views:**
- Settings → Public Dashboard: configuration UI with live preview
- Public URL: `/public/{project-slug}/{dashboard-slug}` — renders the curated dashboard without authentication (password-protected dashboards show a prompt first)
- Admin can generate/revoke share links from Settings

**Data model:**

| Table | Purpose |
|-------|---------|
| `public_dashboard_configs` | Per-project configuration: `project_id`, `status` (draft/preview/published/archived), `title`, `description`, `logo_url`, `date_range_type`, `date_range_start/end`, `data_freshness` (live/snapshot), `access_type` (public/password/signed_link), `password_hash`, `min_count_threshold`, `geo_granularity`, `widgets JSONB` (array of enabled widget configs), `snapshot_data JSONB` (frozen data when freshness=snapshot), `published_at`, `archived_at`, timestamps |
| `public_dashboard_share_links` | Signed share links: `config_id` FK, `token`, `expires_at`, `created_by`, `label` |

---

## 5. Navigation Structure

### Community Project Sidebar — MVP

```
Dashboard
──────────────────
Households
People
Organizations
──────────────────
Programs
──────────────────
Contractors
Volunteers
──────────────────
Community Assets
──────────────────
Reporting
──────────────────
Chat (AI Assistant)
Settings
```

### Added in V2

```
Grants                  (V2)
Community Map           (V2)
Broadcasts              (V2)
Public Dashboard        (V2, in Settings)
```

Items hidden for community projects: Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News

---

## 6. User Personas & Workflows

### Persona 1: Maria — Community Center Director

**Daily workflow (MVP):**
- Opens Community Dashboard → checks impact radar + program performance
- Messages assistant: *"Log the Home Depot receipt"* → sends photo → confirms details
- Opens Programs → batch attendance for morning ESL class
- Messages assistant: *"Set up a new contractor — Maria Lopez, bilingual tutor, starting next week"*

**Added in V2:**
- Reviews at-risk household alerts on dashboard
- Checks grant compliance reports

### Persona 2: James — Program Coordinator

**Weekly workflow (MVP):**
- Opens Programs → "Weekend Food Bank" → batch attendance for Saturday shift
- Logs volunteer hours via Time Log tab: 8 volunteers × 4 hours = 32 hours
- Checks program performance: 85% attendance rate, 47 unique visitors this month

**Added in V2:**
- Sends broadcast: schedule change SMS to all food bank volunteers

### Persona 3: Aisha — Case Worker / Intake Specialist

**Intake workflow (MVP):**
- New family walks in → creates Household
- Needs assessment captured in `household_intake` record (separate from household — case manager permission required)
- Family enrolled in program → waiver signed → status: active

**Added in V2:**
- Referral logged → closed-loop status tracking begins
- Risk index calculated automatically, flagged for review

### Persona 4: David — Board Member / Funder Liaison

**Monthly workflow (MVP):**
- Opens Dashboard → impact radar + key metrics
- Opens Reporting → program performance, unduplicated counts
- Exports data for board presentation

**Added in V2:**
- Reviews grant compliance: per-grant spend, participants, hours
- Checks % of population impacted: 12% of census tract served

### Persona 5: John — Contractor

**Daily workflow:**
- Opens app → sees job list with priorities and deadlines
- Asks assistant: *"How should I approach the week?"* → gets prioritized work plan
- Selects job → presses Start → works → presses Complete → adds notes
- Non-profit user gets completion notification with time logged

---

## 7. Data Model Summary

### New Tables

| Table | Primary Purpose |
|-------|----------------|
| `impact_frameworks` | Configurable framework definitions (CCF, Vital Conditions, custom) |
| `impact_dimensions` | Individual dimensions within a framework (replaces hardcoded capital enum) |
| `households` | Family/living unit grouping with geo |
| `household_members` | Person ↔ Household junction with temporal bounds |
| `contributions` | All value exchanges (money, time, goods, grants, services) |
| `grants` | Grant opportunities, applications, and compliance tracking |
| `contractor_scopes` | Scope of work documents for contractors |
| `jobs` | Job assignments with status, priority, deadline |
| `job_time_entries` | Clock in/out records for job time tracking |
| `community_assets` | Physical/non-physical community resources |
| `programs` | Structured community activities |
| `program_enrollments` | Person/Household ↔ Program with waiver status |
| `program_attendance` | Batch attendance records (date, status, hours) |
| `relationships` | Person-to-person social connections |
| `receipt_confirmations` | Receipt/invoice OCR results, confirmation status, and accounting target routing — single source of truth for AP history regardless of which accounting system holds the bill |
| `broadcasts` | Mass messaging |
| `referrals` | Service referrals with closed-loop tracking |
| `household_intake` | Separately permissioned needs assessment data per household |
| `public_dashboard_configs` | Per-project public dashboard configuration: widgets, access control, branding, snapshot data |
| `public_dashboard_share_links` | Signed/expiring share links for public dashboards |

### Modified Tables

| Table | Change |
|-------|--------|
| `projects` | Add `project_type`, `impact_framework_id` |
| `people` | Add `latitude`, `longitude`, `is_contractor`, `is_volunteer` |
| `organizations` | Add `latitude`, `longitude`, `is_referral_partner` |
| `event_types` | Add `asset_id` FK → `community_assets` (facility booking), `program_id` FK → `programs` (program session scheduling) |
| `project_memberships` | Extend role ENUM via `ALTER TYPE public.project_role ADD VALUE` for `staff`, `case_manager`, `contractor`, `board_viewer` |

### Key Composite Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `program_attendance` | `(program_id, date)` | Batch attendance grid |
| `program_attendance` | `(program_id, person_id, date)` UNIQUE | Prevent duplicates |
| `contributions` | `(project_id, dimension_id)` | Dimension-based reporting |
| `contributions` | `(donor_person_id, date)` | Donor history |
| `household_members` | `(household_id, end_date)` | Current member lookups |
| `household_members` | `(person_id, start_date, end_date)` | Person household history |
| `jobs` | `(project_id, contractor_id, status)` | Job list queries |
| `grants` | `(project_id, status)` | Grant pipeline queries |
| `referrals` | `(project_id, status)` | Open referral queries |

---

## 8. Data Privacy & Access Control

**Role model:** Community projects use the existing GoodRev role system with community-specific permission scopes. Roles are not additive flags — each user has exactly one role per project.

**Implementation gap — dual permission architecture required:** The codebase today only supports four project roles: `owner`, `admin`, `member`, `viewer` (defined in `types/user.ts`, enforced in `lib/projects/permissions.ts`, stored as a Postgres ENUM in `0003_project_memberships.sql`). The community permission matrix below requires four new roles: **Staff**, **Case Manager**, **Contractor**, and **Board Viewer**.

**Why two permission systems must coexist:** The existing `requireProjectRole()` in `lib/projects/permissions.ts` uses a **rank-based** model (`owner=3 > admin=2 > member=1 > viewer=0`). This works for standard CRM routes where roles are linearly ordered. Community roles are **not linearly ordered**: `staff` can assign jobs but cannot access intake; `case_manager` can access intake but can only view jobs. Forcing these into a linear rank would produce incorrect authorization (e.g., ranking `staff > case_manager` would give staff intake access they shouldn't have).

**Required architecture:**
- **Standard CRM routes** continue to use `requireProjectRole()` with the existing rank-based model — **no changes whatsoever** to `lib/projects/permissions.ts`.
- **Community routes** use a new **capability/resource matrix** model in `lib/projects/community-permissions.ts`:

```typescript
// New: lib/projects/community-permissions.ts
type CommunityResource = 'households' | 'intake' | 'programs' | 'contributions'
  | 'risk_scores' | 'referrals' | 'grants' | 'jobs' | 'assistant_ap'
  | 'dashboard' | 'reports' | 'settings' | 'public_dashboard';
type CommunityAction = 'view' | 'create' | 'update' | 'delete' | 'export_pii' | 'manage';

function checkCommunityPermission(
  role: ProjectRole, resource: CommunityResource, action: CommunityAction
): boolean;
// Backed by a static permission map derived from the matrix below.
```

- **SQL equivalent:** A new `community_has_permission(p_project_id UUID, p_resource TEXT, p_action TEXT)` function that looks up the calling user's membership role via `auth.uid()` + `project_memberships` (same pattern as the existing `has_project_role()` in `0004_projects_rls.sql`), then checks it against the capability matrix. RLS policies on all community tables call this function — **not** `has_project_role()`, which cannot express community permissions.

**TypeScript type safety:** The existing `ROLE_RANK` in `lib/projects/permissions.ts` is typed as `Record<ProjectRole, number>`. Adding community roles to `ProjectRole` without adding them to `ROLE_RANK` would break compilation. The fix: split into `StandardProjectRole` (the original 4) and `CommunityProjectRole` (the new 4), with `ProjectRole = StandardProjectRole | CommunityProjectRole`. Retype `ROLE_RANK` and `requireProjectRole()` to use `StandardProjectRole`. No behavioral change to existing code — all existing callers pass `StandardProjectRole` literals.

Phase 1 must: (1) extend the Postgres role ENUM, (2) split `ProjectRole` into `StandardProjectRole | CommunityProjectRole` in TypeScript, (3) retype `permissions.ts` to use `StandardProjectRole`, (4) implement `checkCommunityPermission()` in TypeScript, (5) implement `community_has_permission()` in SQL, (6) write RLS policies for all new community tables that call the SQL function, (7) write automated per-role RLS tests. Frontend conditional rendering alone is not sufficient — every "—" in the matrix below must be enforced at the database/API layer by the absence of a matching RLS allow-policy (Postgres RLS is allow-based; there is no `DENY` primitive — access is denied by default unless an explicit policy grants it).

| Role | Households | Intake/Needs | Programs | Contributions | Risk Scores | Referrals | Grants | Jobs | Assistant (AP) | Dashboard | Reports | Settings | Public Dashboard |
|------|-----------|-------------|----------|--------------|-------------|-----------|--------|------|---------------|-----------|---------|----------|-----------------|
| **Owner** | CRUD | CRUD | CRUD | CRUD | View + configure | CRUD | CRUD | CRUD + pull | Full | Full | Full + export PII | Full | Manage |
| **Admin** | CRUD | CRUD | CRUD | CRUD | View + configure | CRUD | CRUD | CRUD + pull | Full | Full | Full + export PII | Full | Manage |
| **Staff** | CRUD | — | CRUD | CRUD | View | CRUD | View | Assign + manage | Approve own receipts | Full | Standard (no PII export) | View only | — |
| **Case Manager** | CRUD | CRUD | CRUD | CRUD | View + override/dismiss | CRUD | View | View | Approve own receipts | Full | Standard + risk reports | View only | — |
| **Contractor** | — | — | — | — | — | — | — | Own jobs: accept/decline/time + view unassigned jobs matching own scope (read-only) | — | — | — | Own profile only | — |
| **Board Viewer** | — | — | — | — | — | — | View | — | — | Aggregate only | Aggregate only (no PII) | — | — |

"Staff" in the assistant approval model (§3.5) maps to the **Staff** role for AP + job actions, and to both **Staff** and **Case Manager** for AP-only actions. "Admin/Owner" maps to **Owner** and **Admin**.

**Audit logging:** All data access and mutations are logged (existing `activity_log` pattern). Sensitive actions (viewing risk scores, accessing needs assessments, exporting PII) generate audit entries visible to project admins.

**Contractor surface:** Contractors access the **same web app** as staff, but with a restricted view enforced by their role. When a contractor logs in, they see:
- Their job list (active + completed)
- Time tracking UI (start/pause/stop/complete per job)
- Their profile and scope documents
- The chat panel (assistant responds only to contractor-scoped queries: calendar, work plan, available jobs)
- **Profile → Calendar Integration**: a "Connect Google Calendar" button on their profile page. This is the contractor's only settings surface — it triggers the same Google Calendar OAuth flow used by staff (`/api/calendar/integrations/google/connect`). Once connected, job assignments and deadlines sync to their calendar automatically. Sync errors surface as a banner on the contractor's job list ("Calendar sync failed — reconnect in Profile"). Contractors can disconnect at any time from the same profile section.

They do **not** see: the sidebar navigation, households, people, organizations, programs, assets, dashboard, reports, or settings beyond their own profile. This is the same Next.js app with conditional rendering based on role — not a separate portal or codebase.

**Contractor invitation flow:** Admin sends invite via email/SMS with a magic link. Contractor creates account (or links existing), is assigned the Contractor role on that project. No access to any other project.

**Contractor data isolation:** The AI assistant respects role boundaries — contractor-facing tools cannot query household, people, or organizational data.

**Document handling:** W9s, signed waivers, and contractor documents are stored with access restricted to project admins. They are not indexed by search, not included in exports, and not accessible to the AI assistant's context window.

**Minors:** Household member records for children (relationship type: child/dependent) are flagged. Reports involving minors use aggregate counts only — individual minor records are excluded from exports and board-level views by default.

**Retention:** Configurable per-project. Default: active data retained indefinitely; deleted households/people are soft-deleted (recoverable for 90 days, then hard-deleted).

**Search exclusion:** The `household_intake` table must be excluded from global search indexing entirely. Needs assessment data should never appear in search results, autocomplete, or AI assistant context. This is a hard requirement — search is a common vector for data leakage across permission boundaries.

**RLS test mandate:** Before deploying any community-project phase, RLS policies for all new tables must be tested per-role. Specifically, a Contractor-role user must receive zero rows when querying `households`, `household_intake`, `contributions`, `programs`, `community_assets`, `grants`, `referrals`, `relationships`, and `broadcasts`. These tests must be automated (not just manual verification) and run in CI. This addresses known fragility in the existing RLS layer.

---

## 8.5 Integration Failure Behavior

Each external integration has a defined failure mode:

| Integration | Source of Truth | On Failure | Manual Fallback |
|------------|----------------|-----------|-----------------|
| **GoodRev Accounting** (AP — built-in) | GoodRev accounting module is the system of record | Bill creation is local — failures are rare (DB errors). Marked `failed` with error shown. | User creates bill manually in Accounting → Bills |
| **QuickBooks** (AP — external) | GoodRev holds receipt data; QB is the accounting system | Bill creation retried 3x, then marked `failed` with error shown to user | User can download receipt + extracted data and enter in QB manually |
| **Google Calendar** (program/job sync) | GoodRev is source of truth; Calendar is a sync target | Event creation failures logged; calendar shows "sync pending" badge | User can manually create event in Google Calendar |
| **E-Signature** (waivers, scopes) | GoodRev contracts module | If signing service is down, document status stays `pending`; user notified | User can collect wet signature and manually update status |
| **Telnyx SMS** (broadcasts) | GoodRev tracks send status | Per-recipient delivery status tracked; failures shown in broadcast detail | User can resend to failed recipients or switch to email-only |
| **Gmail** (broadcasts, outreach) | GoodRev tracks send status | OAuth token refresh failures surface as "reconnect email" prompt | User reconnects Gmail in Settings |
| **Nominatim** (geocoding) | GoodRev stores lat/lng | Failed geocodes stay `status: failed`; retryable via batch job | User can manually place pin on map |

---

## 9. Settings (Community-Specific)

- **Accounting Integration**: Select AP target — **GoodRev Accounting** (built-in) or **QuickBooks Online** (requires OAuth connection). Configurable during project setup and changeable at any time. When QB is selected, a "Connect QuickBooks" OAuth flow is shown. When built-in is selected, the project is linked to a GoodRev accounting company (created automatically or linked to an existing one).
- **Calendar Sync**: Enable/disable automatic calendar event creation for program sessions, job assignments, and grant deadlines. Requires at least one team member with a connected Google Calendar.
- **Impact Framework**: Select or customize the active framework
- **Volunteer Hour Rate**: Default dollar value per volunteer hour
- **Default Map Center**: Lat/lng + zoom level
- **Intake Form Fields**: Configure custom fields for household intake
- **Dimension Scoring Weights**: Adjust how each dimension is scored on radar chart
- **Active Dimensions**: Enable/disable individual dimensions
- **Risk Index Weights**: Configure which signals contribute to household risk scoring
- **Organization EIN**: For grant applications and any receipt generation
- **Contractor Settings**: Default scope of work template, required documents checklist
- **Job Settings**: Default inaction warning period, clock-running alert threshold

---

## 9.5 Non-Breaking Implementation Rules

The community project type is **additive** — it must not regress, modify, or interfere with the existing standard CRM (sales) project type. The two project types share the same infrastructure (projects, people, organizations, auth, teams) but present different feature profiles.

**Hard rules:**

1. **Default preservation:** `project_type` column defaults to `'standard'`. All existing projects are backfilled as `standard` automatically. No existing row changes meaning.

2. **No shared file rewrites:** Do not rewrite `project-sidebar.tsx`, `project-dashboard`, or any existing page to be community-first. Instead, **branch by `project_type`** at the rendering layer:
   ```
   // ✅ Correct: branch at the top, leave standard path untouched
   if (project.project_type === 'community') return <CommunitySidebar />;
   return <ProjectSidebar />;  // existing, unchanged
   ```

3. **No shared route changes:** Existing API routes (`/api/projects/[slug]/opportunities/`, `/api/projects/[slug]/contracts/`, etc.) must not be modified, guarded, or type-checked. Community routes live in new paths (`/api/projects/[slug]/households/`, `/api/projects/[slug]/programs/`, etc.).

4. **New tables only:** Community entities (households, programs, contributions, etc.) are new tables. No columns are added to `opportunities`, `contracts`, `sequences`, `rfps`, or any existing sales-oriented table.

5. **Shared tables are extended, not changed:** When adding columns to shared tables (`projects`, `people`, `organizations`), use `ADD COLUMN IF NOT EXISTS` with nullable defaults so existing queries are unaffected. The new columns (`is_contractor`, `is_volunteer`, `latitude`, `longitude`, `is_referral_partner`) are all nullable or default `false` — they don't change the shape of existing data.

6. **Navigation hiding is one-directional:** Community projects hide sales nav items (Opportunities, RFPs, Sequences, etc.). Standard projects do **not** see community nav items. Neither type's sidebar is aware of the other's modules — they just don't render them.

7. **Existing tests must pass:** After every phase, run the full test suite. Any failure in existing sales-oriented tests is a regression and must be fixed before merging.

**Verification:** After Phase 1 + Phase 2, create both a standard CRM project and a community project in the same org. The standard project must behave identically to how it behaved before the migration — same sidebar, same dashboard, same routes, same data.

---

## 10. Technical Implementation Phases

### MVP Phases

**Phase 1: Foundation (Database + Types)**
- Migration: project_type, impact frameworks, **all new tables** (including V2 entities like `grants`, `relationships`, `broadcasts`, `referrals`), geo columns, indexes. V2 tables are created upfront to avoid future migration conflicts and FK dependency issues — but their API routes, UI, and business logic are deferred to V2 phases. Facility booking reuses the existing calendar infrastructure (`event_types`, `bookings`) — there is no separate `events` table.
- Regenerate TypeScript types
- Zod validators for all community entities
- Framework dimension system (configurable dimensions)

**Phase 2: Project Creation + Navigation**
- Type-first selector in project creation dialog
- Framework selection step
- Accounting integration selector (GoodRev Accounting / QuickBooks / Skip)
- Conditional sidebar navigation (MVP nav only)
- Basic community dashboard (radar + metrics + activity feed + program cards)

**Phase 3: Core Entities**
- Households CRUD (API + UI + intake flow)
- Programs CRUD (API + UI + enrollments + batch attendance)
- Waivers (reuse contracts module — required for program enrollment)
- Contributions CRUD (API + UI + mode-specific entry)
- Community Assets CRUD (API + UI)
- Basic reporting (program performance, unduplicated counts, contribution summary)

**Phase 4: Digital Assistant — Core**
- Mobile-responsive chat panel
- Receipt/invoice OCR and data extraction
- AP confirmation workflow (draft → confirm → execute)
- Accounting bridge: route bills to GoodRev Accounting (built-in) or QuickBooks Online based on project setting
- Calendar sync: program sessions + job assignments → Google Calendar events (reuses existing `lib/calendar/` infrastructure)
- Cloud storage integration for receipt filing

**Phase 5: Contractor & Job Management**
- Contractor onboarding workflow (scope generation, document collection)
- Job assignment, acceptance, decline flows
- Time tracking (start/pause/stop/complete)
- Job notifications and safety rails
- Contractor support queries (calendar, work plan)
- Contractor portal (restricted view of the same web app)

### V2 Phases

**Phase 6: Grant Management**
- Grant pipeline CRUD (API + UI)
- Deadline tracking with reminders
- Grantor outreach (multi-touch emails)
- AI-assisted grant writing with program data integration
- Grant compliance reporting

**Phase 7: Map + Visualization**
- Install Leaflet/react-leaflet
- Community Map with all layers
- Geocoding background queue
- Dashboard V2 additions (mini-map, % population impacted)

**Phase 8: Enrichment Features**
- Referral management with closed-loop tracking
- Household risk index (computation + dashboard alerts + explainability)
- Relationships CRUD (person detail tab + influencer identification)
- Broadcasts (SMS/email)
- Facility booking / events calendar

**Phase 8.5: Public Dashboard**
- `public_dashboard_configs` + `public_dashboard_share_links` tables (created in Phase 1 migration)
- Admin configuration UI (widget selection, date range, branding, access control)
- Public rendering route (unauthenticated, aggregate-only, minimum-count thresholds)
- Share link generation/revocation
- Optional: map coverage heatmap (requires Phase 7 map infrastructure)

**Phase 9: Integrations**
- MCP tools for all community entities
- Chat agent tools
- Automation events (community-specific)

---

## 11. Success Metrics

**Speed Metrics (MVP):**

| Metric | Target |
|--------|--------|
| Household intake completion | < 2 min |
| Receipt processing via assistant | < 30 sec (photo to confirmation) |
| Contractor onboarding (scope + docs sent) | < 10 min via assistant |
| Job assignment to contractor notification | < 1 min |
| Batch attendance for 20-person class | < 1 min |
| Impact radar visible | 1 click from any page |

**Speed Metrics (V2):**

| Metric | Target |
|--------|--------|
| Grant report data export | < 30 sec |
| Map load with all layers | < 3 sec |

**Accuracy & Reliability Metrics:**

| Metric | Target |
|--------|--------|
| Receipt OCR field extraction accuracy | > 90% (date, vendor, amount correct without manual edit) |
| % receipts successfully matched/created in QB | > 85% on first attempt |
| Contractor onboarding completion rate | > 90% (all docs signed within 7 days of send) |
| Waiver completion rate (programs requiring waivers) | > 95% before first attendance |
| Job acceptance rate | > 80% (accepted vs. declined/pulled) |

**Adoption Metrics (measured 30 days post-launch):**

| Metric | Target |
|--------|--------|
| Weekly active staff using the platform | > 80% of org staff |
| Weekly active contractors using time tracking | > 70% of active contractors |
| Assistant interactions per staff per week | > 3 (indicates assistant is replacing manual work) |
| Programs with batch attendance used (vs. not tracked) | > 90% of active programs |
| Households with complete intake data | > 75% |

---

## 12. Future Enhancements (Post-MVP)

### Fundraising Suite (deprioritized per client)
- Fundraising Campaigns with thermometer visualization
- Donor Pipeline (Kanban: Identification → Qualification → Cultivation → Solicitation → Stewardship)
- Fund Accounting (restricted/unrestricted/designated funds)
- Pledges & Recurring Giving
- Fundraising Events (galas, auctions) with tickets and sponsorships
- Tax Receipt Generation (IRS-compliant PDFs)
- Donor Stewardship Touches
- LYBUNT/SYBUNT Donor Analysis
- Donor Tier Management

### Capital Depletion Tracking (client uncertain)
- Record losses alongside gains (direction: inflow/outflow)
- Severity categorization (minor/moderate/major)
- Net capital flow reporting

### Other Future Features
- Self-service portal for community members
- Kiosk mode / pre-registration link
- Native mobile app
- Network graph visualization
- Participatory budgeting
- Time banking
- SDOH screening integration (PRAPARE, AHC-HRSN)
- Multi-language support
- Online giving page (Stripe)
- Incident reporting
- Inventory / lending library
- AI legal review for contractor scopes
- Background check integration
- Payment processing / program fees

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Assistant accuracy on receipt OCR | Confirmation loop before any action; human always approves |
| QuickBooks integration complexity | Start with bill creation (simplest); add transaction matching iteratively |
| Scope of work legal adequacy | Templates reviewed by legal; AI legal review as future add-on |
| Contractor adoption of time tracking | Simple start/stop UX; reminder nudges from assistant |
| Framework agnosticism adds complexity | Default to CCF; custom frameworks are power-user feature |
| Data privacy — household/needs data | RLS per-project; role-based access; encrypted at rest |
| **Contractor role does not yet exist in the codebase** | The repo today only has `owner`, `admin`, `member`, `viewer` as project roles (`types/user.ts`, `lib/projects/permissions.ts`, `0003_project_memberships.sql`). The PRD's Contractor and Case Manager roles require new role values, new RLS policies, and new permission checks in every community API route. This is not a UI-hiding problem — if the API layer doesn't enforce role-based row filtering, a contractor could query `/api/projects/[slug]/households` directly. **Phase 1 must add the new roles to the membership system and Phase 5 (Contractor Portal) must not ship without per-role RLS tests in CI** (see §8 RLS test mandate). |
| Board Viewer role is also new | Same gap — `viewer` exists but `board_viewer` with aggregate-only, no-PII constraints does not. Must be implemented alongside Contractor role in Phase 1. |
| Geocoding costs at scale | Free Nominatim with rate limiting; manual pin fallback |
| Grant writing AI quality | AI drafts, human reviews; pull real data to ground the narrative |
| Mobile responsiveness | Mobile-first design for assistant; progressive enhancement for platform |

---

*This PRD is a living document. Sections will be refined based on implementation learnings and ongoing client feedback.*
