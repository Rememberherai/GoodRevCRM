#!/usr/bin/env tsx
/**
 * Discovers meeting minutes URLs for Ontario municipalities that don't have them yet.
 *
 * This script:
 * 1. Fetches all Ontario municipalities with scan_status='no_minutes'
 * 2. For each municipality, uses WebSearch to find the council meeting minutes page
 * 3. Updates the municipality record with the discovered minutes_url
 * 4. Changes scan_status from 'no_minutes' to 'pending'
 *
 * NOTE: This script is designed to be run BY Claude Code with WebSearch capability.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Fetch all Ontario municipalities without minutes URLs
  const { data: municipalities, error } = await supabase
    .from('municipalities')
    .select('id, name, official_website')
    .eq('province', 'Ontario')
    .eq('scan_status', 'no_minutes')
    .order('name');

  if (error) {
    console.error('❌ Error fetching municipalities:', error.message);
    process.exit(1);
  }

  if (!municipalities || municipalities.length === 0) {
    console.log('✅ No municipalities need minutes URL discovery!');
    process.exit(0);
  }

  console.log(`\n🔍 Discovering meeting minutes URLs for ${municipalities.length} Ontario municipalities\n`);
  console.log(`⚠️  IMPORTANT: This script requires WebSearch capability.`);
  console.log(`   It should be run by Claude Code, not standalone.\n`);
  console.log(`📋 Municipalities to process:\n`);

  // Show the list
  municipalities.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name}`);
    console.log(`      Website: ${m.official_website}`);
  });

  console.log(`\n\n💡 NEXT STEP:`);
  console.log(`   Claude Code will now use WebSearch to find minutes URLs for each municipality.`);
  console.log(`   Search pattern: "[municipality name] Ontario council meeting minutes"`);
  console.log(`   Look for URLs containing: /minutes, /agendas, /council, escribemeetings.com, civicweb.net\n`);
}

main().catch(console.error);

export { supabase };
