#!/usr/bin/env tsx
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
  minutesUrl: string | null;
  officialWebsite?: string;
  municipalityType?: string;
}

async function checkIfExists(name: string, province: string): Promise<boolean> {
  const { data } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', name)
    .eq('province', province)
    .maybeSingle();

  return !!data;
}

async function insertMunicipality(municipality: MunicipalityData) {
  const exists = await checkIfExists(municipality.name, municipality.province);

  if (exists) {
    console.log(`   ⏭️  Already exists: ${municipality.name}`);
    return { skipped: true };
  }

  const { error } = await supabase
    .from('municipalities')
    .insert({
      name: municipality.name,
      province: municipality.province,
      country: 'Canada',
      minutes_url: municipality.minutesUrl,
      official_website: municipality.officialWebsite,
      municipality_type: municipality.municipalityType,
      scan_status: municipality.minutesUrl ? 'pending' : 'no_minutes',
    });

  if (error) {
    console.error(`   ❌ Error inserting ${municipality.name}:`, error.message);
    return { error };
  } else {
    const status = municipality.minutesUrl ? '✅ Inserted with URL' : '⚠️  Inserted without URL';
    console.log(`   ${status}: ${municipality.name}`);
    return { success: true };
  }
}

export async function insertMunicipalities(municipalities: MunicipalityData[]) {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let withUrls = 0;
  let withoutUrls = 0;

  for (const municipality of municipalities) {
    const result = await insertMunicipality(municipality);

    if (result.skipped) {
      skipped++;
    } else if (result.error) {
      failed++;
    } else if (result.success) {
      inserted++;
      if (municipality.minutesUrl) {
        withUrls++;
      } else {
        withoutUrls++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted} (${withUrls} with URLs, ${withoutUrls} without)`);
  console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);

  return { inserted, skipped, failed, withUrls, withoutUrls };
}

// This will be called by Claude Code with discovered municipality data
if (require.main === module) {
  console.log('This script should be used via Claude Code with WebSearch');
  console.log('Example usage: import and call insertMunicipalities() with discovered data');
}
