# Province-Level Municipal RFP Scanning

## Overview

These scripts scan all municipalities in a province for waste/water/wastewater RFPs by analyzing their council meeting minutes.

## Available Scripts

### Ontario
```bash
npm run scan:ontario
```
- **Municipalities**: ~444 total
- **Estimated time**: 8-12 hours (depends on meeting availability)
- **Best for**: Largest municipality count, most comprehensive scan

### Quebec
```bash
npm run scan:quebec
```
- **Municipalities**: ~1,100 total (if CSV imported)
- **Estimated time**: 18-24 hours
- **Note**: Run `npm run add-quebec-from-csv` first to populate municipalities

### Manitoba
```bash
npm run scan-municipalities -- --province Manitoba
```
- **Municipalities**: 20 in database
- **Estimated time**: 30-60 minutes
- **Good for**: Quick validation test

## How It Works

### 1. Municipality Discovery
Each province script:
- Fetches all municipalities for that province from database
- Filters to only those with `minutes_url` populated
- Orders by population (largest first)

### 2. Meeting Detection (Universal Finder)
For each municipality, the scanner:
- Fetches the minutes/calendar page
- Detects iframes (AllNet, eSCRIBE, etc.)
- Extracts all links from page and iframe content
- Scores each link by relevance:
  - Document patterns (PDF, download_file, publicAgenda.aspx): +3
  - Strong keywords (agenda, minutes): +4 each
  - Meeting keywords (council, committee): +2 each
  - Recent years (2024-2026): +3 each
  - Month names: +2 each
  - Date patterns ("February 4"): +3
- Returns top 50 meeting documents

### 3. Content Extraction
For each meeting document:
- **PDF files**: Uses pdf-parse library to extract text
- **HTML pages**: Uses cheerio to extract text from HTML
- Chunks large documents (>100k chars) to fit AI context

### 4. AI RFP Detection
Sends content to Grok 4.1 Fast ($0.20/$0.50 per 1M tokens) with prompt:
```
Find all waste/water/wastewater RFPs, bids, tenders, or procurement
opportunities. Extract: title, description, due date, value,
submission method, contact info.
```

### 5. Database Insertion
For each detected RFP:
- Creates organization record (if not exists)
- Inserts RFP with metadata:
  - `custom_fields.source`: "municipal_minutes"
  - `custom_fields.region`: Province name
  - `custom_fields.all_meeting_urls`: Array of meeting URLs where mentioned
  - `custom_fields.mention_count`: Number of times mentioned
- Deduplicates by title + organization
- Updates municipality scan status and RFP count

## Output

The scanner provides real-time output:

```
🍁 Ontario Municipal RFP Scanner
====================================

Found 444 Ontario municipalities with minutes URLs

Top 20 by population:
  1. Toronto - 2,930,000 people
  2. Ottawa - 1,017,000 people
  3. Mississauga - 721,000 people
  ...

Starting scan...

[1/444] Toronto, Ontario
  📄 Minutes URL: https://toronto.ca/council/meetings
  👥 Population: 2,930,000
  📦 Found iframe, fetching: https://agendas.toronto.ca/...
  🔗 Found 523 total links, filtering for meetings...
  📎 Found 50 meeting document links
  📄 [1/50] Fetching PDF: https://...
    📝 Extracted 145,234 characters
    🤖 AI analyzing for waste/water RFPs...
    ✅ Found 3 potential RFP(s)!
  ...
  📊 Total RFPs found across all meetings: 12
  💾 Inserting 12 RFPs into database...
     ✓ "Toronto Water Main Replacement Program"
     ✓ "Wastewater Treatment Plant Upgrades"
     ...
  ✅ Success - 12 RFPs found

[2/444] Ottawa, Ontario
  ...

📊 Progress: 10/444 (2%)
   RFPs found so far: 47
   Success rate: 80%
   Time elapsed: 12 minutes
   Estimated time remaining: 528 minutes

...

====================================
Scan Complete!
====================================

Results:
✅ Municipalities scanned: 444
📊 RFPs detected: 1,234
💾 RFPs created: 1,189
❌ Errors: 45
⏱️  Duration: 542 minutes

✅ Successfully scanned: 399/444 municipalities
❌ Errors: 45
📊 Total RFPs found: 1,189
⏱️  Total time: 542 minutes (1.2 min/municipality)
```

## Performance

### Speed
- **Average**: 1-2 minutes per municipality
- **Fast** (no meetings): <10 seconds
- **Slow** (50+ meetings): 5-10 minutes

### Costs (Grok 4.1 Fast)
- **Input**: $0.20 per 1M tokens
- **Output**: $0.50 per 1M tokens
- **Average per municipality**: $0.02 - $0.10
- **Province cost estimates**:
  - Ontario (444): $10 - $50
  - Quebec (1,100): $25 - $125
  - Manitoba (20): $0.50 - $2

### Success Rates
From Manitoba test (20 municipalities):
- **Meeting detection**: 60% (12/20 found meetings)
- **RFP extraction**: 15% (3/20 found RFPs)
- **Total RFPs found**: 55 opportunities

Expected for larger provinces:
- **Ontario**: 200-400 RFPs (based on ~50% meeting detection, ~20% RFP rate)
- **Quebec**: 500-1000 RFPs

## Database Updates

Each scan updates:

### `municipalities` table
- `last_scanned_at`: Timestamp of scan
- `scan_status`: 'success' or 'failed'
- `scan_error`: Error message (if failed)
- `rfps_found_count`: Number of RFPs found

### `organizations` table
- New records for each municipality (if not exists)
- Linked to municipality via name + province

### `rfps` table
- New RFP records with:
  - `project_id`: Your project ID
  - `organization_id`: Municipality organization
  - `status`: 'identified'
  - `custom_fields`:
    - `source`: "municipal_minutes"
    - `region`: Province
    - `country`: "Canada"
    - `all_meeting_urls`: Array of meeting URLs
    - `mention_count`: Number of mentions
    - `ai_confidence`: 0-100 score

## Viewing Results

### In Web UI
1. Navigate to `/projects/[slug]/rfps`
2. Filter by source: "Municipal Minutes (Discussions)"
3. Filter by region: "Ontario", "Quebec", etc.
4. Sort by estimated_value descending

### Via Database Query
```sql
SELECT
  r.title,
  r.estimated_value,
  r.due_date,
  o.name as municipality,
  r.custom_fields->>'region' as province,
  (r.custom_fields->>'mention_count')::int as mentions
FROM rfps r
JOIN organizations o ON r.organization_id = o.id
WHERE r.custom_fields->>'source' = 'municipal_minutes'
  AND r.custom_fields->>'region' = 'Ontario'
ORDER BY r.estimated_value DESC NULLS LAST;
```

## Monitoring Progress

### Real-time
Watch the terminal output - shows progress every 10 municipalities

### Database Queries
```sql
-- Municipalities scanned so far
SELECT
  province,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE scan_status = 'success') as success,
  COUNT(*) FILTER (WHERE scan_status = 'failed') as failed,
  SUM(rfps_found_count) as total_rfps
FROM municipalities
WHERE province = 'Ontario'
  AND last_scanned_at IS NOT NULL
GROUP BY province;

-- Recent scans
SELECT
  name,
  last_scanned_at,
  scan_status,
  rfps_found_count
FROM municipalities
WHERE province = 'Ontario'
ORDER BY last_scanned_at DESC
LIMIT 20;
```

## Error Handling

The scanner handles:
- **404 errors**: Logs and continues to next municipality
- **Timeout errors**: Retries once, then skips
- **PDF parsing errors**: Skips document, continues to next
- **AI API errors**: Retries 3 times with exponential backoff
- **Database errors**: Logs error but continues scan

All errors are logged to:
- Terminal output
- `municipalities.scan_error` field
- Console error logs

## Resuming Failed Scans

To rescan failed municipalities:

```bash
# Rescan all failed municipalities in Ontario
npm run scan-municipalities -- --province Ontario --retry-failed

# Rescan specific municipality
npm run scan-municipalities -- --municipality "Toronto"
```

## Tips for Large Scans

1. **Run in background**:
   ```bash
   nohup npm run scan:ontario > ontario-scan.log 2>&1 &
   ```

2. **Monitor progress**:
   ```bash
   tail -f ontario-scan.log
   ```

3. **Split by population**:
   - Large cities (>100k): Higher RFP rate, slower scans
   - Small towns (<10k): Lower RFP rate, faster scans

4. **Schedule during off-hours**:
   - Municipal websites may have rate limits
   - Run overnight or on weekends

5. **Check costs**:
   - Monitor OpenRouter dashboard
   - Set spending alerts

## Troubleshooting

### No meetings found
- Check `minutes_url` is correct
- Municipality may not publish online
- Try manual verification: visit URL in browser

### No RFPs found
- Municipality may not have waste/water projects
- Check AI model is detecting correctly (compare-models script)
- Review meeting content manually

### High error rate
- Check internet connection
- Verify API keys are valid
- Check database connection

### Slow performance
- Some municipalities have 50+ meetings to process
- Large PDF files take longer to parse
- Consider reducing `monthsBack` parameter to 6 months

## Next Steps

After scanning a province:

1. **Review RFPs**: Check for false positives in UI
2. **Delete irrelevant**: Remove non-procurement items
3. **Enrich data**: Add missing due dates, values
4. **Follow up**: Contact municipalities for clarification
5. **Track**: Monitor for updates in future scans
