/**
 * EPA ECHO Capacity Enrichment
 * Fetches design and actual flow (MGD) for US wastewater treatment facilities
 */

import { getEPAEchoClient, type EPAFacility } from '../epa-echo/client';

export interface CapacityData {
  design_mgd: number | null;
  actual_mgd: number | null;
  utilization_pct: number | null;
  source: 'epa_echo' | 'ai_research';
  facility_name: string | null;
  permit_id: string | null;
  fetched_at: string;
}

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
  // Already an abbreviation
  if (state.length === 2) {
    return state.toUpperCase();
  }
  return STATE_ABBREVIATIONS[state] || state;
}

// Normalize city name for matching
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score how well a facility matches a city
function scoreFacilityMatch(facility: EPAFacility, targetCity: string): number {
  const facilityCity = normalizeCity(facility.city || '');
  const facilityName = normalizeCity(facility.name || '');
  const target = normalizeCity(targetCity);

  // Exact city match
  if (facilityCity === target) {
    return 100;
  }

  // City is contained in facility city (e.g., "Springfield" in "City of Springfield")
  if (facilityCity.includes(target) || target.includes(facilityCity)) {
    return 80;
  }

  // City name in facility name
  if (facilityName.includes(target)) {
    return 70;
  }

  // Partial match using words
  const targetWords = target.split(' ');
  const cityWords = facilityCity.split(' ');
  const matchingWords = targetWords.filter(w => cityWords.includes(w));
  if (matchingWords.length > 0) {
    return 50 + (matchingWords.length / targetWords.length) * 30;
  }

  return 0;
}

// Cache for state facility lists (to avoid repeated API calls)
const stateCache: Map<string, { facilities: EPAFacility[]; fetchedAt: Date }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get capacity data for a US municipality from EPA ECHO
 */
export async function getEpaCapacity(
  city: string,
  state: string
): Promise<CapacityData | null> {
  const stateAbbr = getStateAbbreviation(state);

  // Check cache
  const cached = stateCache.get(stateAbbr);
  let facilities: EPAFacility[];

  if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    facilities = cached.facilities;
  } else {
    // Fetch all facilities for this state
    const client = getEPAEchoClient();
    try {
      facilities = await client.fetchAllFacilities(
        { state: stateAbbr },
        500 // Get up to 500 facilities per state
      );
      stateCache.set(stateAbbr, { facilities, fetchedAt: new Date() });
    } catch (error) {
      console.error(`[EPA] Failed to fetch facilities for ${stateAbbr}:`, error);
      return null;
    }
  }

  // Find best matching facility
  let bestMatch: EPAFacility | null = null;
  let bestScore = 0;

  for (const facility of facilities) {
    const score = scoreFacilityMatch(facility, city);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = facility;
    }
  }

  // Require a reasonable match score
  if (!bestMatch || bestScore < 50) {
    return null;
  }

  // Calculate utilization
  let utilizationPct: number | null = null;
  if (bestMatch.design_flow_mgd && bestMatch.actual_flow_mgd && bestMatch.design_flow_mgd > 0) {
    utilizationPct = Math.round((bestMatch.actual_flow_mgd / bestMatch.design_flow_mgd) * 100);
  }

  return {
    design_mgd: bestMatch.design_flow_mgd,
    actual_mgd: bestMatch.actual_flow_mgd,
    utilization_pct: utilizationPct,
    source: 'epa_echo',
    facility_name: bestMatch.name,
    permit_id: bestMatch.permit_id,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Batch fetch capacity for multiple cities in the same state
 * More efficient as it reuses the cached state data
 */
export async function batchGetEpaCapacity(
  citiesWithState: Array<{ city: string; state: string }>
): Promise<Map<string, CapacityData | null>> {
  const results = new Map<string, CapacityData | null>();

  for (const { city, state } of citiesWithState) {
    const key = `${city}, ${state}`;
    const capacity = await getEpaCapacity(city, state);
    results.set(key, capacity);
  }

  return results;
}
