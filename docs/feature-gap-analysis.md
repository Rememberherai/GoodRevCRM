# Feature Gap Analysis: GoodRevCRM vs HubSpot/Salesforce

> Context: This is a proprietary CRM for internal use, not a product to sell. Gaps are prioritized accordingly.

---

## High-Impact Gaps

### 1. Workflow Automation / Triggers

HubSpot and Salesforce both have robust workflow engines: "when X happens, do Y." GoodRev has email sequences but no general-purpose automation system.

**Examples of what this enables:**
- When an opportunity moves to "Negotiation," auto-create a task for legal review
- When a contact hasn't been touched in 30 days, notify the owner
- When an RFP is marked "Won," auto-update the linked opportunity
- When a new person is added, auto-run AI research

### 2. Calendar Integration (Google Calendar / Outlook)

Meeting records exist but there is no actual calendar sync.

**What's missing:**
- See your calendar inside the CRM
- Log meetings automatically from calendar events
- Schedule meetings with availability links
- Bi-directional sync so CRM meetings appear on your calendar

### 3. Email Inbox Sync (Read, not just Send)

Outbound sending works via Gmail, but there is no inbound email sync. HubSpot logs all email conversations automatically.

**What's missing:**
- Emails received from contacts don't appear on their timeline
- Can't see the full conversation thread in context
- Manual activity logging is required for inbound communications

### 4. Document Management / Proposals

No document generation or tracking.

**What's missing:**
- Proposal/quote document generation from templates
- Document sharing with open/view tracking
- E-signature integration
- Attach documents to deals and track engagement

### 5. Reporting / Custom Dashboards

The analytics dashboard exists but has a fixed layout.

**What's missing:**
- Build custom reports with arbitrary filters and groupings
- Create multiple dashboards for different purposes
- Schedule report delivery via email
- Build cross-entity reports (e.g., "organizations with an open opportunity AND an active RFP")

### 6. Kanban / Board Views

Opportunities and RFPs have stage/status fields but only list views. A drag-and-drop Kanban board for pipeline management is one of the most-used features in any CRM.

---

## Medium-Impact Gaps

### 7. File/Document Storage per Entity

Attachments exist in some places, but no unified file management per contact/org/deal. Being able to attach contracts, proposals, and reference docs directly to records is very useful.

### 8. Duplicate Detection & Merging

No deduplication. When importing or manually creating records, nothing flags "this organization/person might already exist" or supports merging duplicate records.

### 9. Forecasting

The pipeline has amounts and probabilities, but no forecasting rollup - i.e., "based on current pipeline, here's projected revenue by quarter" with weighted/unweighted views.

### 10. Audit Trail / Change History UI

Changes are tracked in activities, but there is no dedicated change history view showing "field X changed from A to B by User on Date" in a structured format (like Salesforce's field history tracking).

### 11. Saved Views / Filters

The ability to save filtered list views ("My open opportunities over $50k," "Contacts added this week," etc.) and share them with the team.

### 12. Recurring Tasks

Tasks exist but don't support recurrence (e.g., "call this contact every 2 weeks").

### 13. Call Logging with Click-to-Call

Calls are tracked as activities, but there's no VoIP/click-to-call integration or call recording/transcription.

---

## Lower-Impact for Internal Use

These are present in HubSpot/Salesforce but less relevant for a proprietary internal tool:

| Feature | Why It's Lower Priority |
|---------|------------------------|
| Forms / Lead Capture | Not selling the CRM externally |
| Live Chat / Chatbot | Not needed for internal use |
| Marketing Automation (Campaigns, Landing Pages) | Probably not needed |
| Customer Portal | Not relevant for internal use |
| Mobile App | Could be useful but not critical |
| Marketplace / App Ecosystem | Not relevant for proprietary tool |
| Scoring (Lead/Deal Scoring) | AI research may already cover this |

---

## Recommended Priority Order

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | Workflow Automation | Eliminates manual busywork, connects existing features together |
| 2 | Kanban Board Views | Pipeline visualization is the #1 daily-use feature in any CRM |
| 3 | Calendar Sync | Meetings are core to sales/BD - manual entry is friction |
| 4 | Inbound Email Sync | Completes the communication picture on entity timelines |
| 5 | Custom Dashboards/Reports | Analytics are good but rigid - flexibility matters as usage grows |
| 6 | Document Generation | Especially valuable given the strong RFP capabilities |
| 7 | Saved Views / Filters | Quality-of-life improvement for daily list navigation |
| 8 | Duplicate Detection | Data quality compounds over time - earlier is better |
| 9 | Forecasting | Natural extension of existing pipeline data |
| 10 | File Storage per Entity | Unified document management across all records |
