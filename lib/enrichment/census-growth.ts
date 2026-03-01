/**
 * Census Population Growth Enrichment
 * Fetches population data from US Census Bureau and Statistics Canada
 */

import { z } from 'zod';

export interface PopulationGrowthData {
  rate_pct: number | null;
  period: string;
  population_start: number | null;
  population_end: number | null;
  source: 'us_census' | 'statcan' | 'ai_research';
  fetched_at: string;
}

// State name to FIPS code mapping
const STATE_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56',
};

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC',
};

function getStateAbbreviation(state: string): string {
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREVIATIONS[state] || state;
}

function getStateFips(state: string): string | null {
  const abbr = getStateAbbreviation(state);
  return STATE_FIPS[abbr] || null;
}

// Normalize city name for matching
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Census API response schema (returns arrays)
const censusResponseSchema = z.array(z.array(z.string()));

// Cache for state population data
interface PopulationEntry {
  name: string;
  population: number;
}
const statePopCache: Map<string, { data: PopulationEntry[]; year: number; fetchedAt: Date }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch population data for all places in a state from US Census
 * Uses ACS 5-year estimates for better coverage of smaller places
 */
async function fetchStatePlacePopulations(
  stateFips: string,
  year: number
): Promise<PopulationEntry[]> {
  const cacheKey = `${stateFips}-${year}`;
  const cached = statePopCache.get(cacheKey);

  if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return cached.data;
  }

  // B01001_001E is total population
  // NAME gives us the place name
  const apiKey = process.env.CENSUS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : '';

  const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME,B01001_001E&for=place:*&in=state:${stateFips}${keyParam}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Census] API error for state ${stateFips}, year ${year}:`, response.status);
      return [];
    }

    const data = await response.json();
    const parsed = censusResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('[Census] Invalid response format:', parsed.error);
      return [];
    }

    // First row is headers: ["NAME", "B01001_001E", "state", "place"]
    const rows = parsed.data.slice(1);
    const entries: PopulationEntry[] = rows.map(row => ({
      name: row[0] || '',
      population: parseInt(row[1] || '0', 10) || 0,
    }));

    statePopCache.set(cacheKey, { data: entries, year, fetchedAt: new Date() });
    return entries;
  } catch (error) {
    console.error(`[Census] Failed to fetch data for state ${stateFips}:`, error);
    return [];
  }
}

/**
 * Find best matching place from Census data
 */
function findBestMatch(entries: PopulationEntry[], targetCity: string): PopulationEntry | null {
  const normalizedTarget = normalizeCity(targetCity);

  // Census names include state, e.g., "Springfield city, Illinois"
  let bestMatch: PopulationEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    // Extract city name before comma and remove " city", " town", etc.
    const placePart = entry.name.split(',')[0] || '';
    const normalizedPlace = normalizeCity(
      placePart.replace(/\s+(city|town|village|borough|CDP|municipality)$/i, '')
    );

    // Exact match
    if (normalizedPlace === normalizedTarget) {
      return entry;
    }

    // Partial match scoring
    let score = 0;
    if (normalizedPlace.includes(normalizedTarget) || normalizedTarget.includes(normalizedPlace)) {
      score = 80;
    } else {
      const targetWords = normalizedTarget.split(' ');
      const placeWords = normalizedPlace.split(' ');
      const matchingWords = targetWords.filter(w => placeWords.includes(w));
      if (matchingWords.length > 0) {
        score = 50 + (matchingWords.length / targetWords.length) * 30;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

/**
 * Get population growth rate for a US city
 * Compares 2019 ACS 5-year vs 2023 ACS 5-year estimates
 */
export async function getCensusGrowth(
  city: string,
  state: string
): Promise<PopulationGrowthData | null> {
  const stateFips = getStateFips(state);
  if (!stateFips) {
    console.error(`[Census] Unknown state: ${state}`);
    return null;
  }

  // Fetch both years
  const [pop2019, pop2023] = await Promise.all([
    fetchStatePlacePopulations(stateFips, 2019),
    fetchStatePlacePopulations(stateFips, 2023),
  ]);

  // Find matching place in both years
  const match2019 = findBestMatch(pop2019, city);
  const match2023 = findBestMatch(pop2023, city);

  if (!match2019 || !match2023) {
    return null;
  }

  // Calculate growth rate (simple percentage change)
  let ratePct: number | null = null;
  if (match2019.population > 0) {
    const change = match2023.population - match2019.population;
    ratePct = Math.round((change / match2019.population) * 1000) / 10; // One decimal place
  }

  return {
    rate_pct: ratePct,
    period: '2019-2023',
    population_start: match2019.population,
    population_end: match2023.population,
    source: 'us_census',
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Get population growth for a Canadian city from Statistics Canada
 * Uses 2016 and 2021 Census data
 */
export async function getStatCanGrowth(
  _city: string,
  _province: string
): Promise<PopulationGrowthData | null> {
  // Statistics Canada API is complex and requires specific geo codes
  // For now, return null and let AI research handle it
  // TODO: Implement StatCan integration if needed

  // The StatCan Web Data Service requires:
  // 1. Finding the Census Subdivision (CSD) code for the city
  // 2. Querying the Census Profile tables for population

  // This is more complex than US Census API, so we'll use AI research
  // for Canadian population growth data initially

  return null;
}

/**
 * Batch fetch growth data for multiple US cities
 */
export async function batchGetCensusGrowth(
  citiesWithState: Array<{ city: string; state: string }>
): Promise<Map<string, PopulationGrowthData | null>> {
  const results = new Map<string, PopulationGrowthData | null>();

  // Group by state to minimize API calls
  const byState = new Map<string, string[]>();
  for (const { city, state } of citiesWithState) {
    const abbr = getStateAbbreviation(state);
    const cities = byState.get(abbr) || [];
    cities.push(city);
    byState.set(abbr, cities);
  }

  // Fetch each state
  for (const [stateAbbr, cities] of byState) {
    for (const city of cities) {
      const key = `${city}, ${stateAbbr}`;
      const growth = await getCensusGrowth(city, stateAbbr);
      results.set(key, growth);
    }
  }

  return results;
}
