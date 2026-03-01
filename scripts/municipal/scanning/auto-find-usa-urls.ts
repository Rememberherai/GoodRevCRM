#!/usr/bin/env tsx
/**
 * Automated USA Municipality URL Finder
 *
 * This script processes cities in batches and uses Claude Code's WebSearch
 * to find minutes URLs automatically. Progress is saved incrementally.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Municipality {
  id: string;
  name: string;
  province: string;
  population: number | null;
}

async function getNextBatch(startRank: number, batchSize: number): Promise<Municipality[]> {
  const { data } = await supabase
    .from('municipalities')
    .select('id, name, province, population')
    .eq('country', 'USA')
    .is('minutes_url', null)
    .not('population', 'is', null)
    .order('population', { ascending: false })
    .range(startRank, startRank + batchSize - 1);

  return data || [];
}

async function main() {
  const startRank = parseInt(process.argv[2] || '20', 10);
  const endRank = parseInt(process.argv[3] || '50', 10);
  const batchSize = endRank - startRank;

  console.log(`\n🔍 Auto USA URL Finder`);
  console.log(`==================================`);
  console.log(`Processing cities ${startRank + 1}-${endRank}`);
  console.log(`==================================\n`);

  const cities = await getNextBatch(startRank, batchSize);

  if (cities.length === 0) {
    console.log('No cities found in this range.');
    return;
  }

  console.log(`📋 Found ${cities.length} cities to process:\n`);
  cities.forEach((city, i) => {
    console.log(`${startRank + i + 1}. ${city.name}, ${city.province}${city.population ? ` - ${city.population.toLocaleString()}` : ''}`);
  });

  console.log(`\n💡 NEXT: Use WebSearch to find minutes URLs for each city above.`);
  console.log(`   After finding URLs, they will be automatically saved to the database.\n`);
}

main().catch(console.error);
