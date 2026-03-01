# USA Municipal Scanner Guide

## Overview

The USA municipal scanner is now ready to process all **1,000 municipalities** with validated council meeting URLs.

## What's Changed

### 1. **Country Filter**
- Scanner now filters for `country = 'USA'` only
- All Canadian municipalities are excluded

### 2. **No Minutes Logging**
- New log file: `logs/no-minutes-YYYY-MM-DDTHH-MM-SS.log`
- Tracks URLs that don't return any meeting documents
- Format: `Municipality | State | URL | Reason`
- Use this for manual follow-up on problematic URLs

### 3. **Currency & Country Updates**
- Organizations created with `address_country = 'USA'`
- RFPs created with `currency = 'USD'` (instead of CAD)
- Custom fields use `country = 'USA'`

## Quick Start

### Check Current Status
```bash
npx tsx scripts/check-usa-scan-status.ts
```

### Run Full Scan (All 1000 Municipalities)
```bash
./scripts/scan-all-usa.sh
```

Or directly:
```bash
npx tsx scripts/scan-municipal-minutes.ts
```

### Scan Specific State
```bash
npx tsx scripts/scan-municipal-minutes.ts --province "California"
```

### Scan with Limit (Testing)
```bash
npx tsx scripts/scan-municipal-minutes.ts --limit 10
```

### Retry Failed Scans
```bash
npx tsx scripts/scan-municipal-minutes.ts --retry-failed
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--province <state>` | Scan only municipalities in specific state |
| `--limit <number>` | Limit number of municipalities to scan |
| `--retry-failed` | Only retry municipalities with `scan_status = 'failed'` |
| `--dry-run` | Test mode - no database writes |

## Output Files

### Main Log
- **Location**: `logs/scan-YYYY-MM-DDTHH-MM-SS.log`
- **Contains**: Full scan progress, RFPs found, errors
- **Use for**: Reviewing scan results, debugging

### No Minutes Log
- **Location**: `logs/no-minutes-YYYY-MM-DDTHH-MM-SS.log`
- **Contains**: URLs that returned zero meeting documents
- **Format**: CSV-like with pipe separators
- **Use for**: Manual follow-up on problematic URLs

Example entry:
```
Fountain Hills | Arizona | https://www.fh.az.gov/AgendaCenter | No meeting documents found on calendar page
```

## Scan Configuration

Current settings in `lib/municipal-scanner/config.ts`:

- **Date Range**: Last 6 months of meetings
- **Parallel Processing**: Enabled
- **Concurrent Municipalities**: 3 at a time
- **Concurrent Meetings**: 5 per municipality
- **Request Delay**: 1000ms between batches

## Expected Results

### Database Counts (Before Scan)
- **Total USA Municipalities**: 1,000
- **With URLs**: 1,000 (100%)
- **Status**: All `pending`

### After Scan
- **Scan Status**: Will be `success`, `failed`, or `no_minutes`
- **RFPs Created**: Depends on meeting content
- **Organizations**: One per municipality (created automatically)

## Monitoring Progress

The scanner logs progress in real-time:

```
[1/1000] New Brighton, Minnesota
  📄 Minutes URL: https://www.newbrightonmn.gov/AgendaCenter
  🔍 Finding meeting documents...
  📄 Processing meetings 1-5 of 12
    [1/12] Fetching PDF: https://...
      📝 Extracted 15,234 characters
      🤖 AI analyzing...
      ✅ Found 2 RFP(s)!
  📊 Total RFPs found across all meetings: 2
  💾 Inserting 2 RFPs into database...
     ✓ "Water Main Replacement Project - Phase 3"
       Value: $450,000 USD
     ✓ "Wastewater Treatment Plant Upgrade"
       Value: $1,200,000 USD
  💾 Inserted into database
```

## Performance Estimates

### Processing Speed
- **Per Municipality**: ~30-60 seconds (varies by meeting count)
- **1000 Municipalities**: ~10-20 hours total
- **With Parallel Processing**: Significantly faster

### Resource Usage
- **API Calls**: Depends on meeting documents found
- **AI Tokens**: ~10,000-50,000 per municipality
- **Network**: Heavy during document fetching

## Troubleshooting

### No Meeting Documents Found
Check `logs/no-minutes-*.log` for URLs that failed to return documents. Common reasons:
- Calendar page structure changed
- PDF/document links not detected
- JavaScript-heavy sites requiring browser rendering
- Authentication/paywalls

### Scan Failures
Check main log file for error messages. Common issues:
- Network timeouts
- AI API rate limits
- PDF parsing errors
- Malformed URLs

### Resume After Interruption
The scanner tracks status per municipality. Simply re-run:
```bash
npx tsx scripts/scan-municipal-minutes.ts
```

Only municipalities with `scan_status = 'pending'` or `'failed'` will be processed.

## Manual Follow-Up Workflow

1. **Review No-Minutes Log**
   ```bash
   cat logs/no-minutes-*.log
   ```

2. **Manually verify URLs** - Visit URLs in browser to check if:
   - Site is accessible
   - Meeting documents exist
   - Different URL needed

3. **Update URLs** - Create batch update script for corrected URLs:
   ```typescript
   const urlUpdates = [
     { name: 'City', province: 'State', url: 'https://corrected-url.gov' }
   ];
   ```

4. **Re-scan** - Run scanner again on updated municipalities

## Next Steps After Scan

1. **Review RFPs** in CRM UI
2. **Filter by**: `custom_fields.source = "municipal_minutes"`
3. **Quality Check**: Review AI confidence scores
4. **Follow Up**: Use `no-minutes-*.log` to improve URL coverage
5. **Schedule**: Set up recurring scans (weekly/monthly)

## Support

- **Scanner Issues**: Check logs in `logs/` directory
- **Database Issues**: Review Supabase logs
- **URL Problems**: Use `no-minutes-*.log` for tracking

---

**Ready to scan?** Run `./scripts/scan-all-usa.sh` to start!
