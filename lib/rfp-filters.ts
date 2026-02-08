/**
 * RFP Exclusion Keywords - Comprehensive List
 *
 * Based on analysis of 5,931 municipal RFPs from database.
 * See MUNICIPAL_RFP_EXCLUSION_LIST.md for full analysis.
 *
 * These keywords filter out low-value supply contracts, routine maintenance,
 * and operational services to focus on genuine capital project opportunities.
 */

export const RFP_EXCLUSION_KEYWORDS = {
  /**
   * Tier 1: High-Impact Keywords (50+ matches each)
   *
   * These keywords have the highest frequency in low-value RFPs.
   * Total impact: ~3,900 keyword matches in database.
   */
  tier1_highImpact: [
    'replacement',
    'usine', // French: plant/facility
    'program',
    'upgrade',
    'épuration', // French: wastewater treatment
    'waste',
    'collection',
    'study',
    'extension',
    'pumping station',
    'traitement', // French: treatment
    'maintenance',
    'refurbishment',
    'materials',
    'service',
    'inspection',
    'treatment plant',
    'supply',
    'pump',
    'repair',
    'agreement',
    'meters',
    'contract renewal',
    'recycling',
    'bins',
    'lagoon',
    'cleaning',
    'disposal',
  ],

  /**
   * Tier 2: Medium-Impact Keywords (10-49 matches each)
   *
   * Secondary keywords that catch additional low-value RFPs.
   * Total impact: ~700+ additional keyword matches.
   */
  tier2_mediumImpact: [
    'achat', // French: purchase
    'analysis',
    'assessment',
    'annual',
    'meter',
    'valve',
    'monitoring',
    'sulfate',
    'chlorine',
    'testing',
    'parts',
    'audit',
    'training',
    'operator',
    'lift station',
  ],

  /**
   * Tier 3: Chemical Supply Keywords
   *
   * Specific chemicals frequently purchased in routine supply contracts.
   * Total impact: ~72 chemical supply contracts.
   */
  tier3_chemicals: [
    'hypochlorite',
    'alum',
    'aluminum sulfate',
    'coagulant',
    'ferric',
    'polymer',
    'sodium hydroxide',
    'pax', // Polyaluminum chloride
    'lime',
    'phosphate',
  ],
};

/**
 * Combined list of all exclusion keywords
 * Used for "Capital Projects Only" filter mode
 */
export const ALL_EXCLUSION_KEYWORDS: string[] = [
  ...RFP_EXCLUSION_KEYWORDS.tier1_highImpact,
  ...RFP_EXCLUSION_KEYWORDS.tier2_mediumImpact,
  ...RFP_EXCLUSION_KEYWORDS.tier3_chemicals,
];

/**
 * Get keywords for a specific tier
 */
export function getExclusionKeywords(tier: 'tier1' | 'tier2' | 'tier3' | 'all'): string[] {
  switch (tier) {
    case 'tier1':
      return RFP_EXCLUSION_KEYWORDS.tier1_highImpact;
    case 'tier2':
      return RFP_EXCLUSION_KEYWORDS.tier2_mediumImpact;
    case 'tier3':
      return RFP_EXCLUSION_KEYWORDS.tier3_chemicals;
    case 'all':
      return ALL_EXCLUSION_KEYWORDS;
    default:
      return [];
  }
}

/**
 * Check if an RFP title matches any exclusion keywords for a given tier
 *
 * @param title - RFP title to check
 * @param tier - Which tier of keywords to check against
 * @returns true if title contains any matching keyword
 */
export function matchesExclusionKeywords(
  title: string,
  tier: 'tier1' | 'tier2' | 'tier3' | 'all'
): boolean {
  const keywords = getExclusionKeywords(tier);
  const lowerTitle = title.toLowerCase();

  return keywords.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

/**
 * Count how many exclusion keywords match in a title
 * Useful for multi-keyword scoring
 *
 * @param title - RFP title to check
 * @param tier - Which tier of keywords to check against
 * @returns number of matching keywords
 */
export function countMatchingKeywords(
  title: string,
  tier: 'tier1' | 'tier2' | 'tier3' | 'all'
): number {
  const keywords = getExclusionKeywords(tier);
  const lowerTitle = title.toLowerCase();

  return keywords.filter(keyword => lowerTitle.includes(keyword.toLowerCase())).length;
}
