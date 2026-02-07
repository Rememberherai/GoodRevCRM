import { getOpenRouterClient } from '../openrouter/client';
import type { ExtractedRfp } from './types';
import { SCANNER_CONFIG } from './config';

const EXTRACTION_PROMPT = `You are analyzing municipal meeting minutes to identify waste/water business opportunities related to:
- Waste management (solid waste, recycling, composting, landfills, waste collection)
- Water treatment (drinking water, water infrastructure, water quality, distribution systems)
- Wastewater treatment (sewage, WWTP, collection systems, stormwater, pumping stations)

Extract ANY of the following:
1. **Formal RFPs/Bids**: Request for Proposal, bid opportunity, tender, procurement
2. **Project Discussions**: Planned projects, infrastructure upgrades, capital projects being considered
3. **Needs/Problems**: Issues mentioned that may lead to contracts (aging infrastructure, capacity problems, regulatory requirements)
4. **Budget Approvals**: Approved funding for waste/water projects
5. **Consultant Hiring**: Discussions about hiring engineers, consultants for waste/water studies
6. **Service Contract Renewals**: Expiring contracts that will need rebidding

For each opportunity found, extract:
- Title/Project Name
- Description of what's being discussed/planned/procured
- Timeline or due date (if mentioned)
- Estimated value or budget (if mentioned)
- Current status (proposed/approved/RFP issued/under study)
- Submission method and contact (if an active RFP)
- Meeting date (if visible in the minutes)
- Committee/Council name (e.g., "Regional Council", "Public Works Committee")
- Agenda item number (if mentioned, e.g., "Item 15.1.3")
- A brief excerpt/quote from the minutes showing this opportunity

Include opportunities that are:
- Currently active (RFPs, tenders open now)
- Upcoming/planned (projects approved but RFP not yet issued)
- Under discussion (projects being studied/considered for next year)
- DO NOT include completed historical projects

CRITICAL: Return ONLY valid JSON, no explanatory text before or after.

Return this exact structure:
{
  "rfps": [
    {
      "title": "string (required)",
      "description": "string - detailed description of project/opportunity (required)",
      "due_date": "YYYY-MM-DD or null",
      "estimated_value": number_or_null,
      "currency": "CAD or null",
      "submission_method": "email|portal|physical|other|null",
      "contact_email": "email@example.com or null",
      "confidence": number_0_to_100,
      "opportunity_type": "formal_rfp|project_discussion|planning_stage (required)",
      "meeting_date": "YYYY-MM-DD or null",
      "committee_name": "string or null",
      "agenda_item": "string or null",
      "excerpt": "string - brief relevant quote from minutes or null"
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
        temperature: 0.3,
        responseFormat: 'json_object',
        maxTokens: 4096,
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
    const validRfps = result.rfps.filter((rfp: ExtractedRfp) => {
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
