#!/usr/bin/env tsx
/**
 * Province Municipality Discovery Script
 *
 * This is a minimal script that Claude Code will run to discover municipalities.
 * Claude Code will:
 * 1. Run this script with a province name
 * 2. Use WebSearch to find all municipalities
 * 3. Use WebSearch to find minutes URLs for each
 * 4. Insert them all into the database
 *
 * Usage: Ask Claude Code to "Discover and add municipalities for Ontario"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Municipality {
  name: string;
  province: string;
  country: string;
  official_website?: string | null;
  minutes_url?: string | null;
  municipality_type?: string | null;
  population?: number | null;
  scan_status: string;
}

export async function insertMunicipalities(municipalities: Municipality[]) {
  console.log(`\n📥 Inserting ${municipalities.length} municipalities into database...`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const municipality of municipalities) {
    // Check if exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id, minutes_url')
      .eq('name', municipality.name)
      .eq('province', municipality.province)
      .maybeSingle();

    if (existing) {
      // Update if we have a new minutes_url
      if (municipality.minutes_url && municipality.minutes_url !== existing.minutes_url) {
        const { error } = await supabase
          .from('municipalities')
          .update({
            minutes_url: municipality.minutes_url,
            official_website: municipality.official_website,
            scan_status: 'pending',
          })
          .eq('id', existing.id);

        if (!error) {
          console.log(`   🔄 Updated: ${municipality.name}`);
          updated++;
        }
      } else {
        console.log(`   ⏭️  Skipped (exists): ${municipality.name}`);
        skipped++;
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('municipalities')
        .insert(municipality);

      if (error) {
        console.error(`   ❌ Error: ${municipality.name} - ${error.message}`);
      } else {
        console.log(`   ✅ Inserted: ${municipality.name}`);
        inserted++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📈 Total: ${municipalities.length}`);
}

async function main() {
  const province = process.argv[2];

  if (!province) {
    console.log('🇨🇦 Province Municipality Discovery');
    console.log('===================================\n');
    console.log('This script helps Claude Code discover municipalities.\n');
    console.log('Usage:');
    console.log('  Ask Claude Code: "Discover municipalities for [Province]"');
    console.log('\nExample provinces:');
    console.log('  - Ontario');
    console.log('  - British Columbia');
    console.log('  - Alberta');
    console.log('  - Quebec');
    return;
  }

  console.log(`\n🔍 Discovery mode for: ${province}`);
  console.log('\n⚠️  This script requires Claude Code to run WebSearch operations.');
  console.log('Claude Code will discover municipalities and insert them automatically.\n');
}

if (require.main === module) {
  main().catch(console.error);
}
