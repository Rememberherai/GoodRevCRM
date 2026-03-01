#!/usr/bin/env tsx
/**
 * Export enriched WWTP RFPs to CSV with capacity, growth, infrastructure, and bond data
 *
 * Usage:
 *   npx tsx scripts/export-enriched-wwtp-csv.ts [--country USA|Canada] [--enriched-only]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parse command line arguments
function parseArgs(): { country: string | null; enrichedOnly: boolean } {
  const args = process.argv.slice(2);
  let country: string | null = null;
  let enrichedOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--country' && args[i + 1]) {
      country = args[i + 1];
      i++;
    } else if (args[i] === '--enriched-only') {
      enrichedOnly = true;
    }
  }

  return { country, enrichedOnly };
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Filter for high-quality WWTP RFPs
function isHighQualityWWTP(rfp: any): boolean {
  const title = rfp.title?.toLowerCase() || '';

  const includeKeywords = [
    'wastewater treatment', 'wwtp', 'water treatment plant',
    'treatment plant', 'treatment facility', 'sewer', 'sewage'
  ];

  const hasInclude = includeKeywords.some(keyword => title.includes(keyword));
  if (!hasInclude) return false;

  const projectKeywords = [
    'upgrade', 'expansion', 'improvement', 'construction',
    'rehabilitation', 'modernization', 'renovation', 'replacement', 'new', 'design'
  ];

  const hasProject = projectKeywords.some(keyword => title.includes(keyword));
  return hasProject;
}

async function exportEnrichedCSV() {
  const { country, enrichedOnly } = parseArgs();

  console.log('\n========================================');
  console.log('  Export Enriched WWTP RFPs to CSV');
  console.log('========================================\n');

  // Build query
  let query = supabase
    .from('rfps')
    .select(`
      id,
      title,
      description,
      estimated_value,
      currency,
      due_date,
      status,
      custom_fields,
      organization:organizations(name, address_city, address_state, website)
    `)
    .eq('custom_fields->>source', 'municipal_minutes')
    .is('deleted_at', null);

  if (country) {
    query = query.eq('custom_fields->>country', country);
    console.log(`Filtering by country: ${country}`);
  }

  const { data: rfps, error } = await query;

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found');
    return;
  }

  console.log(`Found ${rfps.length} total municipal RFPs`);

  // Filter to WWTP projects
  let filtered = rfps.filter(isHighQualityWWTP);
  console.log(`Filtered to ${filtered.length} WWTP upgrade projects`);

  // Optionally filter to only enriched
  if (enrichedOnly) {
    filtered = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.enriched_at);
    console.log(`Filtered to ${filtered.length} enriched RFPs`);
  }

  // Sort by estimated value, then by confidence
  filtered.sort((a: any, b: any) => {
    const valA = a.estimated_value || 0;
    const valB = b.estimated_value || 0;
    if (valA !== valB) return valB - valA;

    const confA = a.custom_fields?.ai_confidence || 0;
    const confB = b.custom_fields?.ai_confidence || 0;
    return confB - confA;
  });

  // Build CSV
  const csvRows: string[] = [];

  // Header with enrichment columns
  csvRows.push([
    'Title',
    'Municipality',
    'City',
    'State/Province',
    'Country',
    'Estimated Value',
    'Currency',
    'Due Date',
    'Status',
    'AI Confidence',
    // Capacity enrichment
    'Design MGD',
    'Actual MGD',
    'Capacity Utilization %',
    'Capacity Source',
    // Population enrichment
    'Pop Growth Rate %',
    'Pop Growth Period',
    'Population Current',
    'Pop Source',
    // Infrastructure enrichment
    'Built Year',
    'Last Upgrade Year',
    'Infrastructure Age (Years)',
    'Infra Notes',
    // Bond enrichment
    'Bond Attempted',
    'Bond Year',
    'Bond Amount',
    'Bond Result',
    // Metadata
    'Committee',
    'Meeting Date',
    'Meeting URL',
    'Opportunity Type',
    'Enrichment Sources',
    'Enriched At',
    'Description',
    'RFP ID'
  ].map(escapeCSV).join(','));

  // Data rows
  filtered.forEach((rfp: any) => {
    const org = rfp.organization;
    const cf = rfp.custom_fields || {};
    const enrichment = cf.enrichment || {};
    const capacity = enrichment.capacity || {};
    const popGrowth = enrichment.population_growth || {};
    const infra = enrichment.infrastructure || {};
    const bonds = enrichment.bond_history || {};
    const referendum = bonds.referendum_info || {};

    csvRows.push([
      rfp.title || '',
      org?.name || '',
      org?.address_city || '',
      org?.address_state || cf.region || '',
      cf.country || '',
      rfp.estimated_value || '',
      rfp.currency || '',
      rfp.due_date || '',
      rfp.status || '',
      cf.ai_confidence || '',
      // Capacity
      capacity.design_mgd || '',
      capacity.actual_mgd || '',
      capacity.utilization_pct || '',
      capacity.source || '',
      // Population
      popGrowth.rate_pct || '',
      popGrowth.period || '',
      popGrowth.population_end || '',
      popGrowth.source || '',
      // Infrastructure
      infra.built_year || '',
      infra.last_upgrade_year || '',
      infra.age_years || '',
      (infra.notes || '').replace(/\n/g, ' ').substring(0, 200),
      // Bonds
      bonds.attempted !== undefined ? (bonds.attempted ? 'Yes' : 'No') : '',
      referendum.year || '',
      referendum.amount || '',
      referendum.result || '',
      // Metadata
      cf.committee_name || '',
      cf.meeting_date || '',
      cf.meeting_url || '',
      cf.opportunity_type || '',
      (enrichment.sources || []).join('; '),
      enrichment.enriched_at || '',
      (rfp.description || '').replace(/\n/g, ' ').substring(0, 500),
      rfp.id
    ].map(escapeCSV).join(','));
  });

  const csvContent = csvRows.join('\n');
  const countryTag = country ? `-${country.toLowerCase()}` : '';
  const filename = `wwtp-enriched${countryTag}-${new Date().toISOString().split('T')[0]}.csv`;

  writeFileSync(filename, csvContent);

  console.log(`\n📄 Exported ${filtered.length} RFPs to: ${filename}\n`);

  // Summary stats
  const enrichedCount = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.enriched_at).length;
  const withCapacity = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.capacity?.design_mgd).length;
  const withGrowth = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.population_growth?.rate_pct !== null).length;
  const withInfra = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.infrastructure?.built_year).length;
  const withBonds = filtered.filter((rfp: any) => rfp.custom_fields?.enrichment?.bond_history?.attempted !== undefined).length;

  console.log('Enrichment Summary:');
  console.log(`  Total RFPs: ${filtered.length}`);
  console.log(`  Enriched: ${enrichedCount}`);
  console.log(`  With Capacity Data: ${withCapacity}`);
  console.log(`  With Growth Data: ${withGrowth}`);
  console.log(`  With Infrastructure Age: ${withInfra}`);
  console.log(`  With Bond History: ${withBonds}`);

  // High utilization facilities
  const highUtilization = filtered.filter((rfp: any) => {
    const util = rfp.custom_fields?.enrichment?.capacity?.utilization_pct;
    return util && util >= 80;
  });

  if (highUtilization.length > 0) {
    console.log(`\n⚠️  High Capacity Utilization (≥80%):`);
    highUtilization.slice(0, 10).forEach((rfp: any) => {
      const util = rfp.custom_fields?.enrichment?.capacity?.utilization_pct;
      const city = rfp.organization?.address_city || 'Unknown';
      const state = rfp.organization?.address_state || '';
      console.log(`    ${city}, ${state}: ${util}%`);
    });
  }

  // Fast growing areas
  const fastGrowing = filtered.filter((rfp: any) => {
    const rate = rfp.custom_fields?.enrichment?.population_growth?.rate_pct;
    return rate && rate >= 10;
  });

  if (fastGrowing.length > 0) {
    console.log(`\n📈 Fast Growing Areas (≥10% growth):`);
    fastGrowing.slice(0, 10).forEach((rfp: any) => {
      const rate = rfp.custom_fields?.enrichment?.population_growth?.rate_pct;
      const city = rfp.organization?.address_city || 'Unknown';
      const state = rfp.organization?.address_state || '';
      console.log(`    ${city}, ${state}: ${rate?.toFixed(1)}%`);
    });
  }

  // Aging infrastructure
  const agingInfra = filtered.filter((rfp: any) => {
    const age = rfp.custom_fields?.enrichment?.infrastructure?.age_years;
    return age && age >= 40;
  });

  if (agingInfra.length > 0) {
    console.log(`\n🏚️  Aging Infrastructure (≥40 years):`);
    agingInfra.slice(0, 10).forEach((rfp: any) => {
      const age = rfp.custom_fields?.enrichment?.infrastructure?.age_years;
      const built = rfp.custom_fields?.enrichment?.infrastructure?.built_year;
      const city = rfp.organization?.address_city || 'Unknown';
      const state = rfp.organization?.address_state || '';
      console.log(`    ${city}, ${state}: ${age} years old (built ${built || 'N/A'})`);
    });
  }

  console.log('');
}

exportEnrichedCSV().catch(console.error);
