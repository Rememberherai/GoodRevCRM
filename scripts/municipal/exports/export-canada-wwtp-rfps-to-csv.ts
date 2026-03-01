#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportCanadaWWTPToCSV() {
  console.log('\n🔍 Fetching High-Quality WWTP Upgrade RFPs from Canada...\n');

  // Fetch all Canada RFPs (need to paginate since there are 6000+)
  let allRfps: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: rfps, error } = await supabase
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
      .eq('custom_fields->>country', 'Canada')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (!rfps || rfps.length === 0) break;

    allRfps = allRfps.concat(rfps);
    console.log(`Fetched ${allRfps.length} RFPs...`);

    if (rfps.length < pageSize) break;
    from += pageSize;
  }

  const rfps = allRfps;

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found from municipal_minutes source in Canada');
    return;
  }

  console.log(`Found ${rfps.length} total Canadian municipal RFPs`);
  console.log('Applying quality filters...\n');

  // Filter for high-quality WWTP upgrades
  const filtered = rfps.filter((rfp: any) => {
    const title = rfp.title?.toLowerCase() || '';
    const description = rfp.description?.toLowerCase() || '';
    const combined = title + ' ' + description;

    // Must include WWTP-related keywords (English and French)
    const includeKeywords = [
      'wastewater treatment',
      'wwtp',
      'water treatment plant',
      'treatment plant',
      'treatment facility',
      'traitement des eaux usées',
      'usine de traitement',
      'station d\'épuration',
      'épuration',
      'traitement de l\'eau'
    ];

    const hasInclude = includeKeywords.some(keyword => combined.includes(keyword));
    if (!hasInclude) return false;

    // Must include upgrade/expansion/improvement keywords (English and French)
    const projectKeywords = [
      'upgrade',
      'expansion',
      'improvement',
      'construction',
      'rehabilitation',
      'modernization',
      'renovation',
      'replacement',
      'new',
      'design',
      'install',
      'amélioration',
      'rénovation',
      'modernisation',
      'réhabilitation',
      'remplacement',
      'agrandissement',
      'nouveau',
      'nouvelle'
    ];

    const hasProject = projectKeywords.some(keyword => combined.includes(keyword));
    if (!hasProject) return false;

    // Exclude low-value supply/maintenance items (English and French)
    const excludeKeywords = [
      'chemical supply',
      'alum supply',
      'hypochlorite',
      'routine maintenance',
      'annual maintenance',
      'service contract',
      'supply contract',
      'feasibility study',
      'preliminary study',
      'assessment only',
      'analysis only',
      'achat de produits chimiques',
      'approvisionnement',
      'entretien courant',
      'contrat d\'entretien',
      'étude de faisabilité',
      'analyse préliminaire'
    ];

    const hasExclude = excludeKeywords.some(keyword => combined.includes(keyword));
    if (hasExclude) return false;

    // Check AI confidence if available
    const confidence = rfp.custom_fields?.ai_confidence;
    if (confidence && confidence < 70) return false;

    return true;
  });

  console.log(`✅ Filtered to ${filtered.length} high-quality WWTP upgrade RFPs\n`);

  // Sort by value (highest first), then by confidence
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

  // Header
  csvRows.push([
    'Title',
    'Municipality',
    'City',
    'Province',
    'Estimated Value',
    'Currency',
    'Due Date',
    'Status',
    'AI Confidence',
    'Committee',
    'Meeting Date',
    'Meeting URL',
    'Calendar URL',
    'Opportunity Type',
    'Description',
    'Design Capacity (MGD)',
    'Actual Capacity (MGD)',
    'Utilization %',
    'Population Growth %',
    'Growth Period',
    'Year Built',
    'Infrastructure Age',
    'Last Upgrade Year',
    'Infrastructure Notes',
    'Recent Bonds',
    'RFP ID'
  ].map(escapeCSV).join(','));

  // Data rows
  filtered.forEach((rfp: any) => {
    const org = rfp.organization;
    const enrichment = rfp.custom_fields?.enrichment || {};
    const capacity = enrichment.capacity || {};
    const growth = enrichment.population_growth || {};
    const infra = enrichment.infrastructure || {};
    const bonds = enrichment.bond_history || {};

    csvRows.push([
      rfp.title || '',
      org?.name || '',
      org?.address_city || '',
      org?.address_state || '',
      rfp.estimated_value || '',
      rfp.currency || '',
      rfp.due_date || '',
      rfp.status || '',
      rfp.custom_fields?.ai_confidence || '',
      rfp.custom_fields?.committee_name || '',
      rfp.custom_fields?.meeting_date || '',
      rfp.custom_fields?.meeting_url || '',
      rfp.custom_fields?.calendar_url || '',
      rfp.custom_fields?.opportunity_type || '',
      (rfp.description || '').replace(/\n/g, ' ').substring(0, 500),
      capacity.design_mgd || '',
      capacity.actual_mgd || '',
      capacity.utilization_pct || '',
      growth.rate_pct || '',
      growth.period || '',
      infra.built_year || '',
      infra.age_years || '',
      infra.last_upgrade_year || '',
      (infra.notes || '').replace(/\n/g, ' '),
      bonds.recent_bonds?.length > 0 ? 'Yes' : (bonds.attempted ? 'No' : ''),
      rfp.id
    ].map(escapeCSV).join(','));
  });

  const csvContent = csvRows.join('\n');
  const filename = `canada-wwtp-upgrades-${new Date().toISOString().split('T')[0]}.csv`;

  writeFileSync(filename, csvContent);

  console.log(`📄 Exported ${filtered.length} RFPs to: ${filename}\n`);
  console.log('Summary:');
  console.log(`- Total RFPs: ${filtered.length}`);

  const withValues = filtered.filter((rfp: any) => rfp.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
    const avgValue = totalValue / withValues.length;
    console.log(`- RFPs with values: ${withValues.length}`);
    console.log(`- Total value: $${totalValue.toLocaleString()} CAD`);
    console.log(`- Average value: $${Math.round(avgValue).toLocaleString()} CAD`);
  }

  // Province breakdown
  const byProvince = filtered.reduce((acc: any, rfp: any) => {
    const province = rfp.organization?.address_state || 'Unknown';
    acc[province] = (acc[province] || 0) + 1;
    return acc;
  }, {});

  console.log(`\nBy Province:`);
  Object.entries(byProvince)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([province, count]) => {
      console.log(`  ${province}: ${count} RFPs`);
    });

  console.log('');
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

exportCanadaWWTPToCSV();
