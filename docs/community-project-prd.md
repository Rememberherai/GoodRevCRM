# Community Project Type — Product Requirements Document

**Version:** 2.1
**Date:** 2026-03-17
**Status:** Draft

---

## 1. Executive Summary

GoodRevCRM today serves B2B sales teams. This PRD defines a new **"Community Project"** type that transforms the platform into a one-stop-shop for **community center directors, neighborhood organizers, and nonprofit leaders** who need to manage households, track multi-capital contributions, run programs, raise funds, manage donors, map community assets, coordinate volunteers, and report outcomes to funders — all from a single tool.

The design is grounded in the **Community Capitals Framework (CCF)**, a widely-adopted model from rural sociology that identifies **seven forms of community wealth**: Natural, Cultural, Human, Social, Political, Financial, and Built capital. Rather than tracking just money (like a sales CRM), a Community Project tracks the full spectrum of value flowing through a community.

### What's New in v2.0

- **Full Fundraising Suite** — campaigns, donor pipeline, pledges/recurring giving, fund accounting (restricted/unrestricted), tax receipts, fundraising events with tickets and sponsorships
- **Batch Attendance** — enrollment ≠ attendance; funders want dosage-based reporting
- **Mode-Specific Contribution Entry** — Donations, Time Log, and Grants as distinct UI entry modes
- **Smart Capital Defaults** — contributions auto-inherit capital type from linked Program
- **Household Fluidity** — start_date/end_date on household members for temporal accuracy
- **Broadcast Messaging** — simplified mass comms replacing Sequences for community projects
- **Waivers** — reuse existing e-signature/contracts module for program liability waivers
- **Geocoding Background Queue** — async geocoding with status tracking, rate-limited
- **Unduplicated Counts** — native support for distinct-person reporting required by funders

### What's New in v2.1

- **Performance Indexing Strategy** — composite indexes on high-volume tables (`program_attendance`, `contributions`, `household_members`) to support batch queries and temporal lookups
- **Infrastructure Reuse Clarifications** — explicit notes on reusing existing `lib/contracts/`, `lib/pdf/`, Telnyx, and Gmail infrastructure (no new dependencies for PDF generation or messaging)
- **Temporal Query Patterns** — documented query approach for household member fluidity (date-range overlaps, current-member filters)
- **Denormalized Aggregate Trigger Details** — specifics on DB triggers for `campaign.raised_amount`, `fund.balance`, and `pledge.paid_amount`

### Research Sources

- [Community Capitals Framework — MSU Extension](https://www.canr.msu.edu/news/what_are_community_capitals)
- [CCF Indicators & Metrics — Purdue Center for Regional Development](https://pcrd.purdue.edu/wp-content/uploads/2020/09/Community-Capitals-Framework-Writeup-Oct-2014.pdf)
- [CCF Overview — South Dakota State University](https://wyoextension.org/parkcounty/wp-content/uploads/2015/12/Community-Capitals-Overview-from-South-Dakota-State-University.pdf)
- [CCF Sustainability Metrics — UMaine](https://internal.umfk.edu/library/faculty/scholarship/archive/gauvin/ccfsustainabiliymetricsandprocess.pdf)
- [Community Center Management Software Guide — Plinth](https://www.plinth.org.uk/complete-guide/community-centre-management-software)
- [Amilia Community Center Software](https://www.amilia.com/industry/community-center-management-software)
- [Communal — Community Center Software](https://getcommunal.com/)
- [Case Management in Community Services — Acuity International](https://acuityinternational.com/blog/what-is-case-management-in-community-services/)
- [Social Capital Measurement — Institute for Social Capital](https://www.socialcapitalresearch.com/measure-social-capital/)
- [Volunteer Hour Value — Independent Sector / Civic Champs](https://www.civicchamps.com/post/how-to-calculate-volunteer-hours-value)
- [Closed-Loop Referrals — Unite Us](https://uniteus.com/products/closed-loop-referral-system/)
- [Community Asset Mapping — KU Community Tool Box](https://ctb.ku.edu/en/table-of-contents/assessment/assessing-community-needs-and-resources/geographic-information-systems/main)
- [Grant Management for Nonprofits — NetSuite](https://www.netsuite.com/portal/resource/articles/crm/grant-management.shtml)
- [Donor Cultivation Cycle — Neon One](https://neonone.com/resources/blog/donor-cultivation-cycle/)
- [Donor Pipeline Management — Keela](https://www.keela.co/blog/donor-pipeline)
- [Donor Stewardship Guide — Alyster Ling](https://alysterling.com/donor-stewardship/)
- [Nonprofit Fundraising CRM Features — Bloomerang](https://bloomerang.com/)
- [Nonprofit Fund Accounting Basics — Araize](https://araize.com/nonprofit-fund-accounting-basics/)
- [IRS Charitable Contribution Acknowledgments](https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contributions-written-acknowledgments)
- [Donation Receipt Compliance — Donorbox](https://donorbox.org/nonprofit-blog/create-a-501c3-tax-compliant-donation-receipt)
- [CDFI Fund — US Treasury](https://www.cdfifund.gov/)
- [Fundraising Event Management — GiveSmart](https://www.givesmart.com/)

---

## 2. The Seven Capitals — Definitions, Indicators & Workflows

The CCF posits that community well-being emerges from the interplay of seven capitals. Each capital is both an **asset stock** (what you have) and a **flow** (what's being invested, built, or depleted). A healthy community invests across all seven — over-investing in one at the expense of others leads to fragility.

### 2.1 Natural Capital

**Definition:** The land, water, air, soil, biodiversity, climate, and natural resources of a place.

**What to track:**
- Community gardens, parks, green spaces, waterways, forests
- Clean-up events and environmental volunteer hours
- Stewardship assignments (who maintains what)
- Condition assessments over time (excellent → poor)
- Environmental programs (recycling drives, tree planting, watershed restoration)

**Indicators:**
- Acres of maintained green space
- # of environmental stewardship volunteers
- Hours invested in natural capital activities
- Biodiversity inventories / species counts
- Water quality measurements
- % of land under active stewardship

**Workflow — Community Garden Program:**
1. **Asset creation**: Staff registers a community garden plot as a Community Asset (type: land, capital: natural, condition: good, lat/lng pinned on map)
2. **Program creation**: "Spring Growing Season 2026" program created targeting Natural + Social capital
3. **Enrollment**: Households enroll for garden plots → program enrollment records created
4. **Attendance**: Weekly batch attendance taken — who showed up to tend plots
5. **Contribution tracking**: Volunteer hours auto-tagged as "natural" capital (inherited from program)
6. **In-kind tracking**: Seed donations, tool lending tracked as in-kind contributions
7. **Assessment**: Quarterly condition update on the garden asset
8. **Reporting**: Capital dashboard shows natural capital trending up based on increased hours + asset condition improvements

---

### 2.2 Cultural Capital

**Definition:** The traditions, heritage, values, languages, arts, and shared identity of a community.

**What to track:**
- Cultural events and festivals
- Heritage preservation projects
- Arts programs (classes, exhibitions, performances)
- Language programs and multilingual services
- Oral history and storytelling projects
- Cultural spaces and venues

**Indicators:**
- # of cultural events hosted per quarter
- Attendance at cultural programs (unduplicated count)
- # of languages represented in programs
- Cultural assets preserved (murals, historic sites, archives)
- $ invested in cultural programming
- # of cultural mentorship relationships

**Workflow — Heritage Festival:**
1. **Campaign creation**: "Heritage Festival 2026" fundraising campaign targeting Cultural capital, goal: $5,000
2. **Fundraising event**: Create the festival event, link to campaign, set up sponsorship tiers (Gold $1k, Silver $500, Bronze $250)
3. **Program creation**: "Annual Harvest Festival" program targeting Cultural + Social capital
4. **Sponsorship outreach**: Add local businesses to donor pipeline → move through cultivation → solicitation
5. **Contribution tracking**:
   - Sponsorships: Corporate sponsors recorded as monetary contributions linked to campaign + fund
   - In-kind: Food donations, decor, sound equipment
   - Volunteer: Setup/teardown hours auto-tagged as cultural capital
6. **Tax receipts**: Auto-generated for monetary sponsors over $250
7. **Attendance**: Batch attendance on festival day
8. **Outcome**: Campaign thermometer updates, attendance count, new household registrations, cultural assets documented

---

### 2.3 Human Capital

**Definition:** The skills, abilities, education, health, knowledge, and leadership capacity of people in the community.

**What to track:**
- Skills inventories of community members
- Education and training programs (GED, computer literacy, job skills)
- Health and wellness programs
- Leadership development initiatives
- Certifications and credentials earned
- Mentorship pairings

**Indicators:**
- # of people completing training programs (unduplicated)
- Skills inventory depth (unique skills catalogued)
- # of active mentorship relationships
- Program completion rates
- # of certifications/credentials earned
- Health program participation rates
- Leadership positions filled by community members

**Workflow — Job Skills Training:**
1. **Grant secured**: Foundation grant logged (type: grant, capital: human, $15,000) → allocated to "Youth Programs" restricted fund
2. **Campaign**: "Digital Literacy Initiative" campaign, goal: $20,000, targeting Human + Financial capital
3. **Program creation**: "Digital Literacy for Seniors" — target capitals: Human, Financial
4. **Waiver required**: Program marked `requires_waiver = true` → liability waiver template assigned
5. **Enrollment**: Individuals enroll → waiver signed via e-signature → status becomes "active"
6. **Attendance**: Weekly batch attendance tracks dosage for funder reporting
7. **Contributions**: Instructor volunteer hours auto-tagged as "human" capital; donated laptops as in-kind
8. **Reporting**: Grant compliance report shows unduplicated participants, attendance hours, in-kind value, all pulled from "Youth Programs" fund

---

### 2.4 Social Capital

**Definition:** The relationships, networks, trust, norms of reciprocity, and mutual aid within and between communities.

**What to track:**
- Person-to-person relationships (neighbors, friends, mentors, caregivers)
- Community groups and associations (informal and formal)
- Mutual aid exchanges (time banks, tool libraries, meal trains)
- Community events that build social bonds
- Network density and bridging connections
- Conflict resolution activities

**Indicators:**
- # of registered relationships in the system
- Relationship type diversity (bridging vs. bonding)
- Mutual aid exchanges per month
- Event attendance and repeat attendance
- # of new relationships formed per quarter
- Volunteer retention rate
- Household-to-household connection density

**Workflow — Neighbor-to-Neighbor Mutual Aid:**
1. **Intake**: New household registered during community welcome visit → members added with start_date, primary contact designated
2. **Relationship mapping**: Staff logs neighbor relationships between adjacent households
3. **Contribution tracking**: When Household A provides childcare for Household B, logged as service contribution (type: service, capital: social, hours: 4) — capital auto-inherited from "Good Neighbors" program
4. **Reciprocity tracking**: Household B helps Household A with yard work → another service contribution logged
5. **Broadcast**: "Snow day — Community Center closed" SMS sent to all "Good Neighbors" enrollees
6. **Network visualization**: Community Map shows relationship density by neighborhood — sparse areas flagged for outreach
7. **Reporting**: Social capital score reflects relationship count, diversity, and reciprocity balance

---

### 2.5 Political Capital

**Definition:** The ability of community members to influence public decisions, access resources, and exercise civic voice — including voter participation, representation, advocacy, and organizing.

**What to track:**
- Civic engagement activities (town halls, public comment, council meetings)
- Advocacy campaigns and outcomes
- Leadership roles held by community members on boards, commissions
- Voter registration drives
- Community organizing initiatives
- Partnerships with government agencies

**Indicators:**
- # of civic engagement events hosted/attended
- # of community members serving on boards/commissions
- Voter registration counts
- Advocacy campaign wins/losses
- # of government partnerships active
- Resident participation in public meetings
- Grant funding secured through advocacy

**Workflow — Civic Engagement Campaign:**
1. **Program creation**: "Know Your Rights Workshop Series" — target capitals: Political, Human
2. **Enrollment**: Community members register; household data provides demographic context
3. **Batch attendance**: Track who actually attends each session (not just enrolled)
4. **Contribution tracking**: Facilitator hours + civic engagement grant auto-tagged as "political" capital
5. **Relationship building**: Connections between residents and local officials → logged as relationships
6. **Outcome**: Track which participants subsequently attend council meetings, join boards, or register to vote
7. **Reporting**: Political capital trends show increased civic participation correlated with program attendance

---

### 2.6 Financial Capital

**Definition:** Money, savings, credit, investment, charitable giving, grants, earned income, and the economic resources available to a community — including in-kind value converted to monetary equivalents.

**What to track:**
- Monetary donations and pledges (one-time and recurring)
- Fundraising campaigns with goals and progress
- Grant applications, awards, and compliance
- Fund balances (restricted, unrestricted, designated)
- In-kind donation monetary equivalents
- Donor pipeline and cultivation stages
- Sponsorship revenue
- Fundraising event revenue (tickets, auctions, sponsors)
- Tax receipt generation and compliance

**Indicators:**
- Total monetary contributions received (by period)
- Total in-kind value (hours x rate + goods fair market value)
- Grant dollars awarded vs. applied
- Pledge fulfillment rate (pledged → received conversion)
- Contribution diversity (# of unique donors)
- Donor retention rate (LYBUNT/SYBUNT tracking)
- Recurring giving growth rate
- Cost per dollar raised
- Revenue by source type (individual, corporate, government, foundation)
- Restricted vs. unrestricted fund balance ratio

**Workflow — Annual Fundraising Cycle:**
1. **Campaign creation**: "2026 Annual Fund" campaign, goal: $50,000, targeting all capitals
2. **Donor pipeline**: Major donor prospects identified, assigned to staff for cultivation
3. **Pledge management**: Key donors make pledges ($1,000/month for 12 months) → recurring pledge created
4. **Fundraising event**: "Spring Gala" with ticket tiers (General $50, VIP $150, Sponsor Table $1,000) + sponsorship levels
5. **Contributions tracked all year**: Every donation tagged with campaign, fund, and capital type
6. **Fund accounting**: Restricted grant funds tracked separately from unrestricted annual fund
7. **Tax receipts**: Auto-generated for all monetary + in-kind contributions, IRS-compliant
8. **Stewardship**: Thank-you letters sent; stewardship touches logged (calls, visits, recognition)
9. **Donor directory**: LYBUNT/SYBUNT flags identify lapsed donors for re-engagement
10. **Funder report**: Filter by grant/fund + date range → export unduplicated participants, hours, in-kind value, capital distribution
11. **Dashboard**: Financial capital card shows YTD giving, pledge pipeline, fund balances, campaign progress

---

### 2.7 Built Capital

**Definition:** The physical infrastructure, facilities, housing, technology, transportation, and constructed assets that support community life.

**What to track:**
- Facilities (community centers, libraries, schools, clinics)
- Housing stock and condition
- Technology infrastructure (computers, internet access, AV equipment)
- Transportation assets (vans, buses, bike racks)
- Playgrounds, sports facilities, public spaces
- Maintenance and improvement projects
- Facility bookings and utilization

**Indicators:**
- # of community assets by category and condition
- Facility utilization rate (bookings / available hours)
- Condition trend (improving, stable, declining)
- $ invested in maintenance and improvements
- Technology access points available
- # of facility bookings per month
- Infrastructure improvement projects completed

**Workflow — Facility Management + Capital Campaign:**
1. **Asset registration**: Community Center building logged as Community Asset (category: facility, capital: built, condition: fair)
2. **Campaign**: "Building Renovation Fund" capital campaign, goal: $100,000, targeting Built capital
3. **Fund**: "Building Renovation" restricted fund created → donations allocated here
4. **Contributions**: Major donor gifts, corporate sponsors, foundation grants all flow into restricted fund
5. **Condition monitoring**: Quarterly assessments update asset condition; renovation improves fair → good → excellent
6. **Map visualization**: All built assets visible with condition-based color coding
7. **Reporting**: Built capital index reflects asset count, average condition score, fund balance, and investment trend

---

## 3. Core Feature Set

### 3.1 Project Type Selection

When creating a new project, users select the type **first**, then enter name/slug/description.

**Step 1 — Type Selection (two large cards):**

| Type | Description | Modules Available |
|------|-------------|-------------------|
| **Standard CRM** | B2B sales pipeline, outreach sequences, RFPs, contracts | Organizations, People, Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News |
| **Community Center** | Household-based community development with 7-capital tracking, full fundraising suite | Households, People, Organizations, Campaigns, Donations, Donors, Funds, Fundraising Events, Programs, Community Assets, Community Map, Broadcasts, Relationships, Reporting |

**Step 2 — Project Details:** Name, slug (auto-generated), description.

The type is stored on the project record. The sidebar, dashboard, and available features adapt accordingly.

---

### 3.2 Households

The fundamental unit of a community project. Households group people into family/living units.

**Fields:**
- Name (e.g., "The Martinez Family")
- Address (street, city, state, postal code, country)
- Geo coordinates (latitude, longitude) — auto-geocoded or manually placed on map
- Geocoded status (pending, success, failed, manual)
- Household size
- Primary contact (linked person)
- Notes
- Custom fields (JSONB)

**Household Members:**
- Person linked with relationship type: head of household, spouse/partner, child, dependent, extended family, other
- One member marked as primary contact
- **start_date / end_date** — enables temporal tracking when people join or leave households (supports custody changes, divorces, moves)
- A person can belong to multiple households (e.g., split custody)

**Temporal Query Patterns:**
- **Current members**: `WHERE end_date IS NULL OR end_date > NOW()` — active household roster
- **Members at a point in time**: `WHERE start_date <= :date AND (end_date IS NULL OR end_date > :date)` — historical snapshots for reporting
- **Overlapping households**: A person with overlapping date ranges in multiple households indicates shared custody or transitional housing — both are valid
- **Index**: Composite index on `(household_id, end_date)` supports efficient current-member lookups; `(person_id, start_date, end_date)` supports per-person household history

**Key views:**
- Household list with search, filter by neighborhood/address
- Household detail page: members (with date ranges), contribution history, program enrollments, relationships, notes, timeline, **giving tab** (if they're donors)
- Quick-add: register a new household + members in a single flow (intake form)

**Intake workflow:**
1. Walk-in or referral arrives at community center
2. Staff opens "New Household" dialog
3. Enters household name, address, size
4. Adds members (new people or links existing) — each with start_date
5. Marks primary contact
6. Optional: immediate program enrollment
7. Optional: needs assessment notes captured
8. Address queued for background geocoding → household appears on map when resolved

---

### 3.3 Contributions (Donations / Time / Grants)

Tracks every type of value exchange — monetary and non-monetary. The **data model is unified**, but the **UI presents distinct entry modes** to reduce friction.

**Contribution Types:**

| Type | UI Entry Mode | Key Fields |
|------|--------------|------------|
| `monetary` | **Donations** tab | value, currency, fund, campaign, receipt # |
| `in_kind` | **Donations** tab | value (fair market estimate), description of goods |
| `volunteer_hours` | **Time Log** tab | person, hours, program (capital auto-inherited) |
| `grant` | **Grants** tab | funder org, value, status, compliance dates, fund |
| `service` | **Time Log** tab | hours, value, service description, program |

**Every contribution is tagged with:**
- **Capital type** — auto-inherited from linked Program's `target_capitals[0]`, overridable
- **Donor** — person, organization, or household
- **Recipient** — person, organization, household, or program (nullable)
- **Campaign** — which fundraising campaign this supports (nullable)
- **Fund** — which fund this flows into (nullable)
- **Pledge** — if this is a pledge fulfillment payment (nullable)
- **Status** — pledged → received → completed (or cancelled)
- **Date** — when the contribution occurred or is expected
- **Receipt #** — auto-generated for monetary/in-kind; receipt_sent_at tracks acknowledgment

**Key views:**
- Contribution list with filters: type, capital, status, date range, donor, campaign, fund
- Capital breakdown view: contributions grouped by capital type with totals
- Donor leaderboard: top contributors by value + hours
- Contribution detail: full info with linked entities + receipt download button

**Volunteer hour valuation:**
- Default rate: $33.49/hr ([Independent Sector 2025 rate](https://www.civicchamps.com/post/how-to-calculate-volunteer-hours-value))
- Configurable per-project in settings
- Auto-calculates monetary equivalent for reporting
- Specialized skills can override rate (e.g., pro bono legal at $200/hr)

**Performance Note:** `contributions` is the second-highest-volume table after `program_attendance`. Composite indexes on `(project_id, capital_type)`, `(project_id, campaign_id)`, `(project_id, fund_id)`, and `(donor_person_id, date)` are critical for reporting queries and donor history lookups. See §4 Data Model for full index list.

---

### 3.4 Fundraising Campaigns

Goal-based fundraising efforts that aggregate contributions and track progress.

**Fields:**
- Name, description
- Type: annual_fund, capital_campaign, event, emergency, program_specific, other
- Goal amount, currency
- Raised amount (denormalized, updated via trigger)
- Donor count (denormalized)
- Status: planning, active, completed, cancelled
- Start date, end date
- Target capitals (which capitals this campaign supports)

**Key views:**
- Campaign list as cards with progress bar (raised/goal), donor count, status badge, date range
- Campaign detail:
  - **Thermometer/progress visualization**
  - Contribution list filtered to this campaign
  - Unique donor list
  - Capital distribution chart (how campaign funds map across the 7 capitals)
  - Linked pledges
  - Linked fundraising events

**Workflow:**
1. Director creates campaign: "2026 Annual Fund", goal $50,000
2. All monetary contributions throughout the year tagged to this campaign
3. Thermometer updates in real-time as donations come in
4. Board members can see campaign progress on dashboard

---

### 3.5 Donor Management & Pipeline

A full donor lifecycle management system based on the [5-stage cultivation cycle](https://neonone.com/resources/blog/donor-cultivation-cycle/): Identification → Qualification → Cultivation → Solicitation → Stewardship.

**Donor Pipeline (Kanban Board):**
- Columns for each stage
- Drag-and-drop cards between stages
- Each card: donor name, estimated capacity, ask amount, next action, assigned staff member
- Fields: person/org/household, stage, estimated_capacity, ask_amount, assigned_to, campaign, next_action, next_action_date

**Donor Directory (Table View):**
- All people/orgs/households who have given, with:
  - Lifetime giving total
  - Last gift date
  - **LYBUNT flag** (Last Year But Unfortunately Not This year)
  - **SYBUNT flag** (Some Year But Unfortunately Not This year)
  - Donor tier (auto-calculated: Major $10k+, Mid $1k-$10k, Grassroots <$1k — thresholds configurable)
  - Recurring giving status
  - Campaign involvement

**Donor "Giving" Tab** (on Person/Org/Household detail pages):
- Giving history timeline (all contributions)
- Pledge status (active/completed/lapsed)
- Stewardship touches log
- Campaign involvement
- Fund allocations
- Tax receipt history

**Stewardship Tools:**
- "Send Thank You" button → generates IRS-compliant acknowledgment letter (reuses email template system)
- Stewardship touch log: record calls, visits, recognition events, site tours
- **Lapsed donor alerts**: configurable — no gift in X months → notification to assigned staff

---

### 3.6 Fund Accounting

Track restricted, unrestricted, and designated funds to ensure donor-intent compliance and clear financial reporting.

**Fund Types:**
- **Unrestricted** — available for general use
- **Temporarily Restricted** — donor-restricted for specific purpose or time period
- **Permanently Restricted** — endowment-style, principal cannot be spent
- **Designated** — board-designated for specific purposes (internally restricted)

**Fields:**
- Name, description, type, purpose
- Balance (denormalized, updated via trigger on contributions)
- Target amount (optional goal)
- Is active

**Key views:**
- Fund list: name, type, balance, target, status
- Fund detail: balance over time chart, transaction list (contributions in), purpose/restriction description, linked campaigns
- **Fund summary dashboard**: total restricted vs. unrestricted balances, fund health overview

**Workflow:**
1. Director creates "Youth Programs" fund (type: temporarily_restricted)
2. Foundation grant of $15,000 received → contribution tagged to this fund
3. Fund balance updates to $15,000
4. As programs spend against this fund (tracked via program-linked contributions), balance decreases
5. Board can see restricted vs. unrestricted balances at a glance

---

### 3.7 Pledges & Recurring Giving

Track multi-payment commitments and recurring donations.

**Fields:**
- Donor (person/org/household)
- Total amount, currency
- Paid amount (denormalized), remaining amount
- Frequency: one-time, monthly, quarterly, annually
- Start date, end date, next payment date
- Campaign, fund (optional links)
- Status: active, completed, lapsed, cancelled

**Workflow:**
1. Major donor pledges $12,000 over 12 months
2. Pledge record created: total $12,000, frequency monthly, next_payment_date: April 1
3. Each month, staff records a $1,000 contribution linked to this pledge
4. paid_amount increments, remaining_amount decrements
5. When paid_amount = total_amount → status auto-updates to "completed"
6. If payment missed (next_payment_date passes), status → "lapsed", alert sent

---

### 3.8 Tax Receipts

IRS-compliant donation acknowledgment letters, auto-generated for qualifying contributions.

**Requirements** ([per IRS](https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contributions-written-acknowledgments)):
- Organization name and EIN
- Amount of cash contribution
- Description (not value) of non-cash contribution
- Statement of whether goods/services were provided in return
- Good faith estimate of value of goods/services if provided
- Date of contribution

**Implementation:**
- Auto-generated receipt_number on monetary and in-kind contributions
- **PDF generation reuses existing infrastructure** — `lib/contracts/certificate.ts` and `lib/pdf/` already handle dynamic PDF generation for e-signature certificates; tax receipts follow the same pattern (HTML template → PDF render → download/email). **No new PDF dependencies required.**
- "Download Receipt" button on contribution detail page
- "Send Receipt" button → emails receipt to donor via existing Gmail integration (tracks receipt_sent_at)
- Year-end summary receipt: all contributions for a donor in a given tax year
- Bulk receipt generation: select date range → generate receipts for all qualifying donors → bulk email send

---

### 3.9 Fundraising Events

Galas, auctions, walkathons, golf tournaments, dinners, and concerts with ticket sales and sponsorships.

**Event Fields:**
- Name, description, event type
- Date, start/end time
- Venue (linked community asset or external venue name)
- Campaign (optional — fundraising event contributes to a campaign)
- Goal amount, raised amount
- Ticket price, capacity
- Status: planning, open, sold_out, completed, cancelled

**Ticket Tiers:**
- Tier name (General, VIP, Sponsor Table)
- Quantity, unit price, total price
- Status: reserved, confirmed, cancelled, checked_in
- Table number (for seated events)

**Sponsorship Levels:**
- Name (Gold, Silver, Bronze)
- Amount, benefits description
- Max sponsors, current count
- Can be linked to event or campaign

**Key views:**
- Event list with date, type, progress, ticket sales
- Event detail: info, ticket tiers with sales counts, sponsorship levels, attendee list, revenue summary (tickets + sponsors + donations), **check-in grid** (mark attendees as checked_in on event day)

---

### 3.10 Programs

Structured activities, services, classes, and initiatives run by the community center.

**Fields:**
- Name, description
- Target capitals (multi-select — most programs build multiple capitals; **used as default for contribution capital tagging**)
- Status: planning, active, completed, suspended
- Capacity (max participants)
- Schedule (recurring: weekly Tuesday 6-8pm, or date range)
- Location (text + lat/lng for map)
- Start/end dates
- **Requires waiver** (boolean — if true, enrollment requires signed waiver before going "active")

**Program Enrollments:**
- Link a person or household to a program
- Status: active, completed, withdrawn, waitlisted
- **Waiver status**: not_required, pending, signed
- Enrolled date, completion date
- Notes (progress, outcomes)

**Batch Attendance (NEW):**
- Select program → select date → see grid of enrolled members
- Click Present / Absent / Excused for each person → bulk save
- Auto-generates attendance records (person, date, status, hours)
- **Attendance heatmap**: color-coded grid showing attendance history (green/red/gray by date)
- Attendance hours feed directly into funder reporting (dosage tracking)

**Performance Note:** `program_attendance` is a high-volume table (programs × enrollees × sessions). Critical indexes:
- `(program_id, date)` — batch attendance grid loads all records for a program on a given date
- `(person_id, date)` — per-person attendance history across programs
- `(program_id, person_id, date)` UNIQUE — prevents duplicate attendance records
- Batch inserts use `INSERT ... ON CONFLICT (program_id, person_id, date) DO UPDATE` for idempotent saves

**Key views:**
- Program list as cards with status badges, capital type color dots, enrollment/capacity progress bar
- Program detail: description, schedule, enrollment list (with waiver status), **attendance grid**, contribution history, outcomes summary
- Calendar view: programs plotted on a weekly/monthly calendar

---

### 3.11 Community Assets

Physical and non-physical resources owned, shared, or stewarded by the community.

**Categories:** Facility, Land, Equipment, Vehicle, Technology, Other

**Fields:**
- Name, description, category
- Capital type (primary capital this asset serves)
- Location (address + lat/lng), geocoded_status
- Condition: excellent, good, fair, poor
- Value estimate (replacement/market value)
- Steward: person or organization responsible for maintenance
- Notes, custom fields

**Key views:**
- Asset list with filters: category, capital, condition
- Asset detail: info, mini-map, steward contact, condition history, linked programs, events calendar
- Condition dashboard: assets grouped by condition with trend arrows

---

### 3.12 Community Map

An interactive, full-page map built on **OpenStreetMap** via Leaflet/react-leaflet.

**Layers (toggleable):**

| Layer | Marker Style | Data Source |
|-------|-------------|-------------|
| Households | House icon, blue | households with lat/lng |
| Community Assets | Category-specific icons, condition-colored | community_assets with lat/lng |
| Programs | Calendar icon, status-colored | programs with lat/lng |
| Organizations | Building icon, purple | organizations with lat/lng |

**Features:**
- Click any marker → popup with entity name, key details, link to detail page
- Filter sidebar: filter by capital type, asset category, program status, condition
- Cluster markers at zoom-out levels to avoid visual overload
- Search: find an entity by name and zoom to its location

**Geocoding:**
- Background queue processes addresses asynchronously (1 req/sec via Nominatim)
- `geocoded_status` field tracks: pending → success/failed
- Manual pin placement as fallback (click on map to set coordinates → status: manual)

---

### 3.13 Relationships

Person-to-person connections that map the social fabric of the community.

**Relationship Types:** Neighbor, Family, Mentor/Mentee, Friend, Caregiver, Colleague, Service Provider/Client, Other

**Fields:** Person A, Person B, Type, Notes. Bidirectional by default.

**Views:**
- On person detail page: "Relationships" tab (community projects only)
- Relationship list at project level with filters by type

---

### 3.14 Community Dashboard

The landing page for community projects — a holistic health check across all 7 capitals plus fundraising.

**Components:**

1. **Capital Health Radar Chart** — 7-axis spider chart scored by contributions, assets, and program activity per capital

2. **Key Metrics Cards:**
   - Total Households
   - Active Programs
   - Total Volunteer Hours (this period)
   - Total Contributions Value
   - Active Community Assets
   - New Relationships Formed

3. **Fundraising Summary:**
   - Active campaigns with progress bars
   - Fund balances (restricted vs. unrestricted)
   - Pledge pipeline (outstanding pledges)
   - YTD giving total

4. **Recent Activity Feed:** Latest contributions, enrollments, new households, asset updates

5. **Program Status Overview:** Active programs with enrollment progress bars

6. **Capital Trend Chart:** Line chart showing each capital's investment trend (monthly)

7. **Geographic Coverage:** Mini-map showing household distribution

---

### 3.15 Broadcast Messaging

Simplified mass communication replacing Sequences for community projects. For weather alerts, schedule changes, event reminders, and outreach.

**Fields:**
- Subject, body
- Channel: email, SMS, both
- Filter criteria (JSONB): by program enrollment, household attributes, custom filters
- Recipient count, sent_at, sent_by, status

**Workflow:**
1. Staff composes broadcast: "Snow day — Center closed tomorrow"
2. Selects channel: SMS
3. Filters recipients: all active program enrollees
4. Previews recipient list (count + sample names)
5. Sends → reuses existing Telnyx SMS + Gmail email infrastructure (no new messaging dependencies)

---

### 3.16 Waivers

Reuses the existing e-signature/contracts module for liability waivers, photo releases, and code of conduct.

- Programs can set `requires_waiver = true`
- Waiver template uploaded as a contract template
- On enrollment, system prompts for waiver signature (reuses existing signing flow)
- Enrollment `waiver_status` tracks: not_required, pending, signed
- Status "active" blocked until waiver is signed
- Waiver status visible in enrollment list and batch attendance grid

---

### 3.17 Case Management & Intake

For community centers providing direct services (food bank, housing assistance, legal aid referrals).

**Intake Flow:**
1. Person/household arrives at center
2. Staff creates or finds household record
3. **Needs assessment**: structured form (configurable via custom fields)
4. Staff creates notes on household record documenting assessment
5. **Service referrals**: logged as contributions (type: service, status: pledged)
6. **Follow-up tasks**: created using existing task system

**Closed-Loop Referral Tracking:**
- Referral created → contribution status: pledged
- Service confirmed → status: completed
- No follow-up in X days → auto-task for staff follow-up

---

### 3.18 Facility Booking & Events

**Event/Booking fields:**
- Name, description
- Facility (linked community asset)
- Date, start time, end time
- Recurring (JSONB schedule pattern)
- Organizer, status, capacity, related program

**Views:**
- Calendar view (day/week/month) with color-coded bookings
- Facility schedule: select an asset → see its calendar
- Conflict detection: prevent double-booking

---

### 3.19 Volunteer Management

**Workflows:**
1. **Onboarding**: New volunteer registers → person record created → assigned to program(s)
2. **Scheduling**: Linked to program schedules; shift reminders via notifications
3. **Hour Logging**: Each shift logged via Time Log entry mode → capital auto-inherited from program
4. **Recognition**: Leaderboard on dashboard; milestone badges at configurable thresholds
5. **Reporting**: Total hours, FTE equivalent, dollar value for grant reporting

---

### 3.20 Reporting & Analytics

**Standard Reports:**

| Report | Description | Filters |
|--------|-------------|---------|
| Capital Health Summary | Radar chart + table of all 7 capitals with scores | Date range |
| Contribution Summary | Totals by type, capital, donor, status | Date range, type, capital, campaign, fund |
| Program Performance | Enrollment, **attendance dosage**, completion, utilization | Status, capital, date |
| Household Demographics | Count, size distribution, geographic spread | Neighborhood, enrollment |
| Volunteer Impact | Hours, FTE equivalent, dollar value, top volunteers | Date range, program |
| Asset Condition | All assets with current condition, trend, steward | Category, condition |
| Relationship Network | Connection counts, type distribution, density metrics | Type, neighborhood |
| Grant Compliance | Per-grant: spend, **unduplicated** participants, hours, outcomes | Grant/funder |
| Campaign Performance | Raised vs. goal, donor count, average gift, capital distribution | Campaign, date |
| Fund Balances | Restricted vs. unrestricted, transactions, burn rate | Fund type, date |
| Donor Retention | LYBUNT/SYBUNT counts, retention rate, tier distribution | Year, tier |
| Pledge Fulfillment | Active pledges, paid vs. remaining, lapsed count | Status, date |

**Unduplicated Counts:** All funder-facing reports use `COUNT(DISTINCT person_id)` to report unique individuals served, not total touchpoints.

**Custom Reports:** Leverage existing custom report engine with community tables as data sources.

---

## 4. Data Model Summary

### New Tables

| Table | Primary Purpose |
|-------|----------------|
| `households` | Family/living unit grouping with geo |
| `household_members` | Person ↔ Household junction with temporal bounds |
| `contributions` | All value exchanges (money, time, goods, grants, services) |
| `fundraising_campaigns` | Goal-based fundraising efforts |
| `funds` | Restricted/unrestricted/designated fund accounting |
| `pledges` | Multi-payment donor commitments |
| `donor_pipeline` | Major donor cultivation stages |
| `donor_stewardship_touches` | Thank-yous, calls, visits, recognition |
| `fundraising_events` | Galas, auctions, walkathons |
| `fundraising_event_tickets` | Ticket sales with tiers and check-in |
| `sponsorship_levels` | Sponsor tier definitions |
| `sponsorships` | Sponsor ↔ Level ↔ Contribution |
| `community_assets` | Physical/non-physical community resources |
| `programs` | Structured community activities |
| `program_enrollments` | Person/Household ↔ Program with waiver status |
| `program_attendance` | Batch attendance records (date, status, hours) |
| `relationships` | Person-to-person social connections |
| `events` | Facility bookings |
| `broadcasts` | Mass messaging |

### Modified Tables

| Table | Change |
|-------|--------|
| `projects` | Add `project_type` column (standard/community) |
| `people` | Add `latitude`, `longitude` columns |
| `organizations` | Add `latitude`, `longitude` columns |

### Denormalized Aggregates & Triggers

Several tables use denormalized fields for performance. These are maintained via PostgreSQL triggers on the `contributions` table:

| Parent Table | Denormalized Field | Trigger Logic |
|-------------|-------------------|---------------|
| `fundraising_campaigns` | `raised_amount`, `donor_count` | On contribution INSERT/UPDATE/DELETE where `campaign_id` matches, recalculate `SUM(value)` and `COUNT(DISTINCT donor_*)` |
| `funds` | `balance` | On contribution INSERT/UPDATE/DELETE where `fund_id` matches, recalculate `SUM(value)` |
| `pledges` | `paid_amount` | On contribution INSERT/UPDATE/DELETE where `pledge_id` matches, recalculate `SUM(value)`; auto-update status to "completed" when `paid_amount >= total_amount` |
| `fundraising_events` | `raised_amount` | Derived from linked ticket sales + sponsorships + direct donations |
| `sponsorship_levels` | `current_sponsors` | On sponsorship INSERT/DELETE, recalculate `COUNT(*)` |

**Trigger naming convention**: `trg_{table}_{field}_on_{source}` (e.g., `trg_campaigns_raised_amount_on_contributions`)

### Key Composite Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `program_attendance` | `(program_id, date)` | Batch attendance grid queries |
| `program_attendance` | `(person_id, date)` | Per-person attendance history |
| `program_attendance` | `(program_id, person_id, date)` UNIQUE | Prevent duplicate records |
| `contributions` | `(project_id, campaign_id)` | Campaign contribution lookups |
| `contributions` | `(project_id, fund_id)` | Fund transaction lookups |
| `contributions` | `(project_id, pledge_id)` | Pledge payment lookups |
| `contributions` | `(project_id, capital_type)` | Capital-based reporting |
| `contributions` | `(donor_person_id, date)` | Donor giving history |
| `household_members` | `(household_id, end_date)` | Current member lookups |
| `household_members` | `(person_id, start_date, end_date)` | Person household history |
| `program_enrollments` | `(program_id, status)` | Active enrollment counts |
| `donor_pipeline` | `(project_id, stage)` | Kanban board queries |

---

## 5. The Seven Capitals — Color & Icon System

| Capital | Color | Tailwind Class | Icon | Hex |
|---------|-------|---------------|------|-----|
| Natural | Green | `bg-green-500` | Leaf | #22c55e |
| Cultural | Purple | `bg-purple-500` | Palette | #a855f7 |
| Human | Blue | `bg-blue-500` | GraduationCap | #3b82f6 |
| Social | Orange | `bg-orange-500` | Handshake | #f97316 |
| Political | Red | `bg-red-500` | Vote | #ef4444 |
| Financial | Emerald | `bg-emerald-500` | DollarSign | #10b981 |
| Built | Slate | `bg-slate-500` | Hammer | #64748b |

---

## 6. User Personas & Workflows

### Persona 1: Maria — Community Center Director

**Daily workflow:**
- Opens Community Dashboard → checks capital health radar + fundraising summary
- Reviews active campaign progress (Annual Fund at 62% of goal)
- Scans Recent Activity feed for new household registrations
- Opens Programs → batch attendance for morning ESL class
- Opens Donations → logs $500 corporate check in Donations tab → auto-tagged to Annual Fund campaign + General fund
- Opens Reports → pulls Q1 funder report: unduplicated participants, attendance hours, in-kind value

### Persona 2: James — Volunteer Coordinator

**Weekly workflow:**
- Opens Programs → "Weekend Food Bank" → batch attendance for Saturday shift
- Logs volunteer hours via Time Log tab: 8 volunteers x 4 hours = 32 hours (capital auto: social)
- Dashboard shows 500 total volunteer hours this quarter — milestone alert fires
- Opens Broadcasts → sends "Schedule change" SMS to all food bank volunteers

### Persona 3: Aisha — Case Worker / Intake Specialist

**Intake workflow:**
- New family walks in → creates Household: "Johnson Family", 4 members (with start_dates)
- Needs assessment captured in custom fields
- Referral logged as service contribution (status: pledged)
- Follow-up task created for 2 weeks out
- Family enrolled in "Emergency Food Assistance" program → waiver signed → status: active

### Persona 4: David — Board Member / Funder Liaison

**Monthly workflow:**
- Opens Dashboard → capital health trends + fund balances (restricted vs. unrestricted)
- Reviews campaign performance: Annual Fund, Building Renovation Fund
- Opens Donor Pipeline → checks major donor cultivation progress
- Opens Reports → Grant Compliance for CDBG funding: 47 households (unduplicated), 1,200 volunteer hours
- Exports data for board presentation

### Persona 5: Sarah — Development Director (NEW)

**Weekly workflow:**
- Opens Donor Pipeline → moves "Johnson Foundation" from Cultivation to Solicitation stage
- Records stewardship touch: site visit with corporate sponsor
- Opens Pledges → sees 3 pledges lapsed this month → sends follow-up emails
- Opens Campaigns → "Spring Gala" campaign at 75% → reviews ticket sales and sponsorship commitments
- Generates year-end tax receipts for all 2025 donors → bulk email send
- Reviews Donor Directory → LYBUNT report shows 12 donors who gave last year but not yet this year → creates outreach tasks

---

## 7. Navigation Structure

### Community Project Sidebar

```
Dashboard
──────────────────
Households
People
Organizations
──────────────────
FUNDRAISING
  Campaigns
  Donations
  Donors
  Funds
  Events
──────────────────
Programs
Community Assets
Community Map
──────────────────
Broadcasts
Reporting
──────────────────
Chat (AI)
Settings
```

Items hidden for community projects: Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News

---

## 8. Settings (Community-Specific)

On the project settings General tab, community projects show additional configuration:

- **Volunteer Hour Rate**: Default dollar value per volunteer hour (for reporting)
- **Default Map Center**: Lat/lng + zoom level for the community map
- **Intake Form Fields**: Configure which custom fields appear on household intake
- **Capital Scoring Weights**: Adjust how each capital is scored on the radar chart
- **Active Capitals**: Option to disable capitals not relevant to this community
- **Donor Tier Thresholds**: Configure major/mid/grassroots donor tier cutoffs
- **Lapsed Donor Alert Period**: Days without a gift before alert fires (default: 365)
- **Organization EIN**: Required for tax receipt generation
- **Receipt Template**: Customize tax receipt letter content

---

## 9. Technical Implementation Phases

### Phase 1: Foundation (Database + Types)
- Migration adding project_type, all new tables (19), geo columns, **all composite indexes** (see §4), and **denormalized aggregate triggers** (see §4)
- Regenerate TypeScript types
- Zod validators for all community entities
- Capital color/icon system utility
- Temporal query helper functions for household member date-range lookups

### Phase 2: Project Creation + Navigation
- Type-first selector in project creation dialog
- Conditional sidebar navigation
- Community dashboard (basic metrics)

### Phase 3: Core Entities
- Households CRUD (API + UI + intake flow)
- Contributions CRUD (API + UI + mode-specific entry)
- Programs CRUD (API + UI + enrollments + batch attendance)
- Community Assets CRUD (API + UI)
- Relationships CRUD (API + person detail tab)

### Phase 4: Fundraising Suite
- Campaigns CRUD + thermometer
- Funds CRUD + balance tracking + summary dashboard
- Pledges CRUD + recurring payment tracking
- Donor Pipeline (Kanban board + directory table)
- Donor Stewardship (giving tab, touch log, LYBUNT/SYBUNT)
- Fundraising Events (tickets, sponsorships, check-in)
- Tax Receipt Generation (PDF)

### Phase 5: Map + Visualization
- Install Leaflet/react-leaflet
- Community Map page with all layers
- Geocoding background queue
- Capital health radar chart on dashboard
- Capital trend charts

### Phase 6: Supporting Features
- Broadcasts (SMS/email mass messaging)
- Waivers (reuse contracts module)
- Facility booking / events calendar
- Volunteer management workflows

### Phase 7: Integrations
- MCP tools for all community entities
- Chat agent tools
- Automation events
- Export/import for community data

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Household intake completion | < 2 min |
| Grant report data export | < 30 sec |
| All 7 capitals visible on dashboard | 1 click from any page |
| Map load with all layers | < 3 sec |
| Donation entry (monetary) | < 30 sec |
| Batch attendance for 20-person class | < 1 min |
| Campaign thermometer updates | Real-time |
| Tax receipt generation | < 5 sec per receipt |
| Donor pipeline stage change | Single drag-and-drop |
| Fund balance accuracy | Real-time (trigger-updated) |

---

## 11. Future Enhancements (Post-MVP)

- **Self-service portal**: Community members self-register, log hours, enroll online
- **Kiosk mode / pre-registration link**: Reduce lobby bottleneck at intake
- **Mobile app**: Field workers do intake, log contributions, update assets from mobile
- **Network graph visualization**: Interactive social network graph
- **Participatory budgeting**: Community members vote on fund allocation
- **Time banking**: Formal time-credit system (1 hour = 1 credit)
- **SDOH screening integration**: Standardized social determinants screening (PRAPARE, AHC-HRSN)
- **External resource directory**: Searchable directory of partner organizations
- **Multi-language support**: Interface and forms in community's primary languages
- **SMS notifications**: Program reminders via Telnyx (already in platform)
- **Impact stories**: Rich-text + photo stories for marketing/fundraising
- **AI-powered insights**: Chat agent analyzes capital health trends
- **Online giving page**: Public donation page for campaigns (Stripe integration)
- **Auction management**: Live/silent auction with mobile bidding
- **Incident reporting**: Safety/legal incident logging linked to people and locations
- **Inventory / lending library**: Check-in/check-out for lendable assets
- **Payment processing / program fees**: Sliding-scale fees for paid programs

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scope creep — community + fundraising is vast | Phased delivery: core entities first, fundraising second, advanced features third |
| Data privacy — household/needs data is sensitive | RLS per-project; intake data in custom_fields; role-based access |
| Geocoding costs at scale | Free Nominatim API with background queue (1 req/sec); geocoded_status tracking; manual pin fallback |
| Volunteer adoption — logging hours is friction | Time Log mode optimized for 3 fields; smart capital defaults eliminate dropdown fatigue |
| Grant reporting complexity varies by funder | Unduplicated counts built-in; flexible custom fields + CSV export covers 80% of cases |
| Map performance with many markers | Marker clustering; lazy-load layers; paginate API responses |
| Fund balance accuracy | Denormalized balances updated via database triggers; no manual calculation |
| Tax receipt compliance | IRS requirements built into template; org EIN required in settings |
| Donor pipeline adoption | Kanban drag-and-drop is intuitive; lapsed donor alerts are proactive |
| Attendance vs. enrollment confusion | Separate data model (program_attendance table); batch UI clearly distinct from enrollment list |
| Temporal query complexity (household members) | Standard SQL date-range overlap patterns; helper functions abstract the WHERE clauses; indexed on (person_id, start_date, end_date) |
| High-volume attendance data | Composite indexes on program_attendance; batch INSERT with ON CONFLICT for idempotency; paginated API responses |
| Trigger cascade on contribution updates | Triggers are narrowly scoped (only fire when campaign_id/fund_id/pledge_id change); tested for concurrent write safety |

---

*This PRD is a living document. As implementation proceeds, individual sections will be refined based on user testing and feedback from community center directors.*
