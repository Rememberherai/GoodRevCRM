#!/usr/bin/env tsx
/**
 * Automated Municipality Discovery Script
 *
 * This script discovers municipalities and their meeting minutes URLs for a given province.
 * It works by having Claude Code (you) run it, and the script will prompt you to perform
 * WebSearch operations at key points.
 *
 * Usage:
 *   Ask Claude Code: "Run auto-discover-municipalities for Ontario"
 *
 * Claude Code will:
 * 1. Execute this script
 * 2. Use WebSearch to find municipalities
 * 3. Use WebSearch to find minutes URLs
 * 4. Insert everything into the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MunicipalityData {
  name: string;
  province: string;
  officialWebsite?: string;
  minutesUrl?: string;
  municipalityType?: string;
  population?: number;
}

async function insertMunicipality(municipality: MunicipalityData) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', municipality.name)
    .eq('province', municipality.province)
    .maybeSingle();

  if (existing) {
    console.log(`   ⏭️  Already exists: ${municipality.name}`);

    // Update minutes_url if we have one and it's different
    if (municipality.minutesUrl && existing) {
      const { error: updateError } = await supabase
        .from('municipalities')
        .update({
          minutes_url: municipality.minutesUrl,
          scan_status: 'pending',
        })
        .eq('id', existing.id);

      if (!updateError) {
        console.log(`   🔄 Updated minutes URL for: ${municipality.name}`);
      }
    }
    return;
  }

  const { error } = await supabase
    .from('municipalities')
    .insert({
      name: municipality.name,
      province: municipality.province,
      country: 'Canada',
      official_website: municipality.officialWebsite,
      minutes_url: municipality.minutesUrl,
      municipality_type: municipality.municipalityType,
      population: municipality.population,
      scan_status: municipality.minutesUrl ? 'pending' : 'no_minutes',
    });

  if (error) {
    console.error(`   ❌ Error inserting ${municipality.name}:`, error.message);
  } else {
    console.log(`   ✅ Inserted: ${municipality.name}`);
  }
}

async function main() {
  const province = process.argv[2];

  if (!province) {
    console.error('❌ Error: Please provide a province name');
    console.log('\nUsage:');
    console.log('  Ask Claude Code: "Run auto-discover-municipalities for Ontario"');
    console.log('  Or: tsx scripts/auto-discover-municipalities.ts "Ontario"');
    process.exit(1);
  }

  console.log(`🇨🇦 Automated Municipality Discovery for ${province}`);
  console.log('='.repeat(60));
  console.log();
  console.log('📋 This script will guide Claude Code through the discovery process');
  console.log();

  // This is a placeholder - Claude Code will actually perform these searches
  console.log('⚠️  CLAUDE CODE: Please perform the following WebSearch operations:');
  console.log();
  console.log(`1. Search: "list of municipalities in ${province} Canada 2024"`);
  console.log(`2. Extract all municipality names from the results`);
  console.log(`3. For each municipality, search: "[name] ${province} council meeting minutes"`);
  console.log(`4. Extract the official minutes URL for each`);
  console.log();
  console.log('Then call the insertMunicipality() function for each one.');
  console.log();
  console.log('Example data structure needed:');
  console.log(JSON.stringify({
    name: 'Toronto',
    province: 'Ontario',
    minutesUrl: 'https://www.toronto.ca/council/meetings',
    officialWebsite: 'https://www.toronto.ca',
    municipalityType: 'City',
    population: 2930000
  }, null, 2));
  console.log();
  console.log('Export this function for Claude Code to use:');
  console.log('export { insertMunicipality };');
}

// Export for use by Claude Code
export { insertMunicipality };

if (require.main === module) {
  main().catch(console.error);
}
