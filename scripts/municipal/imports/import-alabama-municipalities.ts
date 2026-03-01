#!/usr/bin/env tsx
/**
 * Import Alabama Municipalities for Testing
 *
 * Imports 10 Alabama cities for testing the USA minutes URL finder
 *
 * Usage: npm run import-alabama-municipalities
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Top 10 Alabama cities for testing
const alabamaMunicipalities = [
  { name: 'Birmingham', population: 200733 },
  { name: 'Montgomery', population: 200603 },
  { name: 'Mobile', population: 187041 },
  { name: 'Huntsville', population: 215006 },
  { name: 'Tuscaloosa', population: 100618 },
  { name: 'Auburn', population: 76143 },
  { name: 'Dothan', population: 71072 },
  { name: 'Decatur', population: 57938 },
  { name: 'Hoover', population: 92606 },
  { name: 'Gadsden', population: 33945 },
];

async function importMunicipalities() {
  console.log('\n🇺🇸 Importing Alabama Municipalities');
  console.log('====================================\n');

  let imported = 0;
  let skipped = 0;

  for (const muni of alabamaMunicipalities) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', muni.name)
      .eq('province', 'Alabama')
      .eq('country', 'USA')
      .single();

    if (existing) {
      console.log(`⏭️  ${muni.name} - Already exists, skipping`);
      skipped++;
      continue;
    }

    // Insert new municipality
    const { error } = await supabase
      .from('municipalities')
      .insert({
        name: muni.name,
        province: 'Alabama',
        country: 'USA',
        population: muni.population,
        municipality_type: 'City',
        scan_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`❌ ${muni.name} - Failed:`, error.message);
    } else {
      console.log(`✅ ${muni.name} - Imported (pop: ${muni.population.toLocaleString()})`);
      imported++;
    }
  }

  console.log('\n====================================');
  console.log('Summary:');
  console.log(`  ✅ Imported: ${imported}`);
  console.log(`  ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`  📊 Total municipalities: ${alabamaMunicipalities.length}`);
  console.log('====================================\n');

  if (imported > 0) {
    console.log('Next step: Run the URL finder with:');
    console.log('  npm run find-usa-minutes-urls -- --state Alabama --limit 10\n');
  }
}

importMunicipalities().catch(console.error);
