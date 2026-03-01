#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportTodaysUSAWWTPToCSV() {
  console.log('\n🔍 Exporting Today\'s USA WWTP Upgrades to CSV...\n');

  // Get RFPs created today from USA scan
  const today = new Date().toISOString().split('T')[0];

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
      created_at,
      organization:organizations(name, address_city, address_state, address_country, website)
    `)
    .eq('custom_fields->>source', 'municipal_minutes')
    .eq('custom_fields->>country', 'USA')
    .gte('created_at', `${today}T00:00:00.000Z`);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found from today\'s USA scan');
    return;
  }

  console.log(`Found ${rfps.length} RFPs from today's USA scan`);
  console.log('Applying WWTP upgrade filters...\n');

  // Filter for WWTP upgrades
  const wwtpRfps = rfps.filter((rfp: any) => {
    const title = rfp.title?.toLowerCase() || '';
    const description = rfp.description?.toLowerCase() || '';
    const combined = title + ' ' + description;

    // Must include WWTP-related keywords
    const includeKeywords = [
      'wastewater treatment',
      'wwtp',
      'water treatment plant',
      'treatment plant',
      'treatment facility',
      'water reclamation',
      'pollution control'
    ];

    const hasInclude = includeKeywords.some(keyword => combined.includes(keyword));
    if (!hasInclude) return false;

    // Must include upgrade/expansion/improvement keywords
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
      'rebuild',
      'refurbish'
    ];

    const hasProject = projectKeywords.some(keyword => combined.includes(keyword));
    if (!hasProject) return false;

    // Exclude low-value supply/maintenance items
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
      'analysis only'
    ];

    const hasExclude = excludeKeywords.some(keyword => combined.includes(keyword));
    if (hasExclude) return false;

    // Check AI confidence if available
    const confidence = rfp.custom_fields?.ai_confidence;
    if (confidence && confidence < 70) return false;

    return true;
  });

  console.log(`✅ Filtered to ${wwtpRfps.length} high-quality WWTP upgrade RFPs\n`);

  // Sort by value (highest first), then by confidence
  wwtpRfps.sort((a: any, b: any) => {
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
    'State',
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
  wwtpRfps.forEach((rfp: any) => {
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
  const filename = `usa-wwtp-upgrades-${today}.csv`;

  writeFileSync(filename, csvContent);

  console.log(`📄 Exported ${wwtpRfps.length} USA WWTP RFPs to: ${filename}\n`);
  console.log('Summary:');
  console.log(`- Total RFPs: ${wwtpRfps.length}`);

  const withValues = wwtpRfps.filter((rfp: any) => rfp.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
    const avgValue = totalValue / withValues.length;
    console.log(`- RFPs with values: ${withValues.length}`);
    console.log(`- Total value: $${totalValue.toLocaleString()} USD`);
    console.log(`- Average value: $${Math.round(avgValue).toLocaleString()} USD`);
  }

  // State breakdown
  const byState = wwtpRfps.reduce((acc: any, rfp: any) => {
    const state = rfp.organization?.address_state || 'Unknown';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  console.log(`\nTop 10 States:`);
  Object.entries(byState)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count} RFPs`);
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

exportTodaysUSAWWTPToCSV();
