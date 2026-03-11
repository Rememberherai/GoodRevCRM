# Monthly Municipal Scanner Guide

## Quick Start

Run a full monthly scan (USA + Canada):

```bash
npx tsx scripts/run-monthly-scan.ts
```

This will:
1. Re-scan all USA municipalities for new meeting mentions
2. Re-scan all Canada municipalities
3. Enrich new RFPs with EPA/Census/AI data
4. Print a summary

## Options

```bash
# USA only
npx tsx scripts/run-monthly-scan.ts --country USA

# Canada only
npx tsx scripts/run-monthly-scan.ts --country Canada

# Preview without writing to database
npx tsx scripts/run-monthly-scan.ts --dry-run

# Test with a small batch
npx tsx scripts/run-monthly-scan.ts --limit 10

# Skip enrichment step
npx tsx scripts/run-monthly-scan.ts --skip-enrich
```

## How It Works

- **Deduplication**: Existing organizations are matched by name + state. Existing RFPs are matched by org + title. Matches bump the mention count instead of creating duplicates.
- **Scan Batch**: Each run tags RFPs with a `scan_batch` field (e.g. `2026-03`). Use this to filter what's new each month in the CRM.
- **Automation Events**: New RFPs emit `entity.created` events, updated RFPs emit `entity.updated`. These can trigger automations (e.g. email notifications).

## Viewing Results in CRM

Go to the RFPs page and use the **Scan Batch** dropdown to filter by month (e.g. "March 2026"). This shows only RFPs found or updated during that scan.

## Running the Scanner Directly

For more control, run the scanner script directly:

```bash
# Scan USA with rescan mode (includes previously scanned municipalities)
npx tsx scripts/scan-municipal-minutes.ts --rescan --country USA

# Scan Canada
npx tsx scripts/scan-municipal-minutes.ts --rescan --country Canada

# Dry run with limit
npx tsx scripts/scan-municipal-minutes.ts --rescan --country USA --dry-run --limit 5
```

## Monthly Workflow

1. Run `npx tsx scripts/run-monthly-scan.ts`
2. Open the CRM, filter RFPs by the current month's scan batch
3. Review new discoveries, update statuses as needed
4. Set up automations to auto-email on new RFP discoveries if desired
