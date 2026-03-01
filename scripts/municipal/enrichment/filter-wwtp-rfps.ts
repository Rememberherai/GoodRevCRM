#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function filterHighQualityWWTP() {
  console.log('\n🔍 Filtering for High-Quality WWTP Upgrade RFPs\n');
  console.log('Criteria:');
  console.log('- Source: municipal_minutes');
  console.log('- Keywords: wastewater, treatment, plant, WWTP, upgrade, expansion');
  console.log('- Excluding: supply, chemical, maintenance, study, analysis');
  console.log('- Minimum confidence: 70%');
  console.log('- Country: USA\n');

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
      organization:organizations(name, address_city, address_state)
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

  console.log(`Found ${rfps.length} total municipal RFPs\n`);
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

  console.log(`✅ Found ${filtered.length} high-quality WWTP upgrade RFPs\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Sort by value (highest first), then by confidence
  filtered.sort((a: any, b: any) => {
    const valA = a.estimated_value || 0;
    const valB = b.estimated_value || 0;
    if (valA !== valB) return valB - valA;

    const confA = a.custom_fields?.ai_confidence || 0;
    const confB = b.custom_fields?.ai_confidence || 0;
    return confB - confA;
  });

  // Display top results
  filtered.forEach((rfp: any, index: number) => {
    const org = rfp.organization;
    const value = rfp.estimated_value
      ? `$${rfp.estimated_value.toLocaleString()} ${rfp.currency}`
      : 'Value not specified';
    const confidence = rfp.custom_fields?.ai_confidence
      ? `${rfp.custom_fields.ai_confidence}%`
      : 'N/A';
    const dueDate = rfp.due_date || 'No due date';

    console.log(`${index + 1}. ${rfp.title}`);
    console.log(`   📍 ${org?.name || 'Unknown'}`);
    console.log(`   💰 ${value}`);
    console.log(`   🎯 Confidence: ${confidence}`);
    console.log(`   📅 Due: ${dueDate}`);
    console.log(`   🔗 Region: ${rfp.custom_fields?.region || 'Unknown'}`);

    if (rfp.description) {
      const desc = rfp.description.substring(0, 200);
      console.log(`   📝 ${desc}${rfp.description.length > 200 ? '...' : ''}`);
    }
    console.log('');
  });

  // Summary by state
  const byState = filtered.reduce((acc: any, rfp: any) => {
    const state = rfp.custom_fields?.region || 'Unknown';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Summary by State:\n');
  Object.entries(byState)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count} RFPs`);
    });
  console.log('');

  // Value summary
  const withValues = filtered.filter((rfp: any) => rfp.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
    const avgValue = totalValue / withValues.length;
    console.log(`💰 Total Value: $${totalValue.toLocaleString()} USD`);
    console.log(`💰 Average Value: $${Math.round(avgValue).toLocaleString()} USD`);
    console.log(`📊 ${withValues.length} of ${filtered.length} RFPs have value estimates\n`);
  }
}

filterHighQualityWWTP();
