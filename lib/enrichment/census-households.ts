/**
 * Census Household Count Enrichment
 * Fetches total household counts from US Census Bureau ACS 5-year estimates
 * Supports both municipality (place) and ZIP code (ZCTA) lookups
 */

import { z } from 'zod';

// Re-use the same STATE_FIPS and helpers from census-growth.ts
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

export interface HouseholdCountResult {
  name: string;
  households: number;
}

const censusResponseSchema = z.array(z.array(z.string()));

// Cache for state-level place household data
const placeHouseholdCache: Map<string, { data: HouseholdCountResult[]; fetchedAt: Date }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStateAbbreviation(state: string): string {
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREVIATIONS[state] || state;
}

function getStateFips(state: string): string | null {
  const abbr = getStateAbbreviation(state);
  return STATE_FIPS[abbr] || null;
}

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/^city of\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getApiKey(projectId?: string): Promise<string | null> {
  let apiKey: string | null = null;
  if (projectId) {
    const { getProjectSecret } = await import('@/lib/secrets');
    apiKey = await getProjectSecret(projectId, 'census_api_key');
  }
  if (!apiKey) apiKey = process.env.CENSUS_API_KEY || null;
  return apiKey;
}

/**
 * Fetch household counts for all places in a state
 * Uses ACS 5-year B11001_001E (total households)
 */
async function fetchStatePlaceHouseholds(
  stateFips: string,
  projectId?: string
): Promise<HouseholdCountResult[]> {
  const cacheKey = `households-place-${stateFips}`;
  const cached = placeHouseholdCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = await getApiKey(projectId);
  const keyParam = apiKey ? `&key=${apiKey}` : '';
  const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B11001_001E&for=place:*&in=state:${stateFips}${keyParam}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Census Households] API error for state ${stateFips}:`, response.status);
      return [];
    }

    const data = await response.json();
    const parsed = censusResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('[Census Households] Invalid response format:', parsed.error);
      return [];
    }

    const rows = parsed.data.slice(1); // Skip header row
    const entries: HouseholdCountResult[] = rows.map(row => ({
      name: row[0] || '',
      households: parseInt(row[1] || '0', 10) || 0,
    }));

    placeHouseholdCache.set(cacheKey, { data: entries, fetchedAt: new Date() });
    return entries;
  } catch (error) {
    console.error(`[Census Households] Failed to fetch place data for state ${stateFips}:`, error);
    return [];
  }
}

function findBestPlaceMatch(entries: HouseholdCountResult[], targetCity: string): HouseholdCountResult | null {
  const normalizedTarget = normalizeCity(targetCity);

  let bestMatch: HouseholdCountResult | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    const placePart = entry.name.split(',')[0] || '';
    const normalizedPlace = normalizeCity(
      placePart.replace(/\s+(city|town|village|borough|CDP|municipality)$/i, '')
    );

    if (normalizedPlace === normalizedTarget) {
      return entry;
    }

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
 * Fetch household count for a municipality (city + state)
 */
export async function fetchHouseholdsByPlace(
  city: string,
  state: string,
  projectId?: string
): Promise<HouseholdCountResult | null> {
  const stateFips = getStateFips(state);
  if (!stateFips) {
    console.error(`[Census Households] Unknown state: ${state}`);
    return null;
  }

  const entries = await fetchStatePlaceHouseholds(stateFips, projectId);
  return findBestPlaceMatch(entries, city);
}

/**
 * Fetch household counts for multiple municipalities
 */
export async function fetchHouseholdsByPlaces(
  municipalities: Array<{ city: string; state: string }>,
  projectId?: string
): Promise<HouseholdCountResult[]> {
  const results: HouseholdCountResult[] = [];

  // Group by state to minimize API calls
  const byState = new Map<string, string[]>();
  for (const { city, state } of municipalities) {
    const abbr = getStateAbbreviation(state);
    const cities = byState.get(abbr) || [];
    cities.push(city);
    byState.set(abbr, cities);
  }

  for (const [stateAbbr, cities] of byState) {
    for (const city of cities) {
      const result = await fetchHouseholdsByPlace(city, stateAbbr, projectId);
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Fetch household counts by ZIP codes (ZCTAs)
 */
export async function fetchHouseholdsByZipCodes(
  zipCodes: string[],
  projectId?: string
): Promise<HouseholdCountResult[]> {
  if (zipCodes.length === 0) return [];

  const apiKey = await getApiKey(projectId);
  const keyParam = apiKey ? `&key=${apiKey}` : '';

  // Census API allows querying multiple ZCTAs at once
  const zctas = zipCodes.join(',');
  const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B11001_001E&for=zip%20code%20tabulation%20area:${zctas}${keyParam}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Census Households] ZCTA API error:`, response.status);
      return [];
    }

    const data = await response.json();
    const parsed = censusResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('[Census Households] Invalid ZCTA response format:', parsed.error);
      return [];
    }

    const rows = parsed.data.slice(1);
    return rows.map(row => ({
      name: row[0] || '',
      households: parseInt(row[1] || '0', 10) || 0,
    }));
  } catch (error) {
    console.error('[Census Households] Failed to fetch ZCTA data:', error);
    return [];
  }
}
