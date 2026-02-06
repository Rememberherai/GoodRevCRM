# Municipal Scanner - How to Filter Results

## Overview
The Municipal Scanner finds waste/water opportunities from Canadian municipal meeting minutes and stores them in your RFP database with rich research metadata.

## How to Filter Municipal RFPs in the UI

Navigate to: `/projects/[your-project]/rfps`

You'll see **5 new filter dropdowns** above the RFP table:

### 1. **Source Filter**
- **All Sources** - Shows everything
- **Municipal Minutes** - Shows ONLY opportunities from municipal meetings
- **EPA** - Shows EPA-sourced RFPs
- **Manual Entry** - Shows manually entered RFPs

**Use this to**: Instantly view only municipal meeting opportunities

### 2. **Region Filter**
- **All Regions** - Shows all provinces
- **Nova Scotia** - Shows only Nova Scotia opportunities
- **Ontario** - Shows only Ontario opportunities
- **British Columbia**, **Alberta**, **Quebec**, etc.

**Use this to**: Focus on specific provinces or territories

### 3. **Committee Filter**
- **All Committees** - Shows all
- **Regional Council** - Shows council-level discussions
- **Public Works** - Shows public works committee items
- **Water Commission** - Shows water commission items
- **Environment** - Shows environmental committee items

**Use this to**: Find opportunities from specific municipal committees

### 4. **Confidence Filter**
- **All Confidence** - Shows all confidence levels
- **90%+ (High)** - Only high-confidence opportunities
- **80%+ (Good)** - Good confidence and above
- **70%+ (Medium)** - Medium confidence and above
- **50%+ (Low)** - Low confidence and above

**Use this to**: Filter by how confident the AI is that this is a real opportunity

### 5. **Status Filter** (existing)
Works as before - filter by RFP status (identified, reviewing, won, lost, etc.)

## Example Filtering Workflows

### Find All Municipal Minutes Opportunities
1. Set **Source** = "Municipal Minutes"
2. Leave other filters on "All"
3. Result: All waste/water opportunities from Canadian municipal meetings

### Find High-Confidence Ontario Opportunities
1. Set **Source** = "Municipal Minutes"
2. Set **Region** = "Ontario"
3. Set **Confidence** = "80%+ (Good)"
4. Result: Only high-quality Ontario municipal opportunities

### Find Water Commission Discussions Across Canada
1. Set **Source** = "Municipal Minutes"
2. Set **Committee** = "Water Commission"
3. Result: All water commission meeting items

## What Data is Captured

Each municipal RFP includes:

### Standard RFP Fields
- **Title** - Project name
- **Description** - Detailed description of the opportunity
- **Organization** - Municipality name
- **Status** - Always "identified" initially
- **Due Date** - If mentioned in minutes
- **Estimated Value** - Budget if mentioned
- **Currency** - Usually CAD

### Research Metadata (in custom_fields)
- **source** - Always "municipal_minutes"
- **region** - Province (e.g., "Nova Scotia")
- **country** - Always "Canada"
- **meeting_url** - Direct link to the specific meeting minutes
- **calendar_url** - Link to municipality's meeting calendar
- **meeting_date** - Date of the meeting (YYYY-MM-DD)
- **committee_name** - Which committee/council (e.g., "Regional Council")
- **agenda_item** - Item number (e.g., "9.1", "15.3.2")
- **excerpt** - Actual quote from the minutes showing this opportunity
- **ai_confidence** - 0-100 score of how confident AI is

## Viewing Full Details

Click on any RFP title to view:
- Full description
- Complete excerpt from meeting minutes
- Clickable link to original meeting
- All metadata fields

## Tips

1. **Start broad, then narrow**: Begin with Source="Municipal Minutes", then add filters
2. **Use confidence wisely**: 70%+ is good for discovery, 80%+ for qualified leads
3. **Combine filters**: Source + Region + Confidence gives very targeted results
4. **Check excerpts**: Click into RFPs to read the actual quote from minutes
5. **Follow links**: Click the meeting URL to view the original source

## API Filtering

If using the API directly, you can filter with URL parameters:

```
GET /api/projects/[slug]/rfps?source=municipal_minutes&region=Nova%20Scotia&minConfidence=80
```

Parameters:
- `source` - Filter by source (municipal_minutes, epa, etc.)
- `region` - Filter by province
- `committee` - Filter by committee name
- `minConfidence` - Minimum AI confidence (0-100)
