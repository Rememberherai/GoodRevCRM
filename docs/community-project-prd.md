# Community Project Type — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-17
**Status:** Draft

---

## 1. Executive Summary

GoodRevCRM today serves B2B sales teams. This PRD defines a new **"Community Project"** type that transforms the platform into a one-stop-shop for **community center directors, neighborhood organizers, and nonprofit leaders** who need to manage households, track multi-capital contributions, run programs, map community assets, coordinate volunteers, and report outcomes to funders — all from a single tool.

The design is grounded in the **Community Capitals Framework (CCF)**, a widely-adopted model from rural sociology that identifies **seven forms of community wealth**: Natural, Cultural, Human, Social, Political, Financial, and Built capital. Rather than tracking just money (like a sales CRM), a Community Project tracks the full spectrum of value flowing through a community.

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
- [Participatory Asset Mapping Toolkit — Community Science](https://communityscience.com/wp-content/uploads/2021/04/AssetMappingToolkit.pdf)
- [Grant Management for Nonprofits — NetSuite](https://www.netsuite.com/portal/resource/articles/crm/grant-management.shtml)
- [CDFI Fund — US Treasury](https://www.cdfifund.gov/)

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
4. **Contribution tracking**: Volunteer hours logged weekly by plot stewards (type: volunteer_hours, capital: natural)
5. **In-kind tracking**: Seed donations, tool lending tracked as in-kind contributions
6. **Assessment**: Quarterly condition update on the garden asset
7. **Reporting**: Capital dashboard shows natural capital trending up based on increased hours + asset condition improvements

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
- Attendance at cultural programs
- # of languages represented in programs
- Cultural assets preserved (murals, historic sites, archives)
- $ invested in cultural programming
- # of cultural mentorship relationships

**Workflow — Heritage Festival:**
1. **Program creation**: "Annual Harvest Festival" program targeting Cultural + Social capital, status: planning
2. **Asset link**: Community Hall asset marked as venue (capital: built, but serving cultural purpose)
3. **Enrollment**: Volunteer performers, vendors, organizers enrolled in program
4. **Contribution tracking**:
   - Monetary: Sponsorship donations (type: monetary, capital: cultural)
   - In-kind: Food donations, décor, sound equipment (type: in_kind, capital: cultural)
   - Volunteer: Setup/teardown hours, cooking, performance time (type: volunteer_hours, capital: cultural)
5. **Relationship mapping**: New cross-cultural relationships formed → logged as social capital relationships
6. **Outcome**: Attendance count, new household registrations, cultural assets documented

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
- # of people completing training programs
- Skills inventory depth (unique skills catalogued)
- # of active mentorship relationships
- Program completion rates
- # of certifications/credentials earned
- Health program participation rates
- Leadership positions filled by community members

**Workflow — Job Skills Training:**
1. **Program creation**: "Digital Literacy for Seniors" — target capitals: Human, Financial (improves employability)
2. **Enrollment**: Individual people enroll (with household linkage for family context)
3. **Contribution tracking**:
   - Grant: Foundation grant received (type: grant, capital: human, value: $15,000)
   - Volunteer: Instructor hours (type: volunteer_hours, capital: human)
   - In-kind: Donated laptops (type: in_kind, capital: human + built)
4. **Progress**: Custom fields on enrollment track completion milestones
5. **Outcome**: Graduates tracked; employment outcomes noted in person records
6. **Reporting**: Human capital index rises; grant report auto-populates enrollment + completion data

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
- Relationship type diversity (are connections only within groups, or bridging across?)
- Mutual aid exchanges per month
- Event attendance and repeat attendance
- # of new relationships formed per quarter
- Volunteer retention rate (a proxy for trust and belonging)
- Household-to-household connection density

**Workflow — Neighbor-to-Neighbor Mutual Aid:**
1. **Intake**: New household registered during community welcome visit → household members added, primary contact designated
2. **Relationship mapping**: Staff logs neighbor relationships between adjacent households
3. **Contribution tracking**: When Household A provides childcare for Household B, logged as service contribution (type: service, capital: social, hours: 4)
4. **Reciprocity tracking**: Household B later helps Household A with yard work → another service contribution logged
5. **Program context**: Both exchanges linked to "Good Neighbors" program
6. **Network visualization**: Community Map shows relationship density by neighborhood — areas with few connections flagged for outreach
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
3. **Contribution tracking**:
   - Volunteer: Facilitator hours, outreach volunteers (type: volunteer_hours, capital: political)
   - Grant: Civic engagement grant (type: grant, capital: political)
4. **Activity logging**: Notes on each session — topics covered, questions raised, follow-up actions
5. **Relationship building**: Connections made between residents and local officials → logged as relationships
6. **Outcome**: Track which participants subsequently attend council meetings, join boards, or register to vote (noted in person custom fields)
7. **Reporting**: Political capital trends show increased civic participation correlated with program enrollment

---

### 2.6 Financial Capital

**Definition:** Money, savings, credit, investment, charitable giving, grants, earned income, and the economic resources available to a community — including in-kind value converted to monetary equivalents.

**What to track:**
- Monetary donations and pledges
- Grant applications, awards, and compliance
- In-kind donation monetary equivalents (using Independent Sector rate: $33.49/hr for 2025)
- Microloans and revolving fund activity
- Fundraising campaigns
- Budget allocations by program and capital type
- Funder reporting data

**Indicators:**
- Total monetary contributions received (by period)
- Total in-kind value (hours × rate + goods fair market value)
- Grant dollars awarded vs. applied
- Pledge fulfillment rate (pledged → received conversion)
- Contribution diversity (# of unique donors)
- Cost per program participant
- Revenue by source type (individual, corporate, government, foundation)

**Workflow — Annual Fundraising + Grant Reporting:**
1. **Contributions tracked all year**: Every monetary, in-kind, and volunteer contribution tagged with capital_type and linked to donor (person, org, or household)
2. **Grant lifecycle**:
   - Grant opportunity logged as contribution (type: grant, status: pledged, value: $50,000)
   - Upon award → status: received, date updated
   - Program enrollments and contribution data feed directly into grant reporting
3. **Funder report generation**:
   - Filter contributions by grant source + date range
   - Export: total participants served, volunteer hours, in-kind value, program outcomes
   - Capital distribution chart shows how grant funds flowed across all 7 capitals
4. **Dashboard metrics**: Financial capital card shows YTD giving, pledge pipeline, grant compliance status
5. **Donor stewardship**: Contribution history on person/org/household detail pages enables personalized thank-yous and renewal asks

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

**Workflow — Facility Management + Condition Tracking:**
1. **Asset registration**: Community Center building logged as Community Asset (category: facility, capital: built, condition: good, address + lat/lng)
2. **Sub-assets**: Individual rooms, equipment, technology logged as related assets
3. **Condition monitoring**: Quarterly condition assessments update the asset record; history tracked via notes + updated_at
4. **Improvement projects**: Major renovation tracked as contribution (type: service or in_kind, capital: built, value: estimated labor + materials)
5. **Utilization**: Programs linked to facility assets; enrollment counts serve as utilization proxy
6. **Map visualization**: All built assets visible on Community Map with condition-based color coding (green = excellent, yellow = fair, red = poor)
7. **Reporting**: Built capital index reflects asset count, average condition score, and investment trend

---

## 3. Core Feature Set

### 3.1 Project Type Selection

When creating a new project, users choose between:

| Type | Description | Modules Available |
|------|-------------|-------------------|
| **Standard CRM** | B2B sales pipeline, outreach sequences, RFPs, contracts | Organizations, People, Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News |
| **Community Center** | Household-based community development with 7-capital tracking | Households, People, Organizations, Contributions, Programs, Community Assets, Community Map, Relationships, Reporting |

The type is set at creation and stored on the project record. The sidebar, dashboard, and available features adapt accordingly.

---

### 3.2 Households

The fundamental unit of a community project. Households group people into family/living units.

**Fields:**
- Name (e.g., "The Martinez Family")
- Address (street, city, state, postal code, country)
- Geo coordinates (latitude, longitude) — for map placement
- Household size
- Primary contact (linked person)
- Notes
- Custom fields (JSONB)

**Household Members:**
- Person linked with relationship type: head of household, spouse/partner, child, dependent, extended family, other
- One member marked as primary contact
- A person can belong to multiple households (e.g., split custody)

**Key views:**
- Household list with search, filter by neighborhood/address
- Household detail page: members, contribution history, program enrollments, relationships, notes, timeline
- Quick-add: register a new household + members in a single flow (intake form)

**Intake workflow:**
1. Walk-in or referral arrives at community center
2. Staff opens "New Household" dialog
3. Enters household name, address, size
4. Adds members (new people or links existing)
5. Marks primary contact
6. Optional: immediate program enrollment
7. Optional: needs assessment notes captured
8. Household appears on map automatically if address geocoded

---

### 3.3 Contributions

Replaces "Opportunities" for community projects. Tracks every type of value exchange — monetary and non-monetary.

**Contribution Types:**

| Type | Description | Key Fields |
|------|-------------|------------|
| `monetary` | Cash, check, online donation, recurring gift | value, currency |
| `in_kind` | Goods, materials, food, supplies, equipment | value (fair market estimate), description of goods |
| `volunteer_hours` | Time donated by community members | hours, value (auto-calculated at configurable hourly rate) |
| `grant` | Foundation, government, or corporate grants | value, grant name, funder org, compliance dates |
| `service` | Professional services rendered (legal, medical, tutoring, childcare, etc.) | hours, value, service description |

**Every contribution is tagged with:**
- **Capital type** — which of the 7 capitals this contributes to
- **Donor** — person, organization, or household
- **Recipient** — person, organization, household, or program (nullable — for general fund contributions)
- **Status** — pledged → received → completed (or cancelled)
- **Date** — when the contribution occurred or is expected

**Key views:**
- Contribution list with filters: type, capital, status, date range, donor, recipient
- Capital breakdown view: contributions grouped by capital type with totals
- Donor leaderboard: top contributors by value + hours
- Contribution detail: full info with linked entities

**Volunteer hour valuation:**
- Default rate: $33.49/hr ([Independent Sector 2025 rate](https://www.civicchamps.com/post/how-to-calculate-volunteer-hours-value))
- Configurable per-project in settings (some funders require state-specific rates)
- Auto-calculates monetary equivalent for reporting
- Specialized skills can override rate (e.g., pro bono legal at $200/hr)

---

### 3.4 Programs

Structured activities, services, classes, and initiatives run by the community center.

**Fields:**
- Name, description
- Target capitals (multi-select from the 7 — most programs build multiple capitals)
- Status: planning, active, completed, suspended
- Capacity (max participants)
- Schedule (recurring: weekly Tuesday 6-8pm, or date range)
- Location (text + lat/lng for map)
- Start/end dates

**Program Enrollments:**
- Link a person or household to a program
- Status: active, completed, withdrawn, waitlisted
- Enrolled date, completion date
- Notes (attendance, progress, outcomes)

**Key views:**
- Program list as cards with status badges, capital type color dots, enrollment count / capacity
- Program detail: description, schedule, enrollment list, contribution history, outcomes summary
- Calendar view: programs plotted on a weekly/monthly calendar

**Workflow — Running a Program:**
1. Staff creates program with name, description, target capitals, schedule, capacity
2. Community members enroll (individually or as households)
3. Session-by-session: attendance tracked via enrollment notes or custom fields
4. Contributions linked to program: volunteer facilitator hours, grant funding, in-kind supplies
5. At completion: enrollment status updated to "completed", outcomes captured
6. Reporting: program shows up in capital dashboards for each capital it targets

---

### 3.5 Community Assets

Physical and non-physical resources owned, shared, or stewarded by the community.

**Categories:**
- Facility (buildings, rooms, halls)
- Land (gardens, parks, lots)
- Equipment (tools, AV, kitchen, sports)
- Vehicle (van, bus)
- Technology (computers, Wi-Fi hotspots, servers)
- Other

**Fields:**
- Name, description
- Category
- Capital type (primary capital this asset serves)
- Location (address + lat/lng)
- Condition: excellent, good, fair, poor
- Value estimate (replacement/market value)
- Steward: person or organization responsible for maintenance
- Notes, custom fields

**Key views:**
- Asset list with filters: category, capital, condition
- Asset detail: info, mini-map, steward contact, condition history (via notes timeline), linked programs
- Condition dashboard: assets grouped by condition with trend arrows

---

### 3.6 Community Map

An interactive, full-page map built on **OpenStreetMap** via Leaflet/react-leaflet.

**Layers (toggleable):**

| Layer | Marker Style | Data Source |
|-------|-------------|-------------|
| Households | House icon, blue | households with lat/lng |
| Community Assets | Category-specific icons, condition-colored | community_assets with lat/lng |
| Programs | Calendar icon, status-colored | programs with lat/lng |
| Organizations | Building icon, purple | organizations with lat/lng |
| People | Person icon, gray | people with lat/lng (opt-in only) |

**Features:**
- Click any marker → popup with entity name, key details, link to detail page
- Filter sidebar: filter by capital type, asset category, program status, condition
- Cluster markers at zoom-out levels to avoid visual overload
- Neighborhood/area boundaries (drawn or imported as GeoJSON)
- Heat map overlay option: contribution density, relationship density, or program coverage
- Search: find an entity by name and zoom to its location
- Drawing tools: staff can mark areas of interest, service gaps, or planned projects

**Geocoding:**
- When addresses are entered on households, assets, or orgs, auto-geocode to lat/lng via a free geocoding API (Nominatim/OpenStreetMap)
- Manual pin placement as fallback (click on map to set coordinates)

---

### 3.7 Relationships

Person-to-person connections that map the social fabric of the community.

**Relationship Types:**
- Neighbor
- Family (parent, sibling, grandparent, etc.)
- Mentor / Mentee
- Friend
- Caregiver / Care recipient
- Colleague
- Service provider / Client
- Other (with custom label)

**Fields:**
- Person A, Person B
- Type
- Notes (how they know each other, context)
- Bidirectional by default (if A is neighbor of B, B is neighbor of A)

**Views:**
- On person detail page: "Relationships" tab listing all connections
- Network visualization (future): graph view showing relationship clusters
- Relationship list at project level with filters by type

---

### 3.8 Community Dashboard

The landing page for community projects — a holistic health check across all 7 capitals.

**Components:**

1. **Capital Health Radar Chart** — 7-axis spider/radar chart showing relative strength of each capital, scored by:
   - Contribution count and value per capital
   - Number of assets tagged to each capital
   - Program activity targeting each capital
   - Weighted composite score (configurable)

2. **Key Metrics Cards:**
   - Total Households registered
   - Active Programs
   - Total Volunteer Hours (this period)
   - Total Contributions Value (monetary + in-kind equivalent)
   - Active Community Assets
   - New Relationships Formed

3. **Recent Activity Feed:**
   - Latest contributions, enrollments, new households, asset updates
   - Chronological with entity type icons

4. **Program Status Overview:**
   - Active programs with enrollment progress bars (enrolled / capacity)

5. **Capital Trend Chart:**
   - Line chart showing each capital's investment trend over time (monthly)

6. **Geographic Coverage:**
   - Mini-map showing household distribution, highlighting underserved areas

---

### 3.9 Case Management & Intake

For community centers that provide direct services (food bank, housing assistance, legal aid referrals).

**Intake Flow:**
1. Person/household arrives at center
2. Staff creates or finds household record
3. **Needs assessment**: structured form (configurable via custom fields) capturing:
   - Housing stability
   - Food security
   - Employment status
   - Health needs
   - Transportation access
   - Education goals
   - Childcare needs
4. Staff creates notes on the household record documenting the assessment
5. **Service referrals**: staff logs referrals as contributions (type: service, capital: varies)
6. **Follow-up tasks**: tasks created (using existing task system) for check-ins

**Referral Tracking (Closed-Loop):**
- When a household is referred to an external org, a contribution record is created (type: service, status: pledged)
- When the service is confirmed delivered, status updates to completed
- If no follow-up received within configurable days, task auto-created for staff follow-up
- This creates a [closed-loop referral](https://uniteus.com/products/closed-loop-referral-system/) pattern

---

### 3.10 Facility Booking & Events

Community centers need to manage room and space bookings.

**Event/Booking fields:**
- Name, description
- Facility (linked community asset)
- Date, start time, end time
- Recurring (JSONB schedule pattern)
- Organizer (person or organization)
- Status: tentative, confirmed, cancelled
- Capacity, expected attendance
- Related program (optional)
- Notes

**Views:**
- Calendar view (day/week/month) with color-coded bookings by facility
- Booking list with filters
- Facility schedule: select an asset → see its calendar
- Conflict detection: prevent double-booking of the same space

---

### 3.11 Volunteer Management

Dedicated workflows for the volunteer lifecycle.

**Volunteer Record (extension of Person):**
- Skills inventory (custom fields or tags)
- Availability schedule
- Background check status (if required)
- Total lifetime hours
- Programs served

**Workflows:**
1. **Onboarding**: New volunteer registers → person record created with volunteer flag → assigned to program(s) → orientation tracked as enrollment
2. **Scheduling**: Volunteers linked to program schedules; shift reminders via existing notification system
3. **Hour Logging**: Each shift logged as a contribution (type: volunteer_hours, capital: per-program target)
4. **Recognition**: Leaderboard on dashboard; milestone badges at configurable hour thresholds (50, 100, 250, 500)
5. **Reporting**: Total volunteer hours, FTE equivalent, dollar value for grant reporting

---

### 3.12 Grant Management & Funder Reporting

Community centers live and die by grants. The system must make reporting painless.

**Grant Lifecycle:**
1. **Opportunity identified**: Grant created as contribution (type: grant, status: pledged, donor_organization = funder)
2. **Application submitted**: Notes document application details, deadline dates in custom fields
3. **Award received**: Status → received, value confirmed
4. **Implementation**: Programs and contributions tagged to this grant (via notes or a grant_id custom field)
5. **Reporting period**: Filter all contributions + enrollments by date range → auto-generate:
   - Participants served (unique people enrolled in grant-funded programs)
   - Demographic breakdown (from person records)
   - Volunteer hours contributed
   - In-kind value leveraged
   - Capital distribution (which capitals the grant invested in)
   - Outcome metrics (program completion rates, etc.)
6. **Closeout**: Grant contribution status → completed

**Export formats:**
- CSV export of filtered contribution/enrollment data
- PDF summary report (future enhancement)
- Capital distribution chart exportable as image

---

### 3.13 Reporting & Analytics

**Standard Reports:**

| Report | Description | Filters |
|--------|-------------|---------|
| Capital Health Summary | Radar chart + table of all 7 capitals with scores | Date range |
| Contribution Summary | Totals by type, capital, donor, status | Date range, type, capital |
| Program Performance | Enrollment, completion, capacity utilization per program | Status, capital, date |
| Household Demographics | Count, size distribution, geographic spread | Neighborhood, enrollment |
| Volunteer Impact | Hours, FTE equivalent, dollar value, top volunteers | Date range, program |
| Asset Condition | All assets with current condition, trend, steward | Category, condition |
| Relationship Network | Connection counts, type distribution, density metrics | Type, neighborhood |
| Grant Compliance | Per-grant: spend, participants, hours, outcomes | Grant/funder |

**Custom Reports:**
- Leverage existing custom report engine (`0084_custom_report_engine.sql`)
- Add community tables (households, contributions, programs, assets) as available data sources

---

## 4. Data Model Summary

### New Tables

| Table | Primary Purpose | Key Relationships |
|-------|----------------|-------------------|
| `households` | Family/living unit grouping | → project, → custom_fields |
| `household_members` | Person ↔ Household junction | → household, → person |
| `contributions` | All value exchanges (money, time, goods, grants, services) | → project, → person, → org, → household |
| `community_assets` | Physical and non-physical community resources | → project, → person (steward), → org (steward) |
| `programs` | Structured community activities and services | → project |
| `program_enrollments` | Person/Household ↔ Program participation | → program, → person, → household |
| `relationships` | Person-to-person social connections | → project, → person (×2) |
| `events` | Facility bookings and community events | → project, → community_asset, → program |

### Modified Tables

| Table | Change |
|-------|--------|
| `projects` | Add `project_type` column (standard/community) |
| `people` | Add `latitude`, `longitude` columns |
| `organizations` | Add `latitude`, `longitude` columns |

---

## 5. The Seven Capitals — Color & Icon System

Every capital-tagged entity in the UI uses a consistent visual language:

| Capital | Color | Tailwind Class | Icon | Hex |
|---------|-------|---------------|------|-----|
| Natural | Green | `bg-green-500` | Leaf | #22c55e |
| Cultural | Purple | `bg-purple-500` | Palette | #a855f7 |
| Human | Blue | `bg-blue-500` | GraduationCap | #3b82f6 |
| Social | Orange | `bg-orange-500` | Handshake | #f97316 |
| Political | Red | `bg-red-500` | Vote | #ef4444 |
| Financial | Emerald | `bg-emerald-500` | DollarSign | #10b981 |
| Built | Slate | `bg-slate-500` | Hammer | #64748b |

Capital badges appear on: contribution rows, program cards, asset cards, dashboard charts, map marker popups, and report headers.

---

## 6. User Personas & Workflows

### Persona 1: Maria — Community Center Director

**Daily workflow:**
- Opens Community Dashboard → checks capital health radar, reviews overnight contributions
- Scans Recent Activity feed for new household registrations from yesterday's walk-in hours
- Opens Programs → checks enrollment for today's ESL class, notes one household withdrew
- Opens Community Map → sees new household in underserved northwest area → assigns outreach volunteer
- Opens Contributions → logs a $500 corporate donation received via mail (type: monetary, capital: financial)
- Opens Reports → pulls Q1 funder report for the United Way grant, exports CSV

### Persona 2: James — Volunteer Coordinator

**Weekly workflow:**
- Opens People (filtered to volunteers) → reviews this week's scheduled volunteers
- Logs volunteer hours for Saturday food bank shift: 8 volunteers × 4 hours = 32 hours (type: volunteer_hours, capital: social)
- Opens Programs → "Weekend Food Bank" → checks enrollment, notes new volunteer onboarded
- Opens Dashboard → checks volunteer impact metrics, sees they've hit 500 total hours this quarter
- Creates a note celebrating the milestone on the program record

### Persona 3: Aisha — Case Worker / Intake Specialist

**Intake workflow:**
- New family walks in requesting help
- Creates Household: "Johnson Family", 4 members
- Adds household members: parent (head), parent (spouse), 2 children
- Completes needs assessment via custom fields: food insecurity flagged, housing stable, employment needed
- Creates referral: contribution (type: service, capital: human, status: pledged, description: "Referred to Workforce Development Center")
- Creates follow-up task: "Check on Johnson Family workforce referral" due in 2 weeks
- When follow-up confirms placement → contribution status → completed

### Persona 4: David — Board Member / Funder Liaison

**Monthly workflow:**
- Opens Dashboard → reviews capital health trends
- Opens Reports → Grant Compliance report for CDBG funding
- Reviews: 47 households served, 230 program enrollments, 1,200 volunteer hours, $18,500 in-kind value
- Exports data for board presentation
- Checks Community Map → notes geographic coverage gaps in eastern neighborhoods
- Recommends targeted outreach in next board meeting notes

---

## 7. Navigation Structure

### Community Project Sidebar

```
Dashboard
─────────
Households          🏠
People              👥
Organizations       🏢
─────────
Contributions       ❤️
Programs            📅
Community Assets    🏛️
─────────
Community Map       📍
Reporting           📊
─────────
Chat (AI)           💬
Settings            ⚙️
```

Items hidden for community projects: Opportunities, RFPs, Sequences, Content Library, Contracts, Workflows, News

---

## 8. Settings (Community-Specific)

On the project settings General tab, community projects show additional configuration:

- **Volunteer Hour Rate**: Default dollar value per volunteer hour (for reporting)
- **Default Map Center**: Lat/lng + zoom level for the community map
- **Intake Form Fields**: Configure which custom fields appear on household intake
- **Capital Scoring Weights**: Adjust how each capital is scored on the radar chart (advanced)
- **Active Capitals**: Option to disable capitals not relevant to this community (e.g., a rural center may not track Political capital actively)

---

## 9. Technical Implementation Phases

### Phase 1: Foundation (Database + Types)
- Migration adding project_type, all new tables, geo columns
- Regenerate TypeScript types
- Zod validators for all community entities
- Capital color/icon system utility

### Phase 2: Project Creation + Navigation
- Type selector in project creation dialog
- Conditional sidebar navigation
- Community dashboard (basic metrics)

### Phase 3: Core Entities
- Households CRUD (API + UI + intake flow)
- Contributions CRUD (API + UI + all 5 types)
- Programs CRUD (API + UI + enrollments)
- Community Assets CRUD (API + UI)
- Relationships CRUD (API + person detail tab)

### Phase 4: Map + Visualization
- Install Leaflet/react-leaflet
- Community Map page with all layers
- Geocoding integration
- Capital health radar chart on dashboard
- Capital trend charts

### Phase 5: Advanced Features
- Events/facility booking
- Grant lifecycle management
- Funder report generation
- Volunteer management workflows
- Intake/case management flow
- Custom report engine integration

### Phase 6: Integrations
- MCP tools for all community entities
- Chat agent tools
- Automation events
- Export/import for community data

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| A community center director can complete household intake in < 2 minutes | < 2 min |
| Grant report data export takes < 30 seconds (not days of manual compilation) | < 30 sec |
| All 7 capitals visible on dashboard within 1 click from any page | 1 click |
| Map loads with all layers in < 3 seconds | < 3 sec |
| Volunteer can self-log hours in < 1 minute (future: self-service portal) | < 1 min |
| Capital health radar chart updates in real-time as contributions are logged | Real-time |

---

## 11. Future Enhancements (Post-MVP)

- **Self-service portal**: Community members can self-register, log hours, view programs, enroll online
- **Mobile app**: Field workers can do intake, log contributions, and update assets from mobile
- **Network graph visualization**: Interactive social network graph showing all relationships
- **Participatory budgeting**: Community members vote on how to allocate funds across capitals
- **Time banking**: Formal time-credit system where 1 hour = 1 credit regardless of service type
- **SDOH screening integration**: Standardized social determinants screening (PRAPARE, AHC-HRSN)
- **External resource directory**: Searchable directory of partner organizations and services
- **Multi-language support**: Interface and forms in community's primary languages
- **SMS notifications**: Program reminders, follow-up prompts via Telnyx integration (already in platform)
- **Impact stories**: Rich-text + photo stories linked to programs and capitals for marketing/fundraising
- **AI-powered insights**: Chat agent can analyze capital health trends and recommend interventions

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scope creep — community needs are vast | MVP focuses on 7-capital tracking + map; advanced features phased |
| Data privacy — household/needs data is sensitive | RLS enforced per-project; intake data in custom_fields not in plain columns; role-based access |
| Geocoding costs at scale | Use free Nominatim API with rate limiting; cache results; manual pin as fallback |
| Volunteer adoption — logging hours is friction | Keep contribution creation to < 3 fields; future self-service portal reduces staff burden |
| Grant reporting complexity varies by funder | Flexible custom fields + CSV export covers 80% of cases; PDF templates are a future enhancement |
| Map performance with many markers | Marker clustering at low zoom levels; lazy-load layers; paginate API responses |

---

*This PRD is a living document. As implementation proceeds, individual sections will be refined based on user testing and feedback from community center directors.*
