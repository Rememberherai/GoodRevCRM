#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchFiles = [
  'batch-update-urls-51-100.ts',
  'batch-update-urls-101-150.ts',
  'batch-update-urls-151-200.ts',
  'batch-update-urls-201-220.ts',
  'batch-update-urls-221-250.ts',
  'batch-update-urls-251-280.ts',
  'batch-update-urls-281-320.ts',
  'batch-update-urls-321-350.ts',
  'batch-update-urls-351-380.ts',
  'batch-update-urls-381-410.ts',
  'batch-update-urls-401-430.ts',
  'batch-update-urls-431-460.ts',
  'batch-update-urls-461-500.ts',
  'batch-update-urls-501-600.ts',
  'batch-update-urls-601-700.ts',
  'batch-update-urls-701-750.ts',
];

interface CityUrl {
  name: string;
  province: string;
  url: string;
}

function extractCitiesFromBatch(filePath: string): CityUrl[] {
  const content = readFileSync(filePath, 'utf-8');
  const cities: CityUrl[] = [];

  // Match pattern: { name: 'City Name', province: 'State', url: 'https://...' }
  const regex = /\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*province:\s*['"]([^'"]+)['"]\s*,\s*url:\s*['"]([^'"]+)['"]\s*\}/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    cities.push({
      name: match[1],
      province: match[2],
      url: match[3],
    });
  }

  return cities;
}

async function verifyAllBatches() {
  console.log('\n🔍 Verifying all cities from batches 51-750...\n');

  let allCities: CityUrl[] = [];

  // Extract all cities from all batch files
  for (const file of batchFiles) {
    const filePath = join('scripts', file);
    try {
      const cities = extractCitiesFromBatch(filePath);
      allCities = [...allCities, ...cities];
      console.log(`📁 ${file}: ${cities.length} cities`);
    } catch (error: any) {
      console.error(`❌ ${file}: ERROR - ${error.message}`);
    }
  }

  console.log(`\n📊 Total cities extracted: ${allCities.length}\n`);
  console.log('⏳ Checking database for each city...\n');

  const missing: CityUrl[] = [];
  const found: CityUrl[] = [];
  const foundWithoutUrl: CityUrl[] = [];

  for (const city of allCities) {
    const { data, error } = await supabase
      .from('municipalities')
      .select('name, province, minutes_url')
      .eq('name', city.name)
      .eq('province', city.province)
      .eq('country', 'USA')
      .maybeSingle();

    if (error) {
      console.error(`❌ Error checking ${city.name}, ${city.province}:`, error.message);
      continue;
    }

    if (!data) {
      missing.push(city);
      console.log(`❌ NOT FOUND: ${city.name}, ${city.province}`);
    } else if (!data.minutes_url) {
      foundWithoutUrl.push(city);
      console.log(`⚠️  FOUND BUT NO URL: ${city.name}, ${city.province}`);
    } else {
      found.push(city);
    }
  }

  console.log(`\n================================`);
  console.log(`📊 COMPREHENSIVE VERIFICATION RESULTS`);
  console.log(`================================`);
  console.log(`Total cities in batch files: ${allCities.length}`);
  console.log(`✅ Found with URLs: ${found.length}`);
  console.log(`⚠️  Found but without URLs: ${foundWithoutUrl.length}`);
  console.log(`❌ Not found in database: ${missing.length}`);
  console.log(`================================\n`);

  if (foundWithoutUrl.length > 0) {
    console.log(`\n⚠️  Cities found in database but without URLs (${foundWithoutUrl.length}):`);
    foundWithoutUrl.forEach(c => console.log(`   - ${c.name}, ${c.province}`));
  }

  if (missing.length > 0) {
    console.log(`\n❌ Cities NOT found in database (${missing.length}):`);
    missing.forEach(c => console.log(`   - ${c.name}, ${c.province}`));
  }

  // Summary
  console.log(`\n📈 EXPLANATION OF DISCREPANCY:`);
  console.log(`================================`);
  console.log(`Expected (from batch files): ${allCities.length} cities`);
  console.log(`Actual database with URLs: 584 cities`);
  console.log(`Missing from database: ${missing.length} cities`);
  console.log(`In database but no URL: ${foundWithoutUrl.length} cities`);
  console.log(`Calculated discrepancy: ${allCities.length} - ${missing.length} - ${foundWithoutUrl.length} = ${allCities.length - missing.length - foundWithoutUrl.length} should match 584`);
  console.log(`================================\n`);
}

verifyAllBatches().catch(console.error);
