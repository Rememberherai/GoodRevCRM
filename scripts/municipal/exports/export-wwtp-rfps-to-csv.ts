#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportWWTPToCSV() {
  console.log('\n🔍 Fetching High-Quality WWTP Upgrade RFPs...\n');

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
    .eq('custom_fields->>country', 'USA');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found from municipal_minutes source');
    return;
  }

  console.log(`Found ${rfps.length} total municipal RFPs`);
  console.log('Applying quality filters...\n');

  // Filter for high-quality WWTP upgrades
  const filtered = rfps.filter((rfp: any) => {
    const title = rfp.title?.toLowerCase() || '';
    const description = rfp.description?.toLowerCase() || '';
    const combined = title + ' ' + description;

    // Must include WWTP-related keywords
    const includeKeywords = [
      'wastewater treatment',
      'wwtp',
      'water treatment plant',
      'treatment plant',
      'treatment facility'
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
      'install'
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
    'RFP ID'
  ].map(escapeCSV).join(','));

  // Data rows
  filtered.forEach((rfp: any) => {
    const org = rfp.organization;
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
      rfp.id
    ].map(escapeCSV).join(','));
  });

  const csvContent = csvRows.join('\n');
  const filename = `wwtp-upgrades-${new Date().toISOString().split('T')[0]}.csv`;

  writeFileSync(filename, csvContent);

  console.log(`📄 Exported ${filtered.length} RFPs to: ${filename}\n`);
  console.log('Summary:');
  console.log(`- Total RFPs: ${filtered.length}`);

  const withValues = filtered.filter((rfp: any) => rfp.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
    const avgValue = totalValue / withValues.length;
    console.log(`- RFPs with values: ${withValues.length}`);
    console.log(`- Total value: $${totalValue.toLocaleString()} USD`);
    console.log(`- Average value: $${Math.round(avgValue).toLocaleString()} USD`);
  }

  // State breakdown
  const byState = filtered.reduce((acc: any, rfp: any) => {
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

exportWWTPToCSV();
