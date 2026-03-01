#!/usr/bin/env tsx
/**
 * Enrich WWTP RFPs with capacity, population growth, infrastructure age, and bond history
 *
 * Usage:
 *   npx tsx scripts/enrich-all-wwtp-rfps.ts [--limit N] [--country USA|Canada] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getEpaCapacity, type CapacityData } from '../lib/enrichment/epa-capacity';
import { getCensusGrowth, type PopulationGrowthData } from '../lib/enrichment/census-growth';
import { aiResearchAll, aiResearchInfrastructure, aiResearchBonds, type InfrastructureData } from '../lib/enrichment/ai-research';
import type { BondHistoryData } from '../lib/enrichment/emma-bonds';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EnrichmentData {
  capacity: CapacityData | null;
  population_growth: PopulationGrowthData | null;
  infrastructure: InfrastructureData | null;
  bond_history: BondHistoryData | null;
  sources: string[];
  enriched_at: string;
}

interface RfpRecord {
  id: string;
  title: string;
  custom_fields: Record<string, unknown>;
  organization: {
    name: string;
    address_city: string;
    address_state: string;
  } | null;
}

// Parse command line arguments
function parseArgs(): { limit: number; country: string | null; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let country: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--country' && args[i + 1]) {
      country = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { limit, country, dryRun };
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Filter for high-quality WWTP RFPs (same logic as export script)
function isHighQualityWWTP(rfp: RfpRecord): boolean {
  const title = rfp.title?.toLowerCase() || '';
  const combined = title;

  const includeKeywords = [
    'wastewater treatment', 'wwtp', 'water treatment plant',
    'treatment plant', 'treatment facility', 'sewer', 'sewage'
  ];

  const hasInclude = includeKeywords.some(keyword => combined.includes(keyword));
  if (!hasInclude) return false;

  const projectKeywords = [
    'upgrade', 'expansion', 'improvement', 'construction',
    'rehabilitation', 'modernization', 'renovation', 'replacement', 'new', 'design'
  ];

  const hasProject = projectKeywords.some(keyword => combined.includes(keyword));
  if (!hasProject) return false;

  const excludeKeywords = [
    'chemical supply', 'alum supply', 'hypochlorite',
    'routine maintenance', 'annual maintenance'
  ];

  const hasExclude = excludeKeywords.some(keyword => combined.includes(keyword));
  if (hasExclude) return false;

  return true;
}

// Enrich a single RFP
async function enrichRfp(rfp: RfpRecord): Promise<EnrichmentData> {
  const customFields = rfp.custom_fields || {};
  const isUSA = customFields.country === 'USA';
  const city = rfp.organization?.address_city || '';
  const region = rfp.organization?.address_state || (customFields.region as string) || '';
  const country = (customFields.country as string) || 'USA';

  console.log(`  Enriching: ${city}, ${region} (${country})`);

  let capacity: CapacityData | null = null;
  let populationGrowth: PopulationGrowthData | null = null;
  let infrastructure: InfrastructureData | null = null;
  let bondHistory: BondHistoryData | null = null;
  const sources: string[] = [];

  if (isUSA) {
    // USA: Use structured APIs first, then AI for gaps

    // 1. EPA for capacity
    if (city && region) {
      capacity = await getEpaCapacity(city, region);
      if (capacity) {
        sources.push('EPA ECHO');
        console.log(`    ✓ EPA Capacity: ${capacity.actual_mgd?.toFixed(2) || 'N/A'} / ${capacity.design_mgd?.toFixed(2) || 'N/A'} MGD`);
      }
    }

    // 2. Census for population growth
    if (city && region) {
      populationGrowth = await getCensusGrowth(city, region);
      if (populationGrowth) {
        sources.push('US Census');
        console.log(`    ✓ Census Growth: ${populationGrowth.rate_pct?.toFixed(1) || 'N/A'}% (${populationGrowth.period})`);
      }
    }

    // 3. AI research for infrastructure age and bond history (and any gaps)
    const needsAI = !capacity || !populationGrowth;
    if (city && region) {
      // Always get infrastructure and bonds from AI
      const aiResult = await aiResearchAll(city, region, country);

      if (!capacity && aiResult.capacity) {
        capacity = aiResult.capacity;
        console.log(`    ✓ AI Capacity: ${capacity.actual_mgd?.toFixed(2) || 'N/A'} / ${capacity.design_mgd?.toFixed(2) || 'N/A'} MGD`);
      }

      if (!populationGrowth && aiResult.populationGrowth) {
        populationGrowth = aiResult.populationGrowth;
        console.log(`    ✓ AI Growth: ${populationGrowth.rate_pct?.toFixed(1) || 'N/A'}%`);
      }

      if (aiResult.infrastructure) {
        infrastructure = aiResult.infrastructure;
        console.log(`    ✓ AI Infrastructure: Built ${infrastructure.built_year || 'N/A'}, Age ${infrastructure.age_years || 'N/A'} years`);
      }

      if (aiResult.bonds) {
        bondHistory = aiResult.bonds;
        const bondStatus = bondHistory.referendum_info?.result || 'N/A';
        console.log(`    ✓ AI Bonds: ${bondHistory.attempted ? 'Yes' : 'No'} (${bondStatus})`);
      }

      if (aiResult.sources.length > 0) {
        sources.push(...aiResult.sources);
      } else if (needsAI || aiResult.infrastructure || aiResult.bonds) {
        sources.push('AI Research');
      }
    }
  } else {
    // Canada: Use AI research for everything
    if (city && region) {
      console.log('    Using AI research for Canadian municipality...');
      const aiResult = await aiResearchAll(city, region, country);

      capacity = aiResult.capacity;
      populationGrowth = aiResult.populationGrowth;
      infrastructure = aiResult.infrastructure;
      bondHistory = aiResult.bonds;

      if (capacity) {
        console.log(`    ✓ Capacity: ${capacity.actual_mgd?.toFixed(2) || 'N/A'} / ${capacity.design_mgd?.toFixed(2) || 'N/A'} MGD`);
      }
      if (populationGrowth) {
        console.log(`    ✓ Growth: ${populationGrowth.rate_pct?.toFixed(1) || 'N/A'}%`);
      }
      if (infrastructure) {
        console.log(`    ✓ Infrastructure: Built ${infrastructure.built_year || 'N/A'}, Age ${infrastructure.age_years || 'N/A'} years`);
      }
      if (bondHistory) {
        console.log(`    ✓ Bonds: ${bondHistory.attempted ? 'Yes' : 'No'}`);
      }

      if (aiResult.sources.length > 0) {
        sources.push(...aiResult.sources);
      } else {
        sources.push('AI Research');
      }
    }
  }

  return {
    capacity,
    population_growth: populationGrowth,
    infrastructure,
    bond_history: bondHistory,
    sources,
    enriched_at: new Date().toISOString(),
  };
}

async function main() {
  const { limit, country, dryRun } = parseArgs();

  console.log('\n========================================');
  console.log('  WWTP RFP Enrichment Pipeline');
  console.log('========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved\n');
  }

  // Build query
  let query = supabase
    .from('rfps')
    .select(`
      id,
      title,
      custom_fields,
      organization:organizations(name, address_city, address_state)
    `)
    .eq('custom_fields->>source', 'municipal_minutes')
    .is('deleted_at', null);

  if (country) {
    query = query.eq('custom_fields->>country', country);
    console.log(`Filtering by country: ${country}`);
  }

  const { data: rfps, error } = await query;

  if (error) {
    console.error('❌ Error fetching RFPs:', error.message);
    process.exit(1);
  }

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found matching criteria');
    process.exit(0);
  }

  console.log(`Found ${rfps.length} municipal RFPs`);

  // Filter to high-quality WWTP projects
  const wwtpRfps = (rfps as RfpRecord[]).filter(isHighQualityWWTP);
  console.log(`Filtered to ${wwtpRfps.length} WWTP upgrade projects`);

  // Skip already enriched
  const needsEnrichment = wwtpRfps.filter(rfp => {
    const enrichment = (rfp.custom_fields as any)?.enrichment;
    return !enrichment?.enriched_at;
  });

  console.log(`${needsEnrichment.length} RFPs need enrichment\n`);

  // Apply limit
  const toProcess = needsEnrichment.slice(0, limit);
  console.log(`Processing ${toProcess.length} RFPs...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const rfp = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] ${rfp.title?.substring(0, 60)}...`);

    try {
      const enrichment = await enrichRfp(rfp);

      if (!dryRun) {
        // Update RFP with enrichment data
        const currentFields = (rfp.custom_fields as Record<string, unknown>) || {};
        const updatedFields = {
          ...currentFields,
          enrichment,
        };

        const { error: updateError } = await supabase
          .from('rfps')
          .update({ custom_fields: updatedFields })
          .eq('id', rfp.id);

        if (updateError) {
          console.error(`    ❌ Failed to save: ${updateError.message}`);
          errorCount++;
        } else {
          console.log('    ✅ Saved to database');
          successCount++;
        }
      } else {
        console.log('    📋 Would save (dry run)');
        successCount++;
      }

      // Rate limit: wait between requests to avoid API throttling
      if (i < toProcess.length - 1) {
        await delay(1000); // 1 second between RFPs
      }
    } catch (err) {
      console.error(`    ❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('  Enrichment Complete');
  console.log('========================================');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${toProcess.length}`);
  console.log('');
}

main().catch(console.error);
