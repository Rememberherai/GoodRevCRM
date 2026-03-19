# GoodRev for Non-Profits — Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-19
**Status:** Draft

---

## 1. Executive Summary

GoodRev for Non-Profits is a **two-product platform** purpose-built for community centers and non-profit organizations:

1. **GoodRev Digital Assistant** — A mobile-first AI chat interface that handles accounts payable, contractor management, and job/time tracking through natural conversation. Staff talk to the assistant via text or voice, and it handles the paperwork.

2. **GoodRev Community Center Platform** — A web application for managing households, programs, community assets, grants, contractors/volunteers, and measuring impact through configurable frameworks (Community Capitals Framework, 7 Vital Conditions for Health, or custom).

Both products share a common data layer and project context. The assistant is the primary mobile interface; the platform is the primary desktop interface. Everything is designed to minimize administrative burden on small, stretched-thin non-profit teams.

### What's New in v3.0 (Rescoped from Client Feedback)

- **Digital Assistant** — entirely new mobile-first AI product for AP management, contractor lifecycle, and job tracking
- **Contractor & Volunteer Management** — full lifecycle from onboarding through scope of work, document collection, job assignment, time tracking, and invoicing
- **Grant Management elevated** — grant discovery, deadline tracking, grantor outreach, grant writing support, status tracking
- **Framework Agnosticism** — support CCF, 7 Vital Conditions for Health, or custom impact frameworks (not locked to CCF)
- **Fundraising deprioritized** — campaigns, donor pipeline, fund accounting moved to "Future Enhancements" (client uses QuickBooks for financial tracking)
- **Mobile-first design** — assistant and key workflows must be fully functional on mobile

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

## 2. Impact Frameworks

### 2.1 Framework Agnosticism

The platform is **not locked to a single framework**. Community centers can select from pre-built frameworks or define their own. Each framework provides a set of **capitals/dimensions** that tag contributions, programs, assets, and reporting.

**Pre-built Frameworks:**

| Framework | Dimensions | Source |
|-----------|-----------|--------|
| Community Capitals Framework (CCF) | Natural, Cultural, Human, Social, Political, Financial, Built | MSU Extension |
| 7 Vital Conditions for Health | Humility & Willingness to Learn, Belonging & Civic Muscle, Thriving Natural World, Basic Needs, Lifelong Learning, Meaningful Work & Wealth, Reliable Transportation | Well Being In the Nation Network |
| Custom | User-defined dimensions with colors, icons, and descriptions | — |

**Implementation:** The capital/dimension system is stored as a configurable array on the project record rather than a hardcoded enum. Each dimension has: `key` (slug), `label`, `color`, `icon`, `description`. Pre-built frameworks are templates that populate this array.

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

A mobile-first AI chat interface that non-profit staff interact with via text or voice. The assistant handles administrative tasks through conversation, reducing the need for staff to navigate complex software screens on the go.

**Primary interaction:** Mobile chat (SMS, WhatsApp, or in-app chat)
**Secondary interaction:** Web chat panel within the GoodRev platform
**Key principle:** Staff describes what they need in plain language; the assistant handles the data entry, document generation, and notifications.

### 3.2 Accounts Payable Management

**The problem:** Staff are in the field, at events, buying supplies. Receipts get lost. Invoices pile up. Data entry into QuickBooks is a bottleneck.

**Workflow:**
1. Staff takes a mobile photo of a receipt or invoice
2. Sends the scan to the assistant via chat
3. Staff speaks or types enough context for the assistant to infer:
   - **Account** (expense category)
   - **Class** (program/department)
   - **Description**
4. Assistant extracts data and sends back for confirmation:
   > "Got it: **$47.23** from **Home Depot** on **3/18/2026**, Account: **Supplies**, Class: **Youth Programs**, Description: **Garden supplies for spring planting**. Is this correct?"
5. Upon confirmation:
   - Assistant uploads the receipt image to the relevant cloud folder
   - Assistant holds the transaction data until it appears in QuickBooks, OR creates it as a bill that can be matched to the bank transaction later
   - Assistant attaches the receipt image to the QB transaction

**Key capabilities:**
- OCR extraction from receipt/invoice photos (date, vendor, amount, line items)
- Account and class inference from context + historical patterns
- QuickBooks Online integration (bill creation, transaction matching, attachment upload)
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

### 3.5 Contractor Support via Assistant

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

**Step 3 — Project Details:** Name, slug (auto-generated), description.

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

### 4.4 Contributions (Donations / Time / Grants)

Tracks every type of value exchange — monetary and non-monetary. Unified data model, distinct UI entry modes.

**Contribution Types:**

| Type | UI Entry Mode | Key Fields |
|------|--------------|------------|
| `monetary` | **Donations** tab | value, currency, donor |
| `in_kind` | **Donations** tab | value (fair market estimate), description of goods |
| `volunteer_hours` | **Time Log** tab | person, hours, program (capital auto-inherited) |
| `grant` | **Grants** tab | funder org, value, status, compliance dates |
| `service` | **Time Log** tab | hours, value, service description, program |

**Every contribution is tagged with:**
- **Capital/dimension** — auto-inherited from linked Program's target, overridable
- **Donor** — person, organization, or household
- **Status** — pledged → received → completed (or cancelled)
- **Date** — when the contribution occurred

**Volunteer hour valuation:**
- Default rate: $33.49/hr (Independent Sector 2025 rate)
- Configurable per-project; specialized skills can override rate

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
- Linked to programs and events

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

Automatic vulnerability scoring for proactive outreach.

The system scores each household on a 0-100 scale based on:
- Not enrolled in any programs
- No social relationships recorded
- Open referrals that haven't been resolved
- No recent contributions or engagement
- Young children in the household
- Single-adult household

High-risk households are flagged automatically so case managers can reach out proactively.

**Views:**
- Risk score column on household list (sortable)
- Risk distribution chart on dashboard
- High-risk alert list for case managers

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

**Components:**

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
5. **At-Risk Household Alerts:** Households flagged by risk index
6. **Geographic Coverage:** Mini-map showing household distribution
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
3. Needs assessment via configurable custom fields
4. Service referrals logged as contributions (type: service, status: pledged)
5. Follow-up tasks created

**Referral tracking** covered in §4.11.

### 4.16 Reporting & Analytics

**Standard Reports:**

| Report | Description |
|--------|-------------|
| Impact Framework Summary | Radar chart + table across all active dimensions |
| Contribution Summary | Totals by type, capital, donor, status |
| Program Performance | Enrollment, attendance dosage, completion, total attendance, unique visitors |
| Household Demographics | Count, size distribution, geographic spread |
| Volunteer Impact | Hours, FTE equivalent, dollar value, top volunteers |
| Asset Condition | All assets with condition, trend, steward |
| Relationship Network | Connection counts, type distribution, density, key influencers |
| Grant Compliance | Per-grant: spend, unduplicated participants, hours, outcomes |
| Referral Outcomes | By partner, service type, completion rate |
| Contractor Hours | By contractor, job, date range, scope compliance |
| % Population Impacted | Unduplicated people served / total population |
| Performance to Goals | Program targets vs. actuals |

**Unduplicated Counts:** All funder-facing reports use `COUNT(DISTINCT person_id)`.

---

## 5. Navigation Structure

### Community Project Sidebar

```
Dashboard
──────────────────
Households
People
Organizations
──────────────────
Programs
Grants
──────────────────
Contractors
Volunteers
──────────────────
Community Assets
Community Map
──────────────────
Broadcasts
Reporting
──────────────────
Chat (AI Assistant)
Settings
```

Items hidden for community projects: Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News

---

## 6. User Personas & Workflows

### Persona 1: Maria — Community Center Director

**Daily workflow:**
- Opens Community Dashboard → checks impact radar + program performance
- Reviews at-risk household alerts
- Messages assistant: *"Log the Home Depot receipt"* → sends photo → confirms details
- Opens Programs → batch attendance for morning ESL class
- Messages assistant: *"Set up a new contractor — Maria Lopez, bilingual tutor, starting next week"*

### Persona 2: James — Program Coordinator

**Weekly workflow:**
- Opens Programs → "Weekend Food Bank" → batch attendance for Saturday shift
- Logs volunteer hours via Time Log tab: 8 volunteers × 4 hours = 32 hours
- Checks program performance: 85% attendance rate, 47 unique visitors this month
- Sends broadcast: schedule change SMS to all food bank volunteers

### Persona 3: Aisha — Case Worker / Intake Specialist

**Intake workflow:**
- New family walks in → creates Household
- Needs assessment captured in custom fields
- Referral logged → status tracking begins
- Family enrolled in program → waiver signed → status: active
- Risk index calculated automatically

### Persona 4: David — Board Member / Funder Liaison

**Monthly workflow:**
- Opens Dashboard → impact trends + key metrics
- Reviews grant compliance: 47 households (unduplicated), 1,200 hours delivered
- Checks % of population impacted: 12% of census tract served
- Exports data for board presentation

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
| `events` | Facility bookings |
| `broadcasts` | Mass messaging |
| `referrals` | Service referrals with closed-loop tracking |

### Modified Tables

| Table | Change |
|-------|--------|
| `projects` | Add `project_type`, `impact_framework_id` |
| `people` | Add `latitude`, `longitude`, `is_contractor`, `is_volunteer` |
| `organizations` | Add `latitude`, `longitude`, `is_referral_partner` |

### Key Composite Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `program_attendance` | `(program_id, date)` | Batch attendance grid |
| `program_attendance` | `(program_id, person_id, date)` UNIQUE | Prevent duplicates |
| `contributions` | `(project_id, capital_type)` | Capital-based reporting |
| `contributions` | `(donor_person_id, date)` | Donor history |
| `household_members` | `(household_id, end_date)` | Current member lookups |
| `household_members` | `(person_id, start_date, end_date)` | Person household history |
| `jobs` | `(project_id, contractor_id, status)` | Job list queries |
| `grants` | `(project_id, status)` | Grant pipeline queries |
| `referrals` | `(project_id, status)` | Open referral queries |

---

## 8. Settings (Community-Specific)

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

## 9. Technical Implementation Phases

### Phase 1: Foundation (Database + Types)
- Migration: project_type, impact frameworks, all new tables, geo columns, indexes
- Regenerate TypeScript types
- Zod validators for all community entities
- Framework dimension system (configurable capitals)

### Phase 2: Project Creation + Navigation
- Type-first selector in project creation dialog
- Framework selection step
- Conditional sidebar navigation
- Basic community dashboard

### Phase 3: Core Entities
- Households CRUD (API + UI + intake flow)
- Programs CRUD (API + UI + enrollments + batch attendance)
- Contributions CRUD (API + UI + mode-specific entry)
- Community Assets CRUD (API + UI)
- Relationships CRUD (API + person detail tab)

### Phase 4: Digital Assistant — Core
- Mobile-responsive chat interface
- Receipt/invoice OCR and data extraction
- AP confirmation workflow
- QuickBooks Online integration (bill creation, transaction matching, attachments)
- Cloud storage integration for receipt filing

### Phase 5: Contractor & Job Management
- Contractor onboarding workflow (scope generation, document collection)
- Job assignment, acceptance, decline flows
- Time tracking (start/pause/stop/complete)
- Job notifications and safety rails
- Contractor support queries (calendar, work plan)

### Phase 6: Grant Management
- Grant pipeline CRUD (API + UI)
- Deadline tracking with reminders
- Grantor outreach (multi-touch emails)
- AI-assisted grant writing with program data integration
- Grant compliance reporting

### Phase 7: Map + Visualization
- Install Leaflet/react-leaflet
- Community Map with all layers
- Geocoding background queue
- Impact radar chart on dashboard
- Risk index computation + alerts

### Phase 8: Supporting Features
- Broadcasts (SMS/email)
- Waivers (reuse contracts module)
- Facility booking / events calendar
- Referral management with closed-loop tracking
- Household risk index

### Phase 9: Integrations
- MCP tools for all community entities
- Chat agent tools
- Automation events (community-specific)

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Household intake completion | < 2 min |
| Receipt processing via assistant | < 30 sec (photo to confirmation) |
| Contractor onboarding (scope + docs sent) | < 10 min via assistant |
| Job assignment to contractor notification | < 1 min |
| Grant report data export | < 30 sec |
| Batch attendance for 20-person class | < 1 min |
| Map load with all layers | < 3 sec |
| Impact radar visible | 1 click from any page |

---

## 11. Future Enhancements (Post-MVP)

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

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Assistant accuracy on receipt OCR | Confirmation loop before any action; human always approves |
| QuickBooks integration complexity | Start with bill creation (simplest); add transaction matching iteratively |
| Scope of work legal adequacy | Templates reviewed by legal; AI legal review as future add-on |
| Contractor adoption of time tracking | Simple start/stop UX; reminder nudges from assistant |
| Framework agnosticism adds complexity | Default to CCF; custom frameworks are power-user feature |
| Data privacy — household/needs data | RLS per-project; role-based access; encrypted at rest |
| Geocoding costs at scale | Free Nominatim with rate limiting; manual pin fallback |
| Grant writing AI quality | AI drafts, human reviews; pull real data to ground the narrative |
| Mobile responsiveness | Mobile-first design for assistant; progressive enhancement for platform |

---

*This PRD is a living document. Sections will be refined based on implementation learnings and ongoing client feedback.*
