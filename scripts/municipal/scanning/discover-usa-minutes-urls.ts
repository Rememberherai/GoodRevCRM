#!/usr/bin/env tsx
/**
 * Interactive USA Municipality Minutes URL Discovery
 *
 * This script is designed to be run BY Claude Code with WebSearch capability.
 *
 * It will:
 * 1. Load municipalities without minutes URLs
 * 2. Display them in batches
 * 3. Claude Code will use WebSearch to find each URL
 * 4. Save discovered URLs to database
 *
 * Usage: npm run discover-usa-urls -- [--state StateName] [--limit 20] [--min-population 10000]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DiscoverOptions {
  state?: string;
  limit?: number;
  minPopulation?: number;
}

async function main() {
  const args = process.argv.slice(2);
  const options: DiscoverOptions = {
    limit: 20, // Default batch size
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state' && args[i + 1]) {
      options.state = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--min-population' && args[i + 1]) {
      options.minPopulation = parseInt(args[++i], 10);
    }
  }

  console.log('\n🔍 USA Municipality Minutes URL Discovery');
  console.log('==========================================\n');
  console.log('⚠️  IMPORTANT: This script requires Claude Code WebSearch.\n');

  if (options.state) {
    console.log(`State: ${options.state}`);
  }
  if (options.minPopulation) {
    console.log(`Minimum population: ${options.minPopulation.toLocaleString()}`);
  }
  console.log(`Batch size: ${options.limit}\n`);

  // Fetch municipalities without minutes URLs
  let query = supabase
    .from('municipalities')
    .select('id, name, province, population, official_website')
    .eq('country', 'USA')
    .is('minutes_url', null);

  if (options.state) {
    query = query.eq('province', options.state);
  }

  if (options.minPopulation) {
    query = query.gte('population', options.minPopulation);
  }

  query = query.order('population', { ascending: false }).limit(options.limit!);

  const { data: municipalities, error } = await query;

  if (error) {
    console.error('❌ Error fetching municipalities:', error.message);
    process.exit(1);
  }

  if (!municipalities || municipalities.length === 0) {
    console.log('✅ No municipalities need URL discovery!');
    process.exit(0);
  }

  console.log(`📋 Found ${municipalities.length} municipalities to process:\n`);

  municipalities.forEach((m, i) => {
    console.log(`${i + 1}. ${m.name}, ${m.province}`);
    if (m.population) {
      console.log(`   Population: ${m.population.toLocaleString()}`);
    }
    if (m.official_website) {
      console.log(`   Website: ${m.official_website}`);
    }
    console.log('');
  });

  console.log('\n💡 NEXT STEP FOR CLAUDE CODE:');
  console.log('   Use WebSearch to find minutes URLs for each municipality above.');
  console.log('   Search pattern: "[city name] [state] city council meeting minutes agendas"');
  console.log('   Look for URLs containing: /agendas, /minutes, /meetings, /council');
  console.log('   Common platforms: Legistar, Granicus, CivicPlus, CivicClerk\n');
  console.log('   After finding each URL, update the database with:\n');
  console.log('   ```typescript');
  console.log('   await supabase');
  console.log('     .from("municipalities")');
  console.log('     .update({ minutes_url: "https://...", scan_status: "pending" })');
  console.log('     .eq("id", "municipality-id-here");');
  console.log('   ```\n');
}

main().catch(console.error);

export { supabase };
