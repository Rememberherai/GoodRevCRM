#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeAllQualityRFPs() {
  console.log('\n🔍 Analyzing All High-Quality RFPs from Municipal Scanner\n');

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
      organization:organizations(name, address_city, address_state, address_country)
    `)
    .eq('custom_fields->>source', 'municipal_minutes');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!rfps || rfps.length === 0) {
    console.log('No RFPs found from municipal_minutes source');
    return;
  }

  console.log(`Found ${rfps.length} total municipal RFPs\n`);

  // Categorize RFPs
  const categories: Record<string, any[]> = {
    'WWTP/Wastewater': [],
    'Water Infrastructure': [],
    'Stormwater/Drainage': [],
    'Roads/Streets': [],
    'Sewer Systems': [],
    'Bridges': [],
    'Buildings/Facilities': [],
    'Parks/Recreation': [],
    'Other Infrastructure': []
  };

  rfps.forEach((rfp: any) => {
    const title = rfp.title?.toLowerCase() || '';
    const description = rfp.description?.toLowerCase() || '';
    const combined = title + ' ' + description;

    // Check AI confidence
    const confidence = rfp.custom_fields?.ai_confidence || 0;
    if (confidence < 70) return; // Skip low confidence

    // Categorize
    if (combined.match(/wastewater|wwtp|treatment plant|treatment facility|épuration|traitement des eaux/)) {
      categories['WWTP/Wastewater'].push(rfp);
    } else if (combined.match(/water main|water line|water system|water distribution|water supply|waterline|aqueduc/)) {
      categories['Water Infrastructure'].push(rfp);
    } else if (combined.match(/stormwater|storm water|drainage|detention basin|culvert|storm sewer/)) {
      categories['Stormwater/Drainage'].push(rfp);
    } else if (combined.match(/road|street|pavement|asphalt|roadway|resurfacing|reconstruction|chaussée/)) {
      categories['Roads/Streets'].push(rfp);
    } else if (combined.match(/sewer(?! treatment)|sanitary sewer|sewer main|sewer line|égout/)) {
      categories['Sewer Systems'].push(rfp);
    } else if (combined.match(/bridge|overpass|underpass|pont/)) {
      categories['Bridges'].push(rfp);
    } else if (combined.match(/building|facility(?! treatment)|community center|fire station|police|library|centre communautaire/)) {
      categories['Buildings/Facilities'].push(rfp);
    } else if (combined.match(/park|playground|recreation|trail|sports|parc/)) {
      categories['Parks/Recreation'].push(rfp);
    } else {
      categories['Other Infrastructure'].push(rfp);
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('HIGH-QUALITY RFP CATEGORIES (70%+ Confidence)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  Object.entries(categories)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, rfpList]) => {
      if (rfpList.length === 0) return;

      const withValues = rfpList.filter((rfp: any) => rfp.estimated_value);
      const totalValue = withValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
      const avgValue = withValues.length > 0 ? totalValue / withValues.length : 0;

      console.log(`\n${category}: ${rfpList.length} RFPs`);
      if (withValues.length > 0) {
        console.log(`  💰 Total Value: $${totalValue.toLocaleString()}`);
        console.log(`  💰 Average Value: $${Math.round(avgValue).toLocaleString()}`);
        console.log(`  📊 ${withValues.length} of ${rfpList.length} have value estimates`);
      }

      // Show top 5 by value
      const top5 = rfpList
        .filter((rfp: any) => rfp.estimated_value)
        .sort((a: any, b: any) => (b.estimated_value || 0) - (a.estimated_value || 0))
        .slice(0, 5);

      if (top5.length > 0) {
        console.log(`\n  Top ${top5.length} by value:`);
        top5.forEach((rfp: any, idx: number) => {
          const org = rfp.organization;
          const location = org?.address_country === 'USA'
            ? `${org?.address_city}, ${org?.address_state}`
            : `${org?.address_city}, ${org?.address_state}`;
          console.log(`    ${idx + 1}. $${rfp.estimated_value.toLocaleString()} - ${rfp.title}`);
          console.log(`       📍 ${location}`);
        });
      }
    });

  // Geographic breakdown
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GEOGRAPHIC BREAKDOWN\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allQualityRfps = Object.values(categories).flat();

  const byCountry = allQualityRfps.reduce((acc: any, rfp: any) => {
    const country = rfp.organization?.address_country || 'Unknown';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  console.log('By Country:');
  Object.entries(byCountry).forEach(([country, count]) => {
    console.log(`  ${country}: ${count} RFPs`);
  });

  const usaRfps = allQualityRfps.filter((rfp: any) => rfp.organization?.address_country === 'USA');
  const byState = usaRfps.reduce((acc: any, rfp: any) => {
    const state = rfp.organization?.address_state || 'Unknown';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  console.log('\nTop 10 USA States:');
  Object.entries(byState)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count} RFPs`);
    });

  const canadaRfps = allQualityRfps.filter((rfp: any) => rfp.organization?.address_country === 'Canada');
  const byProvince = canadaRfps.reduce((acc: any, rfp: any) => {
    const province = rfp.organization?.address_state || 'Unknown';
    acc[province] = (acc[province] || 0) + 1;
    return acc;
  }, {});

  console.log('\nCanada Provinces:');
  Object.entries(byProvince)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([province, count]) => {
      console.log(`  ${province}: ${count} RFPs`);
    });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total High-Quality RFPs (70%+ confidence): ${allQualityRfps.length}`);
  const totalWithValues = allQualityRfps.filter((rfp: any) => rfp.estimated_value);
  const grandTotal = totalWithValues.reduce((sum: number, rfp: any) => sum + (rfp.estimated_value || 0), 0);
  console.log(`RFPs with values: ${totalWithValues.length}`);
  console.log(`Total estimated value: $${grandTotal.toLocaleString()}`);
  console.log(`Average value: $${Math.round(grandTotal / totalWithValues.length).toLocaleString()}\n`);
}

analyzeAllQualityRFPs();
