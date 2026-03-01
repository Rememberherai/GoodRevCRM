/**
 * AI-Powered Research Enrichment
 * Uses Grok with web search to fill gaps in structured data sources
 */

import { z } from 'zod';
import { getOpenRouterClient } from '../openrouter/client';
import type { CapacityData } from './epa-capacity';
import type { PopulationGrowthData } from './census-growth';
import type { BondHistoryData, ReferendumInfo } from './emma-bonds';

// Response schema for AI research
const aiResearchResponseSchema = z.object({
  capacity: z.object({
    design_mgd: z.number().nullable().optional(),
    actual_mgd: z.number().nullable().optional(),
    utilization_pct: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).nullable().optional(),
  infrastructure: z.object({
    built_year: z.number().nullable().optional(),
    last_upgrade_year: z.number().nullable().optional(),
    age_years: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).nullable().optional(),
  population_growth: z.object({
    rate_pct: z.number().nullable().optional(),
    period: z.string().nullable().optional(),
    population_current: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).nullable().optional(),
  bond_history: z.object({
    attempted: z.boolean().nullable().optional(),
    year: z.number().nullable().optional(),
    amount: z.number().nullable().optional(),
    result: z.enum(['passed', 'failed', 'unknown']).nullable().optional(),
    description: z.string().nullable().optional(),
  }).nullable().optional(),
  sources: z.array(z.string()).optional(),
});

export type AIResearchResponse = z.infer<typeof aiResearchResponseSchema>;

export interface InfrastructureData {
  built_year: number | null;
  last_upgrade_year: number | null;
  age_years: number | null;
  notes: string | null;
  source: 'ai_research';
  fetched_at: string;
}

const RESEARCH_PROMPT = `You are a municipal infrastructure researcher. Search the web and provide accurate data about the wastewater treatment facility for the specified municipality.

IMPORTANT: Only return data you can verify from reliable sources. If you cannot find specific information, return null for that field.

Research the following for {CITY}, {REGION}:

1. CAPACITY (if requested):
   - Design capacity in MGD (Million Gallons per Day)
   - Current actual daily flow in MGD
   - Calculate utilization percentage if both values available

2. INFRASTRUCTURE AGE (if requested):
   - Year the WWTP was originally built/commissioned
   - Year of last major upgrade or expansion
   - Calculate current age in years

3. POPULATION GROWTH (if requested):
   - Population growth rate over past 5-10 years
   - Specify the time period for the growth rate
   - Current population if available

4. BOND HISTORY (if requested):
   - Has the municipality held a bond referendum for water/sewer infrastructure?
   - What year was the most recent bond referendum?
   - What was the bond amount?
   - Did it pass or fail?

Return ONLY valid JSON in this exact format:
{
  "capacity": {
    "design_mgd": <number or null>,
    "actual_mgd": <number or null>,
    "utilization_pct": <number or null>,
    "notes": "<string or null>"
  },
  "infrastructure": {
    "built_year": <number or null>,
    "last_upgrade_year": <number or null>,
    "age_years": <number or null>,
    "notes": "<string or null>"
  },
  "population_growth": {
    "rate_pct": <number or null>,
    "period": "<string like '2015-2023' or null>",
    "population_current": <number or null>,
    "notes": "<string or null>"
  },
  "bond_history": {
    "attempted": <boolean or null>,
    "year": <number or null>,
    "amount": <number or null>,
    "result": "<'passed', 'failed', or 'unknown' or null>",
    "description": "<string or null>"
  },
  "sources": ["<URL or source name>", ...]
}`;

interface ResearchOptions {
  includeCapacity?: boolean;
  includeInfrastructure?: boolean;
  includePopulation?: boolean;
  includeBonds?: boolean;
}

/**
 * Research municipality data using AI with web search
 */
export async function aiResearchMunicipality(
  city: string,
  region: string,
  country: string,
  options: ResearchOptions = {}
): Promise<AIResearchResponse | null> {
  const {
    includeCapacity = true,
    includeInfrastructure = true,
    includePopulation = true,
    includeBonds = true,
  } = options;

  // Build specific research request
  const researchAreas: string[] = [];
  if (includeCapacity) researchAreas.push('CAPACITY');
  if (includeInfrastructure) researchAreas.push('INFRASTRUCTURE AGE');
  if (includePopulation) researchAreas.push('POPULATION GROWTH');
  if (includeBonds) researchAreas.push('BOND HISTORY');

  if (researchAreas.length === 0) {
    return null;
  }

  const prompt = RESEARCH_PROMPT
    .replace('{CITY}', city)
    .replace('{REGION}', `${region}, ${country}`)
    + `\n\nFocus on: ${researchAreas.join(', ')}`;

  try {
    const client = getOpenRouterClient();
    const response = await client.chat(
      [{ role: 'user', content: prompt }],
      {
        model: 'x-ai/grok-4.1-fast', // Grok with web search capability
        temperature: 0.1,
        responseFormat: 'json_object',
        maxTokens: 2048,
      }
    );

    const content = response.choices[0]?.message?.content || '{}';

    // Parse JSON response
    let parsed: unknown;
    try {
      // Try to extract JSON from response (in case of markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error('[AI Research] Failed to parse JSON:', content.substring(0, 200));
      return null;
    }

    const result = aiResearchResponseSchema.safeParse(parsed);
    if (!result.success) {
      console.error('[AI Research] Invalid response schema:', result.error);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error(`[AI Research] Error researching ${city}, ${region}:`, error);
    return null;
  }
}

/**
 * Research capacity data via AI (for Canadian municipalities or EPA gaps)
 */
export async function aiResearchCapacity(
  city: string,
  region: string,
  country: string
): Promise<CapacityData | null> {
  const research = await aiResearchMunicipality(city, region, country, {
    includeCapacity: true,
    includeInfrastructure: false,
    includePopulation: false,
    includeBonds: false,
  });

  if (!research?.capacity) {
    return null;
  }

  const { design_mgd, actual_mgd, utilization_pct } = research.capacity;

  // Calculate utilization if we have both values but not the percentage
  let utilization = utilization_pct ?? null;
  if (!utilization && design_mgd && actual_mgd && design_mgd > 0) {
    utilization = Math.round((actual_mgd / design_mgd) * 100);
  }

  return {
    design_mgd: design_mgd ?? null,
    actual_mgd: actual_mgd ?? null,
    utilization_pct: utilization,
    source: 'ai_research',
    facility_name: null,
    permit_id: null,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Research infrastructure age via AI
 */
export async function aiResearchInfrastructure(
  city: string,
  region: string,
  country: string
): Promise<InfrastructureData | null> {
  const research = await aiResearchMunicipality(city, region, country, {
    includeCapacity: false,
    includeInfrastructure: true,
    includePopulation: false,
    includeBonds: false,
  });

  if (!research?.infrastructure) {
    return null;
  }

  const { built_year, last_upgrade_year, age_years, notes } = research.infrastructure;

  // Calculate age if we have built year but not age
  let age = age_years ?? null;
  if (!age && built_year) {
    age = new Date().getFullYear() - built_year;
  }

  return {
    built_year: built_year ?? null,
    last_upgrade_year: last_upgrade_year ?? null,
    age_years: age,
    notes: notes ?? null,
    source: 'ai_research',
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Research population growth via AI (for Canadian municipalities)
 */
export async function aiResearchPopulationGrowth(
  city: string,
  region: string,
  country: string
): Promise<PopulationGrowthData | null> {
  const research = await aiResearchMunicipality(city, region, country, {
    includeCapacity: false,
    includeInfrastructure: false,
    includePopulation: true,
    includeBonds: false,
  });

  if (!research?.population_growth) {
    return null;
  }

  const { rate_pct, period, population_current } = research.population_growth;

  return {
    rate_pct: rate_pct ?? null,
    period: period ?? 'unknown',
    population_start: null,
    population_end: population_current ?? null,
    source: 'ai_research',
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Research bond history via AI
 */
export async function aiResearchBonds(
  city: string,
  region: string,
  country: string
): Promise<BondHistoryData | null> {
  const research = await aiResearchMunicipality(city, region, country, {
    includeCapacity: false,
    includeInfrastructure: false,
    includePopulation: false,
    includeBonds: true,
  });

  if (!research?.bond_history) {
    return null;
  }

  const { attempted, year, amount, result, description } = research.bond_history;

  const referendumInfo: ReferendumInfo | null = attempted ? {
    year: year ?? null,
    amount: amount ?? null,
    result: result ?? null,
    description: description ?? null,
  } : null;

  return {
    attempted: attempted ?? false,
    bonds_found: attempted ? 1 : 0,
    recent_bonds: [],
    referendum_info: referendumInfo,
    source: 'ai_research',
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Research all data points at once (more efficient single API call)
 */
export async function aiResearchAll(
  city: string,
  region: string,
  country: string
): Promise<{
  capacity: CapacityData | null;
  infrastructure: InfrastructureData | null;
  populationGrowth: PopulationGrowthData | null;
  bonds: BondHistoryData | null;
  sources: string[];
}> {
  const research = await aiResearchMunicipality(city, region, country, {
    includeCapacity: true,
    includeInfrastructure: true,
    includePopulation: true,
    includeBonds: true,
  });

  const timestamp = new Date().toISOString();

  // Parse capacity
  let capacity: CapacityData | null = null;
  if (research?.capacity) {
    const { design_mgd, actual_mgd, utilization_pct } = research.capacity;
    let utilization = utilization_pct ?? null;
    if (!utilization && design_mgd && actual_mgd && design_mgd > 0) {
      utilization = Math.round((actual_mgd / design_mgd) * 100);
    }
    capacity = {
      design_mgd: design_mgd ?? null,
      actual_mgd: actual_mgd ?? null,
      utilization_pct: utilization,
      source: 'ai_research',
      facility_name: null,
      permit_id: null,
      fetched_at: timestamp,
    };
  }

  // Parse infrastructure
  let infrastructure: InfrastructureData | null = null;
  if (research?.infrastructure) {
    const { built_year, last_upgrade_year, age_years, notes } = research.infrastructure;
    let age = age_years ?? null;
    if (!age && built_year) {
      age = new Date().getFullYear() - built_year;
    }
    infrastructure = {
      built_year: built_year ?? null,
      last_upgrade_year: last_upgrade_year ?? null,
      age_years: age,
      notes: notes ?? null,
      source: 'ai_research',
      fetched_at: timestamp,
    };
  }

  // Parse population growth
  let populationGrowth: PopulationGrowthData | null = null;
  if (research?.population_growth) {
    const { rate_pct, period, population_current } = research.population_growth;
    populationGrowth = {
      rate_pct: rate_pct ?? null,
      period: period ?? 'unknown',
      population_start: null,
      population_end: population_current ?? null,
      source: 'ai_research',
      fetched_at: timestamp,
    };
  }

  // Parse bonds
  let bonds: BondHistoryData | null = null;
  if (research?.bond_history) {
    const { attempted, year, amount, result, description } = research.bond_history;
    const referendumInfo: ReferendumInfo | null = attempted ? {
      year: year ?? null,
      amount: amount ?? null,
      result: result ?? null,
      description: description ?? null,
    } : null;
    bonds = {
      attempted: attempted ?? false,
      bonds_found: attempted ? 1 : 0,
      recent_bonds: [],
      referendum_info: referendumInfo,
      source: 'ai_research',
      fetched_at: timestamp,
    };
  }

  return {
    capacity,
    infrastructure,
    populationGrowth,
    bonds,
    sources: research?.sources || [],
  };
}
