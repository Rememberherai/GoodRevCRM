# Canadian Municipal RFP Scanner - Product Requirements Document

## Overview
Automated system to scan municipal meeting minutes across all Canadian provinces and territories to identify waste management, water treatment, and wastewater RFP opportunities. Discovered RFPs are automatically populated into the CRM's RFP database with full metadata tracking.

---

## Business Problem

**Current State:**
- Only 8 Canadian municipalities manually entered (NS, ON, BC)
- No systematic way to discover municipal procurement opportunities
- Missing significant RFP pipeline from Canadian government sector
- Manual research is time-consuming and incomplete

**Desired State:**
- Comprehensive coverage of all Canadian municipalities (300+ entities)
- Automated discovery of waste/water RFPs from public meeting minutes
- RFPs automatically populated in CRM with source tracking
- Ability to re-scan periodically for new opportunities

**Impact:**
- Expand addressable market to all Canadian municipalities
- Reduce manual research time by 80%+
- Increase RFP pipeline volume
- First-mover advantage on newly announced municipal projects

---

## Architecture Approach

### Hybrid Execution Model

**Phase 1: Municipality Discovery (Interactive)**
- User interacts with Claude Code: "Find all Canadian municipalities"
- Claude Code uses WebSearch tool to discover municipalities per province
- Direct database insertion via Supabase client
- Real-time terminal output

**Phase 2: Minutes URL Discovery (Interactive)**
- User: "Find meeting minutes URLs for municipalities"
- Claude Code uses WebSearch to locate official minutes pages
- Updates municipality records with URLs
- Real-time terminal output

**Phase 3: RFP Extraction (Automated Script)**
- User runs: `npm run scan-municipalities`
- Standalone TypeScript script processes municipalities
- Fetches minutes documents (PDF/HTML)
- AI-powered extraction of RFP data
- Automatic insertion into RFP database

**Rationale:**
- Claude Code handles WebSearch-dependent discovery naturally
- Script handles repetitive processing without external dependencies
- Leverages existing OpenRouter AI infrastructure
- Terminal output provides full visibility

---

## Database Schema

### New Migration: `supabase/migrations/XXXX_municipalities.sql`

**Table: `municipalities`**

Tracks all Canadian municipalities and their scan status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Municipality name (e.g., "Halifax", "Toronto") |
| `province` | TEXT | Province/territory (e.g., "Nova Scotia", "Ontario") |
| `country` | TEXT | Default 'Canada' |
| `official_website` | TEXT | Municipality's official website |
| `minutes_url` | TEXT | URL to meeting minutes page |
| `population` | INTEGER | Population estimate (optional) |
| `municipality_type` | TEXT | Type: city/town/village/regional/district |
| `last_scanned_at` | TIMESTAMPTZ | Last RFP scan timestamp |
| `scan_status` | TEXT | Status: pending/scanning/success/failed/no_minutes |
| `scan_error` | TEXT | Error message if scan failed |
| `rfps_found_count` | INTEGER | Running count of RFPs found |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
```sql
CREATE INDEX idx_municipalities_province ON municipalities(province);
CREATE INDEX idx_municipalities_scan_status ON municipalities(scan_status);
```

**Triggers:**
```sql
CREATE TRIGGER update_municipalities_updated_at
  BEFORE UPDATE ON municipalities
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
```

---

**Table: `municipal_scan_logs`**

Detailed audit log of all scan attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `municipality_id` | UUID | FK to municipalities |
| `scan_started_at` | TIMESTAMPTZ | Scan start time |
| `scan_completed_at` | TIMESTAMPTZ | Scan completion time |
| `status` | TEXT | running/success/failed |
| `minutes_fetched` | INTEGER | Number of minutes documents processed |
| `rfps_detected` | INTEGER | Number of RFPs detected by AI |
| `rfps_created` | INTEGER | Number of RFPs actually created |
| `error_message` | TEXT | Error details if failed |
| `metadata` | JSONB | Additional context (URLs tried, etc.) |
| `created_at` | TIMESTAMPTZ | Log creation time |

**Indexes:**
```sql
CREATE INDEX idx_scan_logs_municipality ON municipal_scan_logs(municipality_id);
CREATE INDEX idx_scan_logs_status ON municipal_scan_logs(status);
```

---

**Row-Level Security:**
```sql
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipal_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY municipalities_select ON municipalities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY scan_logs_select ON municipal_scan_logs
  FOR SELECT TO authenticated USING (true);
```

---

## RFP Data Structure

### Integration with Existing `rfps` Table

Extracted RFPs are inserted into the existing `rfps` table with these characteristics:

**Standard Fields:**
- `project_id`: User's project (configured)
- `organization_id`: Municipality organization (auto-created)
- `title`: RFP title extracted by AI
- `description`: Scope of work extracted by AI
- `due_date`: Submission deadline (if found)
- `estimated_value`: Budget (if mentioned)
- `currency`: 'CAD' (default for Canadian RFPs)
- `status`: 'identified' (initial status)
- `submission_method`: email/portal/physical/other
- `submission_email`: Contact email (if found)

**Custom Fields (JSONB):**
```json
{
  "country": "Canada",
  "region": "Nova Scotia",
  "source": "municipal_minutes",
  "minutes_url": "https://halifax.ca/council/minutes/2026-01-15",
  "ai_confidence": 85,
  "meeting_date": "2026-01-15"
}
```

**Organization Auto-Creation:**

If municipality organization doesn't exist:
```typescript
{
  project_id: PROJECT_ID,
  name: "Halifax - Nova Scotia",
  address_city: "Halifax",
  address_state: "Nova Scotia",
  address_country: "Canada",
  industry: "Government",
  description: "Municipal government - city",
  website: "https://halifax.ca"
}
```

---

## AI-Powered RFP Extraction

### OpenRouter Integration

**Model:** Claude 3.5 Sonnet (existing OpenRouter client)

**Prompt Strategy:**

```
You are analyzing municipal meeting minutes to identify procurement opportunities related to:
- Waste management (solid waste, recycling, composting)
- Water treatment (drinking water, water infrastructure)
- Wastewater treatment (sewage, WWTP, collection systems)

For each RFP, Request for Proposal, bid opportunity, or procurement mentioned, extract:
1. Title/Project Name
2. Description of scope of work
3. Due date / submission deadline (if mentioned)
4. Estimated value or budget (if mentioned)
5. Submission method (email, portal, physical)
6. Any contact information

Return ONLY opportunities that are:
- Active or upcoming (not historical/completed)
- Related to waste/water/wastewater
- Actually procurement opportunities (not just discussion)

Return as JSON array:
{
  "rfps": [
    {
      "title": string,
      "description": string,
      "due_date": string | null, // ISO date or null
      "estimated_value": number | null,
      "currency": string | null,
      "submission_method": "email" | "portal" | "physical" | "other" | null,
      "contact_email": string | null,
      "confidence": number // 0-100, how confident this is a real RFP
    }
  ]
}

If no RFPs found, return {"rfps": []}.
```

**Validation Rules:**
- Only insert RFPs with `confidence >= 70`
- Require at minimum: `title` and `description`
- Parse `due_date` into valid ISO format
- Handle missing optional fields gracefully

**Token Management:**
- Chunk documents >10k tokens
- Process each meeting separately if multiple in one document
- Aggregate results across all meetings for a municipality

---

## Core Scraper Implementation

### File: `scripts/scan-municipal-minutes.ts`

**CLI Arguments:**
```bash
npm run scan-municipalities                    # Full scan all provinces
npm run scan-municipalities -- --province "Ontario"  # Specific province
npm run scan-municipalities -- --limit 10      # Limit for testing
npm run scan-municipalities -- --retry-failed  # Rescan failed attempts
npm run scan-municipalities -- --dry-run       # Don't insert to DB
```

**Core Logic Flow:**

1. **Load Municipalities**
   ```typescript
   const municipalities = await supabase
     .from('municipalities')
     .select('*')
     .eq('scan_status', 'pending')
     .not('minutes_url', 'is', null)
     .order('province', 'name')
     .limit(args.limit || 10000)
   ```

2. **For Each Municipality:**
   - Create scan log entry (status: 'running')
   - Fetch minutes page HTML
   - Extract links to individual minutes documents (last 12 months)
   - Download PDF/HTML documents
   - Extract text content (unpdf for PDFs)
   - Call AI extraction API
   - Validate and insert RFPs
   - Update municipality stats
   - Update scan log (status: 'success'/'failed')

3. **Rate Limiting:**
   - 1-2 second delay between requests
   - Exponential backoff on failures
   - Respect robots.txt
   - Cache fetched content

4. **Error Handling:**
   - Log all errors to database
   - Continue processing on individual failures
   - Generate summary report
   - Track success/failure metrics

---

### File: `lib/municipal-scanner/ai-extractor.ts`

**Purpose:** Wrapper around OpenRouter for RFP extraction

```typescript
interface ExtractRfpsInput {
  minutesText: string;
  municipalityName: string;
  province: string;
  meetingDate?: string;
}

interface ExtractedRfp {
  title: string;
  description: string;
  due_date: string | null;
  estimated_value: number | null;
  currency: string | null;
  submission_method: string | null;
  contact_email: string | null;
  confidence: number;
}

export async function extractRfpsFromMinutes(
  input: ExtractRfpsInput
): Promise<ExtractedRfp[]> {
  // Call OpenRouter with prompt
  // Validate response schema
  // Filter by confidence threshold
  // Return validated RFPs
}
```

---

### File: `lib/municipal-scanner/logger.ts`

**Purpose:** Terminal output formatting

```typescript
export class ScanLogger {
  logMunicipalityStart(index: number, total: number, name: string): void
  logMinutesFound(url: string, count: number): void
  logAIAnalysis(pageCount: number): void
  logRfpCreated(title: string, dueDate: string | null): void
  logError(message: string): void
  logSummary(stats: ScanSummary): void
}
```

---

### File: `lib/municipal-scanner/config.ts`

**Purpose:** Configuration management

```typescript
export const SCANNER_CONFIG = {
  PROJECT_ID: process.env.SCANNER_PROJECT_ID || 'default-project-id',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DATE_RANGE_MONTHS: 12, // Scan last 12 months of minutes
  CONFIDENCE_THRESHOLD: 70, // Minimum AI confidence to insert RFP
  REQUEST_DELAY_MS: 2000, // Delay between requests
  MAX_RETRIES: 3,
  CHUNK_SIZE_TOKENS: 10000, // Max tokens per AI call
};
```

---

## Execution Workflow

### Step 1: Database Setup

**Commands:**
```bash
# Deallocate prepared statements
node -e "const { Client } = require('pg'); ..."

# Run migration
npx supabase db push --db-url 'postgresql://...'

# Regenerate types
npx supabase gen types typescript --db-url '...' > types/database.ts

# Typecheck
npm run typecheck
```

**Deliverable:** `municipalities` and `municipal_scan_logs` tables created

---

### Step 2: Municipality Discovery (Interactive)

**User Action:** Say to Claude Code:
```
"Find all Canadian municipalities and add to the database.
Cover all 13 provinces and territories."
```

**Claude Code Actions:**
1. Use WebSearch for each province: "list of municipalities in [Province] Canada"
2. Parse Wikipedia/government sites for municipality lists
3. For each municipality: WebSearch "[Name] [Province] official website"
4. Insert into `municipalities` table
5. Output progress to terminal

**Terminal Output Example:**
```
🔍 Searching for municipalities in Ontario...
   Found: Toronto, Ottawa, Hamilton, London, ... (50 more)
   ✓ Inserted 53 Ontario municipalities

🔍 Searching for municipalities in British Columbia...
   Found: Vancouver, Victoria, Surrey, Burnaby, ... (40 more)
   ✓ Inserted 43 BC municipalities

... continues for all 13 provinces/territories ...

✅ Total municipalities discovered: 347
💾 Database updated successfully
```

**Deliverable:** 300-400 municipalities in database

---

### Step 3: Minutes URL Discovery (Interactive)

**User Action:** Say to Claude Code:
```
"Find meeting minutes URLs for all municipalities in the database"
```

**Claude Code Actions:**
1. Load municipalities from database
2. For each: WebSearch "[Municipality] [Province] council meeting minutes"
3. Extract URL from search results (official government sites)
4. Update `municipalities.minutes_url`
5. Handle not found cases (mark as 'no_minutes')

**Terminal Output Example:**
```
[1/347] Halifax, Nova Scotia
   🔍 Searching for minutes page...
   ✓ Found: https://halifax.ca/council/minutes
   💾 Updated database

[2/347] Toronto, Ontario
   🔍 Searching for minutes page...
   ✓ Found: https://toronto.ca/council/meetings
   💾 Updated database

[3/347] Smalltown, Saskatchewan
   🔍 Searching for minutes page...
   ⚠️  No public minutes found - marked as no_minutes

... continues ...

✅ URLs found for: 312 municipalities
⚠️  No minutes page: 35 municipalities
```

**Deliverable:** Municipality records updated with minutes URLs

---

### Step 4: RFP Extraction (Automated Script)

**User Action:**
```bash
npm run scan-municipalities
```

**Script Actions:**
1. Load municipalities with `minutes_url` populated
2. For each municipality:
   - Fetch minutes page
   - Extract links to individual meeting docs (last 12 months)
   - Download PDFs/HTML
   - Extract text using `unpdf`
   - Send to AI for RFP extraction
   - Create/update organization record
   - Insert RFPs into database
   - Log results
3. Output summary statistics

**Terminal Output Example:**
```bash
$ npm run scan-municipalities

🇨🇦 Canadian Municipal RFP Scanner
====================================

Configuration:
- Project ID: abc123
- Database: Connected to Supabase
- Total municipalities to scan: 312
- Date range: Last 12 months

Starting scan...

[1/312] Halifax, Nova Scotia
  📄 Fetching minutes from: https://halifax.ca/council/minutes
  📥 Downloaded 12 meeting documents (PDFs)
  🤖 AI analyzing 267 pages of minutes...
  ✅ Found 3 RFPs:
     ✓ "Water Treatment Plant Upgrade" (Due: 2026-03-15)
     ✓ "Waste Collection Services Contract" (Due: 2026-04-01)
     ✓ "Wastewater Infrastructure Assessment" (Due: 2026-03-20)
  💾 Inserted into database

[2/312] Toronto, Ontario
  📄 Fetching minutes from: https://toronto.ca/council/meetings
  📥 Downloaded 24 meeting documents (HTML)
  🤖 AI analyzing content...
  ⚠️  No waste/water RFPs found

[3/312] Smalltown, Saskatchewan
  ❌ Error: Failed to fetch minutes (404)
  📝 Logged to municipal_scan_logs

... (continues for all 312 municipalities) ...

====================================
Scan Complete!
====================================

Results:
✅ Municipalities scanned: 312
📊 RFPs detected: 89
🏢 Organizations created: 298
💾 RFPs inserted to database: 89
❌ Errors: 14

Top provinces by RFPs:
- Ontario: 34 RFPs
- British Columbia: 21 RFPs
- Alberta: 18 RFPs
- Quebec: 9 RFPs
- Nova Scotia: 4 RFPs
- Other: 3 RFPs

View your RFPs at: http://localhost:3000/projects/your-slug/rfps
Filter by source: "municipal_minutes"

Detailed logs saved to: municipal_scan_logs table
```

**Deliverable:**
- 89 new RFPs in database
- 298 new municipal organizations
- Scan logs for all attempts

---

## Viewing Results

### In CRM Web UI

**Navigate to:** `/projects/[slug]/rfps`

**Filter RFPs by Source:**
- Use custom_fields filter: `source = "municipal_minutes"`
- Sort by created_at DESC to see newest
- View organization details to see municipality info

**RFP Details Show:**
- Municipality name (organization)
- Project title and description
- Due date (if found)
- Link to source meeting minutes
- AI confidence score
- Province/region tags

---

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Language | TypeScript/Node.js | Using `tsx` for execution |
| Web Search | Claude Code WebSearch | Interactive discovery only |
| Web Fetching | Native fetch API | Node 18+ |
| PDF Parsing | `unpdf` | Already in package.json |
| HTML Parsing | `cheerio` | Need to install |
| AI Processing | OpenRouter + Claude 3.5 Sonnet | Existing client |
| Database | Supabase/PostgreSQL | Existing @supabase/supabase-js client |
| CLI Args | process.argv | Simple native parsing |
| Date Parsing | date-fns | Already in package.json |
| Logging | Custom logger | Terminal output with colors |

---

## Testing & Validation

### End-to-End Test Plan

**Phase 1: Database Setup**
- ✅ Migration runs successfully
- ✅ Types regenerated without errors
- ✅ Typecheck passes

**Phase 2: Municipality Discovery**
- ✅ 5 test municipalities inserted (1 per region)
- ✅ official_website populated correctly
- ✅ province field correct

**Phase 3: Minutes URL Discovery**
- ✅ 5 test municipalities have minutes_url
- ✅ URLs are valid (200 response)
- ✅ No_minutes status for municipalities without pages

**Phase 4: Content Scraping**
- ✅ Fetch 1-2 municipality minutes
- ✅ PDF extraction works (text output)
- ✅ HTML extraction works

**Phase 5: AI Extraction**
- ✅ Test on sample minutes with known RFP
- ✅ Structured output matches schema
- ✅ Confidence scores reasonable
- ✅ No false positives on non-RFP content

**Phase 6: Database Population**
- ✅ Organizations auto-created correctly
- ✅ RFPs inserted with all fields
- ✅ custom_fields contain source metadata
- ✅ No duplicate RFPs created

**Phase 7: Full Pipeline**
- ✅ Run scan on 10 municipalities
- ✅ Check RFPs in web UI
- ✅ Verify accuracy vs source docs

### Manual Verification Checklist

- [ ] Spot-check 10-20 RFPs against source documents
- [ ] Verify due dates are accurate (not meeting dates)
- [ ] Confirm titles match actual RFP names
- [ ] Check for false positives (non-RFPs flagged)
- [ ] Validate submission methods are correct
- [ ] Ensure no private/sensitive info extracted

---

## Error Handling & Monitoring

### Error Categories

**1. Network Errors:**
- Minutes page not accessible (404, timeout)
- Rate limiting (429)
- SSL/TLS issues

**Handling:** Log to scan_logs, mark status='failed', continue to next

**2. Parsing Errors:**
- Malformed PDF
- Unsupported document format
- Encoding issues

**Handling:** Log error, skip document, continue

**3. AI Errors:**
- OpenRouter API failure
- Token limit exceeded
- Invalid JSON response

**Handling:** Retry with exponential backoff, log failure

**4. Database Errors:**
- Duplicate key violations
- RLS policy violations
- Connection failures

**Handling:** Rollback transaction, log error, halt scan

### Logging Strategy

**Console Output (Terminal):**
- Real-time progress updates
- Summary statistics
- Error highlights

**Database Logging (`municipal_scan_logs`):**
- Every scan attempt recorded
- Detailed error messages
- Metadata for debugging

**File Logging (Optional):**
- `logs/scan-[timestamp].json` for archival
- Full request/response data for debugging

---

## Performance Considerations

### Estimated Runtime

**Municipality Discovery:** 1-2 hours interactive
- 13 provinces × ~5 min per province
- WebSearch + database inserts

**Minutes URL Discovery:** 3-5 hours interactive
- 347 municipalities × ~30 sec per municipality
- WebSearch + database updates

**RFP Extraction:** 10-20 hours automated
- 312 municipalities × 2-3 min per municipality
- Depends on: document count, AI processing time, network speed

### Optimization Strategies

**Parallel Processing:**
- Process 3-5 municipalities concurrently
- Use Promise.all() with concurrency limit

**Caching:**
- Cache fetched documents to avoid re-downloading
- Store in temp directory, keyed by URL hash

**Incremental Scans:**
- Only scan municipalities with new minutes
- Track last_scanned_at timestamp
- Delta scans instead of full rescans

**Batching:**
- Batch database inserts (10-20 at a time)
- Reduce round-trip overhead

---

## Future Enhancements

### Phase 2 Features

**1. UI Dashboard**
- Admin panel to view scan status
- Trigger rescans from UI
- Review low-confidence RFPs before publishing

**2. Email Notifications**
- Alert when new RFPs found
- Daily/weekly digest of opportunities
- Filter by province/value threshold

**3. Smart Scheduling**
- Cron job for weekly rescans
- Prioritize municipalities with frequent updates
- Skip municipalities with no historical RFPs

**4. Enhanced AI Extraction**
- Extract contact persons (names, titles)
- Identify project timelines and milestones
- Classify RFP type (new build, maintenance, consulting)

**5. Multi-Country Support**
- Expand to US municipalities
- UK councils
- Australian local governments

**6. False Positive Feedback Loop**
- Mark RFPs as false positives in UI
- Retrain AI prompts based on feedback
- Improve confidence scoring

---

## Implementation Checklist

### Database
- [ ] Create migration file
- [ ] Run migration to Supabase
- [ ] Regenerate TypeScript types
- [ ] Run typecheck

### Code Files
- [ ] `lib/municipal-scanner/types.ts`
- [ ] `lib/municipal-scanner/config.ts`
- [ ] `lib/municipal-scanner/logger.ts`
- [ ] `lib/municipal-scanner/ai-extractor.ts`
- [ ] `scripts/scan-municipal-minutes.ts`

### Dependencies
- [ ] Install `cheerio` for HTML parsing
- [ ] Verify `unpdf` installed
- [ ] Add npm script to package.json

### Testing
- [ ] Test migration
- [ ] Test municipality discovery (5 test cases)
- [ ] Test minutes URL discovery (5 test cases)
- [ ] Test AI extraction on sample document
- [ ] Test full pipeline on 10 municipalities

### Documentation
- [ ] Update README with scan commands
- [ ] Create troubleshooting guide
- [ ] Document configuration options

### Deployment
- [ ] Run full municipality discovery
- [ ] Run minutes URL discovery
- [ ] Run RFP extraction scan
- [ ] Review results in UI
- [ ] Clean up false positives

---

## Success Metrics

**Quantitative:**
- 300+ Canadian municipalities in database
- 250+ with minutes URLs found
- 50+ RFPs discovered in first scan
- <5% false positive rate
- 80%+ of RFPs have due dates extracted

**Qualitative:**
- System can be re-run monthly for updates
- Terminal output is clear and informative
- RFPs in CRM are actionable (title, description, due date)
- Municipal organizations properly linked to RFPs

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Municipal sites block scraping | Medium | High | Respect robots.txt, add delays, use polite user agent |
| Minutes not machine-readable | Medium | Medium | Fall back to manual entry for key municipalities |
| AI extraction accuracy low | Low | High | Validate on test set, tune confidence threshold |
| API rate limits hit | Medium | Low | Implement exponential backoff, cache aggressively |
| Database migration issues | Low | Medium | Test on staging, use IF NOT EXISTS clauses |

---

## Appendix

### Sample Provinces and Territories

**Provinces (10):**
1. Alberta
2. British Columbia
3. Manitoba
4. New Brunswick
5. Newfoundland and Labrador
6. Nova Scotia
7. Ontario
8. Prince Edward Island
9. Quebec
10. Saskatchewan

**Territories (3):**
1. Northwest Territories
2. Nunavut
3. Yukon

### Sample Municipality Data

```json
{
  "name": "Halifax",
  "province": "Nova Scotia",
  "country": "Canada",
  "official_website": "https://halifax.ca",
  "minutes_url": "https://halifax.ca/council/minutes",
  "population": 450000,
  "municipality_type": "city"
}
```

### Sample Extracted RFP

```json
{
  "title": "Water Treatment Plant Upgrade",
  "description": "Design-build project for upgrading the Halifax Water Treatment Plant to meet new provincial standards. Includes UV disinfection system, membrane filtration, and control system modernization.",
  "due_date": "2026-03-15",
  "estimated_value": 12500000,
  "currency": "CAD",
  "submission_method": "portal",
  "contact_email": "procurement@halifax.ca",
  "confidence": 92,
  "custom_fields": {
    "country": "Canada",
    "region": "Nova Scotia",
    "source": "municipal_minutes",
    "minutes_url": "https://halifax.ca/council/minutes/2026-01-15",
    "meeting_date": "2026-01-15"
  }
}
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-06
**Author:** Product Team
**Status:** Ready for Implementation
