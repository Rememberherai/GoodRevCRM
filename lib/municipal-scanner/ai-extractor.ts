import { getOpenRouterClient } from '../openrouter/client';
import type { ExtractedRfp } from './types';
import { SCANNER_CONFIG } from './config';

const EXTRACTION_PROMPT = `You are analyzing municipal meeting minutes to identify wastewater TREATMENT PLANT technology opportunities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELEVANCE FILTER — TREATMENT PLANT TECHNOLOGY ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Our company provides treatment process technology for wastewater treatment plants (WWTPs).
We are ONLY interested in projects where treatment plant process equipment or technology is involved.

🎯 HIGH-RELEVANCE (extract these — our core fit):
- WWTP upgrades, expansions, or new construction involving treatment processes
- Aeration system improvements (blowers, diffusers, aeration basins)
- Filtration systems (tertiary filters, membrane bioreactors, disc filters)
- Disinfection upgrades (UV, ozone, chlorination systems)
- Sludge/biosolids handling (dewatering, thickening, digestion, drying)
- Secondary treatment upgrades (clarifiers, SBRs, oxidation ditches, activated sludge)
- Nutrient removal (phosphorus, nitrogen, ammonia removal systems)
- Instrumentation & controls (SCADA, PLC upgrades, process automation AT treatment plants)
- Water reclamation/reuse treatment systems
- Industrial wastewater pretreatment systems

⚠️ LOW-RELEVANCE (extract but tag as "low_relevance"):
- Drinking water treatment plant upgrades
- Pump station upgrades AT a treatment plant
- Engineering studies/PERs for treatment plant improvements
- Solid waste facility process equipment

🚫 DO NOT EXTRACT (not our market):
- Sanitary sewer line repair, rehabilitation, or replacement (I&I projects, CIPP lining, pipe bursting)
- Stormwater infrastructure (retention basins, detention ponds, storm drains, culverts, swales)
- Water main construction, replacement, or extension
- Collection system work (sewer mains, manholes, sewer extensions)
- Pump station construction that is NOT at a treatment plant (lift stations, booster stations)
- Road, bridge, or general civil construction
- Hydraulic modeling or flow monitoring studies (unless directly tied to a WWTP upgrade)
- Landfill construction or capping (unless involving leachate treatment)
- Routine chemical supply contracts (hypochlorite, lime, sulfate, coagulants, etc.)
- Low-value operational supplies under $50,000 CAD
- Maintenance contracts for existing equipment
- Annual service agreements
- Routine laboratory testing services
- Utility billing or administrative services
- Office supplies or non-technical items

WHAT TO EXTRACT - TREATMENT PLANT CAPITAL PROJECTS ONLY:

✅ INCLUDE:
1. Formal RFPs/Bids - active procurement for treatment plant capital projects
2. Project Discussions - approved WWTP projects, upcoming RFPs for plant upgrades
3. Budget Approvals - funded treatment plant projects (upgrades, expansions, new processes)
4. Consultant Hiring - engineering studies for treatment plant improvements
5. Operational Challenges - plant performance issues requiring process upgrades or new equipment
6. Compliance Issues - effluent violations requiring treatment process investment
7. Technology Implementations - new treatment systems, process equipment, SCADA at plants

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION REQUIREMENTS - MAXIMUM DATA CAPTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**TITLE** (be extremely specific):
✓ Include facility name + location + project type
✓ Examples: "North WWTP Phosphorus Removal Upgrade", "Industrial Park Water Main Extension - Phase 2", "East End Lift Station #4 Replacement"
✗ Bad: "WWTP Upgrade", "Infrastructure Project"

**DESCRIPTION** (5-10+ sentences - CRITICAL FIELD):
Extract EVERYTHING. Include ALL of:

1. PROBLEM STATEMENT (what's broken/failing/violated):
   - What specific issue exists
   - Current performance numbers vs. requirements
   - Violations, failures, complaints

2. TECHNICAL DATA (capture EVERY number mentioned):
   - Flow rates: ML/day, MGD, m³/day, L/s
   - Capacity: design vs actual, hydraulic vs organic
   - Contaminant levels: current vs limits
     * Phosphorus (TP), Nitrogen (TN), Ammonia (NH3-N)
     * BOD, TSS, COD
     * E. coli, turbidity, pH
     * Any other parameters
   - Population served (current and projected)
   - Age of infrastructure
   - Treatment processes currently in place

3. REGULATORY CONTEXT:
   - What regulation/permit/order is driving this
   - Compliance deadline
   - Regulatory agency (Ministry, EPA, etc.)
   - Certificate of Approval conditions

4. FACILITY DETAILS:
   - Plant capacity and service area
   - Existing treatment processes
   - Proposed technology/solution
   - Alternatives being considered

5. PROJECT SCOPE & TIMELINE:
   - Construction phases
   - Project timeline mentioned
   - Related work or dependencies

6. BUSINESS CONTEXT:
   - Budget/cost mentioned
   - Urgency level
   - Operational constraints
   - Stakeholder concerns

**OTHER CRITICAL FIELDS** (extract if present):
- Meeting date (YYYY-MM-DD) - look in headers, footers, document title
- Committee name (full official name)
- Agenda item number (e.g., "15.1.3", "Report PW-2024-05")
- Due date for RFP submissions
- Budget/estimated value (extract ANY dollar amount)
- Contact information (emails, phone numbers, staff names)
- Consultant/engineering firms mentioned
- Document references (report numbers, study names)
- Website URLs or portal links mentioned

**EXCERPT** (200-500+ words for complex items):
- Include the COMPLETE relevant section(s)
- Don't truncate or summarize
- Include ALL technical data and numbers
- Include discussion context (who spoke, motions, votes)
- If discussion spans multiple agenda items, include all
- Preserve exact wording for compliance/regulatory language

Include opportunities that are:
- Currently active (RFPs, tenders open now)
- Upcoming/planned (projects approved but RFP not yet issued)
- Under discussion (projects being studied/considered for next year)
- DO NOT include completed historical projects
- DO NOT include routine supply contracts or low-value operational items

MINIMUM VALUE THRESHOLD:
- Only extract opportunities with estimated value ≥ $50,000 CAD OR
- Clear indication this is a capital/infrastructure project (even if value not specified)
- Skip routine chemical supplies, maintenance contracts, and operational consumables

CRITICAL: Return ONLY valid JSON, no explanatory text before or after.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return this exact structure:
{
  "rfps": [
    {
      "title": "Facility Name + Location + Project Type (specific, detailed)",
      "description": "5-10+ sentences covering: (1) Problem statement with current vs required performance numbers, (2) ALL technical data - flows, capacities, contaminant levels, population served, infrastructure age, (3) Regulatory context - what regulation/permit/deadline, (4) Facility details - capacity, existing processes, proposed technology, (5) Project scope and timeline, (6) Business context - budget, urgency, constraints. Include EVERY number and specification mentioned.",
      "due_date": "YYYY-MM-DD or null",
      "estimated_value": number_or_null,
      "currency": "CAD or null",
      "submission_method": "email|portal|physical|other|null",
      "contact_email": "email@example.com or null",
      "confidence": number_0_to_100,
      "relevance": "high|low (high = WWTP process/treatment technology fit, low = related but not core treatment plant work)",
      "opportunity_type": "formal_rfp|project_discussion|planning_stage (required)",
      "meeting_date": "YYYY-MM-DD (extract from document - CRITICAL) or null",
      "committee_name": "Full official committee name or null",
      "agenda_item": "Item number/report number (e.g., 15.1.3, Report PW-2024-05) or null",
      "excerpt": "COMPLETE relevant section 200-500+ words - include ALL context, technical details, discussion, motions. Do NOT truncate or summarize."
    }
  ]
}

Opportunity Types:
- "formal_rfp": Active RFP/tender/bid with submission deadline
- "project_discussion": Approved project being discussed, RFP coming soon
- "planning_stage": Project being considered/studied, may lead to RFP later

If no opportunities found, return: {"rfps": []}

DO NOT include any text outside the JSON structure.`;

export async function extractRfpsFromMinutes(
  minutesText: string,
  municipalityName: string,
  province: string
): Promise<ExtractedRfp[]> {
  // Truncate if too long
  const maxChars = SCANNER_CONFIG.chunkSizeTokens * 4; // Rough estimate: 1 token ≈ 4 chars
  const truncatedText = minutesText.substring(0, maxChars);

  const prompt = `${EXTRACTION_PROMPT}

Municipality: ${municipalityName}, ${province}

Meeting Minutes Text:
${truncatedText}`;

  try {
    const openrouter = getOpenRouterClient();
    const response = await openrouter.chat(
      [{ role: 'user', content: prompt }],
      {
        model: 'x-ai/grok-4.1-fast',
        temperature: 0.2, // Lower temperature for more consistent extraction
        responseFormat: 'json_object',
        maxTokens: 8192, // Increased for comprehensive descriptions and excerpts
      }
    );

    let content = response.choices[0]?.message?.content || '{}';

    // Some models may wrap JSON in markdown code blocks or add explanatory text
    // Try to extract just the JSON part
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    // Try to parse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('AI returned invalid JSON:', content.substring(0, 200));
      return [];
    }

    // Validate structure
    if (!result.rfps || !Array.isArray(result.rfps)) {
      console.error('AI response missing rfps array');
      return [];
    }

    // Filter by confidence threshold and validate required fields
    const validRfps = result.rfps
      .map((rfp: ExtractedRfp) => ({
        ...rfp,
        relevance: rfp.relevance || 'high', // Default to high if AI omits
      }))
      .filter((rfp: ExtractedRfp) => {
        return rfp.confidence >= SCANNER_CONFIG.confidenceThreshold &&
               rfp.title &&
               rfp.description &&
               rfp.opportunity_type &&
               ['formal_rfp', 'project_discussion', 'planning_stage'].includes(rfp.opportunity_type);
      });

    return validRfps;
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

export function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
