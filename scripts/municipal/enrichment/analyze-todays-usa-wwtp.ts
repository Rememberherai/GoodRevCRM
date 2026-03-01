#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeTodaysUSAWWTP() {
  console.log('\n🔍 Analyzing Today\'s USA Scan for WWTP Upgrades\n');
  console.log('Scan completed: 2026-02-09');
  console.log('Total USA RFPs created: 314\n');

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
      organization:organizations(name, address_city, address_state, address_country)
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

  console.log(`Found ${rfps.length} RFPs from today's USA scan\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

  console.log(`✅ Found ${wwtpRfps.length} high-quality WWTP upgrade RFPs\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Sort by value (highest first), then by confidence
  wwtpRfps.sort((a: any, b: any) => {
    const valA = a.estimated_value || 0;
    const valB = b.estimated_value || 0;
    if (valA !== valB) return valB - valA;

    const confA = a.custom_fields?.ai_confidence || 0;
    const confB = b.custom_fields?.ai_confidence || 0;
    return confB - confA;
  });

  // Display all WWTP RFPs
  wwtpRfps.forEach((rfp: any, index: number) => {
    const org = rfp.organization;
    const value = rfp.estimated_value
      ? `$${rfp.estimated_value.toLocaleString()} ${rfp.currency}`
      : 'Value not specified';
    const confidence = rfp.custom_fields?.ai_confidence
      ? `${rfp.custom_fields.ai_confidence}%`
      : 'N/A';
    const dueDate = rfp.due_date || 'No due date';
    const meetingDate = rfp.custom_fields?.meeting_date || 'Unknown';

    console.log(`${index + 1}. ${rfp.title}`);
    console.log(`   📍 ${org?.address_city}, ${org?.address_state}`);
    console.log(`   💰 ${value}`);
    console.log(`   🎯 Confidence: ${confidence}`);
    console.log(`   📅 Due: ${dueDate}`);
    console.log(`   📆 Meeting: ${meetingDate}`);

    if (rfp.description) {
      const desc = rfp.description.substring(0, 300);
      console.log(`   📝 ${desc}${rfp.description.length > 300 ? '...' : ''}`);
    }
    console.log('');
  });

  // Summary by state
  const byState = wwtpRfps.reduce((acc: any, rfp: any) => {
    const state = rfp.organization?.address_state || 'Unknown';
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
  const withValues = wwtpRfps.filter((rfp: any) => rfp.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
    const avgValue = totalValue / withValues.length;
    console.log(`💰 Total Value: $${totalValue.toLocaleString()} USD`);
    console.log(`💰 Average Value: $${Math.round(avgValue).toLocaleString()} USD`);
    console.log(`📊 ${withValues.length} of ${wwtpRfps.length} RFPs have value estimates\n`);
  }

  // Breakdown of all categories from today's scan
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('ALL CATEGORIES FROM TODAY\'S USA SCAN:\n');

  const categories: Record<string, number> = {
    'WWTP/Wastewater': 0,
    'Water Infrastructure': 0,
    'Stormwater/Drainage': 0,
    'Roads/Streets': 0,
    'Sewer Systems': 0,
    'Buildings/Facilities': 0,
    'Other': 0
  };

  rfps.forEach((rfp: any) => {
    const title = rfp.title?.toLowerCase() || '';
    const description = rfp.description?.toLowerCase() || '';
    const combined = title + ' ' + description;

    if (combined.match(/wastewater|wwtp|treatment plant|treatment facility|pollution control/)) {
      categories['WWTP/Wastewater']++;
    } else if (combined.match(/water main|water line|water system|water distribution|water supply|waterline/)) {
      categories['Water Infrastructure']++;
    } else if (combined.match(/stormwater|storm water|drainage|detention basin|culvert|storm sewer/)) {
      categories['Stormwater/Drainage']++;
    } else if (combined.match(/road|street|pavement|asphalt|roadway|resurfacing/)) {
      categories['Roads/Streets']++;
    } else if (combined.match(/sewer(?! treatment)|sanitary sewer|sewer main|sewer line/)) {
      categories['Sewer Systems']++;
    } else if (combined.match(/building|facility(?! treatment)|community center|fire station|police|library/)) {
      categories['Buildings/Facilities']++;
    } else {
      categories['Other']++;
    }
  });

  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      if (count > 0) {
        console.log(`  ${category}: ${count} RFPs`);
      }
    });

  console.log('\n');
}

analyzeTodaysUSAWWTP();
