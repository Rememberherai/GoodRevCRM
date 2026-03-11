# Monthly Municipal Scanner Plan

## Goal

Turn the municipal scanner from a one-shot tool into a **monthly recurring process** where:
- You run it each month and only see **new** mentions
- It doesn't create duplicate organizations
- New mentions of the same project update the existing RFP (bump mention count)
- Truly new projects create new RFPs
- You can filter the CRM to see "what's new this month"
- Eventually: auto-email on new mentions

---

## Current State

### What the Scanner Searches For
- **Focus**: Waste/water infrastructure capital projects only
- **Includes**: WWTP upgrades, water treatment, sewer, stormwater, solid waste, recycling, landfills
- **Excludes**: Chemical supplies <$50K, maintenance contracts, service agreements, lab testing, admin
- **AI model**: Grok 4.1 Fast via OpenRouter
- **Confidence threshold**: 70%
- **Date range**: Last 12 months of meeting documents

### Reusable Files (core monthly workflow)
| File | Purpose |
|------|---------|
| `scripts/scan-municipal-minutes.ts` | Main scanner entry point |
| `lib/municipal-scanner/ai-extractor.ts` | AI analysis (Grok 4.1) |
| `lib/municipal-scanner/meeting-finder.ts` | Universal meeting link scorer |
| `lib/municipal-scanner/config.ts` | Scanner configuration |
| `lib/municipal-scanner/logger.ts` | Logging + no-minutes tracking |
| `scripts/municipal/enrichment/enrich-all-wwtp-rfps.ts` | EPA/Census/AI enrichment |
| `scripts/municipal/exports/export-enriched-wwtp-csv.ts` | CSV export with enrichment data |

### One-Time Setup Scripts (already done, not needed monthly)
- `scripts/municipal/imports/` — 28 scripts for importing cities and URLs
- `scripts/municipal/batch-updates/` — 54 scripts for batch URL updates
- `scripts/municipal/scanning/auto-find-usa-urls.ts` etc. — URL discovery
- `scripts/municipal/scanning/compare-*.ts`, `backtest-*.ts` — model evaluation

### Current Deduplication

| What | How | Status |
|------|-----|--------|
| **Organizations** | Scanner checks `name ILIKE + state + project_id` before creating | ✅ Works — won't create dupe orgs |
| **RFPs (within scan)** | Groups by title, counts mentions | ✅ Works |
| **RFPs (across scans)** | Checks `project_id + org_id + exact title match` → updates mention_count | ✅ Works — same title = update, not duplicate |
| **RFPs (similar but different title)** | No fuzzy matching | ⚠️ Gap — AI might generate slightly different title for same project |

---

## What's Missing for Monthly Runs

### 1. No way to re-scan successful municipalities
Scanner only picks up `pending` or `failed` status. For monthly runs, we need a `--rescan` flag to include `success` municipalities.

### 2. No "scan batch" tracking
RFPs have `created_at` but no `scan_batch` field. You can't easily filter "show me what was found in March 2026."

### 3. No date-range filter in CRM UI
The RFP list page has filters for status, source, region, confidence, country — but NOT for created date or scan batch. You can't see "new this month."

### 4. No automation events from scanner
The scanner inserts RFPs directly via Supabase client, bypassing the API route. `emitAutomationEvent()` is never called, so automations (like auto-email) won't fire on scanner-created RFPs.

---

## Implementation Plan

### Step 1: Migration — Add `scan_batch` Column to RFPs

**File:** `supabase/migrations/XXXX_add_scan_batch.sql`

Add a `scan_batch` column (TEXT) to the `rfps` table. The scanner sets it to a `YYYY-MM` string (e.g., `"2026-03"`).

- Backfill existing RFPs from `created_at`
- Regenerate TypeScript types
- Run typecheck

### Step 2: Scanner Changes

**File:** `scripts/scan-municipal-minutes.ts`

- **Add `--rescan` flag** — includes municipalities with `scan_status = 'success'` (not just `pending`/`failed`). This is how you re-scan all municipalities each month:
  ```bash
  npx tsx scripts/scan-municipal-minutes.ts --rescan
  ```
- **Add `--country` flag** — replace hardcoded `USA` filter so you can scan either country:
  ```bash
  npx tsx scripts/scan-municipal-minutes.ts --rescan --country USA
  npx tsx scripts/scan-municipal-minutes.ts --rescan --country Canada
  ```
- **Set `scan_batch`** — on insert AND update, set `scan_batch = "YYYY-MM"` so updated mentions also show up in the current month's filter
- **Emit automation events** — after inserting a NEW RFP, call `emitAutomationEvent()` with `entity.created` trigger. For updated RFPs (mention count bump), emit `entity.updated`

### Step 3: API + UI Changes

**Files:**
- `app/api/projects/[slug]/rfps/route.ts`
- `app/(dashboard)/projects/[slug]/rfps/rfps-page-client.tsx`

- Add `scanBatch` query param to the RFP GET endpoint
- Add `scanBatch` filter dropdown to the RFP list page (populated from distinct `scan_batch` values)
- Pick "2026-03" → see only what that month's scan found or re-mentioned
- Also add `createdAfter`/`createdBefore` query params to the API for flexibility

### Step 4: Monthly Runner Script

**File:** `scripts/run-monthly-scan.ts`

Single script that orchestrates the full monthly workflow:
1. Run scanner with `--rescan` for USA
2. Run scanner with `--rescan` for Canada
3. Run enrichment on new unenriched RFPs
4. Export CSV report of this month's findings
5. Print summary: X new RFPs, Y updated mentions, Z new orgs

### Step 5: Automation Setup (CRM UI, no code needed)

Create automation in the CRM:
- **Trigger:** `entity.created`, entity type = `rfp`
- **Condition:** `source = municipal_minutes`
- **Action:** `send_email` — notify team of new RFP discovery

---

## How It Works Monthly

```
1. RUN MONTHLY SCAN
   npx tsx scripts/run-monthly-scan.ts
   │
   ├─ Scans all 1000+ USA municipalities (re-scans successful ones too)
   ├─ Scans all Canadian municipalities
   │
   ├─ For each municipality:
   │   ├─ Fetch meeting minutes from last 12 months
   │   ├─ AI analyzes for waste/water capital projects
   │   │
   │   ├─ IF same project title exists → UPDATE mention_count, set scan_batch
   │   ├─ IF new project → CREATE new RFP, set scan_batch, fire automation
   │   ├─ IF new municipality → CREATE org first, then RFP
   │   └─ IF existing municipality → REUSE existing org (no dupe)
   │
   ├─ Enrich new RFPs (EPA capacity, Census growth, bond history)
   └─ Export CSV of this month's findings

2. VIEW IN CRM
   └─ Go to RFPs → Filter by Scan Batch = "2026-03"
       └─ See only new + updated RFPs from this month's scan

3. AUTO-EMAIL (optional)
   └─ Automation fires on each new RFP → email notification sent
```

---

## Verification Checklist

- [ ] Run `npx tsx scripts/run-monthly-scan.ts --dry-run` to verify scanner picks up all municipalities
- [ ] Re-scanning a municipality with existing RFPs updates `mention_count` instead of creating duplicates
- [ ] `scan_batch` is set correctly on new and updated RFPs
- [ ] Filter RFPs in CRM UI by scan batch month
- [ ] Automation event fires and email is sent for a new RFP
- [ ] `npm run typecheck` passes after migration

---

## Key Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/XXXX_add_scan_batch.sql` | New column |
| `types/database.ts` | Regenerated |
| `scripts/scan-municipal-minutes.ts` | `--rescan`, `--country`, `scan_batch`, automation events |
| `app/api/projects/[slug]/rfps/route.ts` | `scanBatch` filter param |
| `app/(dashboard)/projects/[slug]/rfps/rfps-page-client.tsx` | Scan batch dropdown |
| `scripts/run-monthly-scan.ts` | New orchestration script |
