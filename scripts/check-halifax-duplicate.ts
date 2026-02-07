#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('municipalities')
    .select('*')
    .eq('province', 'Nova Scotia')
    .ilike('name', '%Halifax%')
    .order('created_at');

  console.log('Halifax municipalities:');
  data?.forEach(m => {
    console.log(`  ID: ${m.id}`);
    console.log(`  Name: ${m.name}`);
    console.log(`  Created: ${m.created_at}`);
    console.log(`  Minutes URL: ${m.minutes_url}`);
    console.log(`  RFPs found: ${m.rfps_found_count}`);
    console.log('');
  });

  // The older "Halifax" entry has RFPs, so we should keep that one
  // and delete the newer "Halifax Regional Municipality" if it's a duplicate
  if (data && data.length > 1) {
    const oldHalifax = data.find(m => m.name === 'Halifax');
    const newHalifax = data.find(m => m.name === 'Halifax Regional Municipality');

    if (oldHalifax && newHalifax && oldHalifax.rfps_found_count > 0) {
      console.log('Found duplicate. The older "Halifax" entry has RFPs.');
      console.log('Recommendation: Delete the newer "Halifax Regional Municipality" entry');
      console.log(`Delete ID: ${newHalifax.id}`);
    }
  }
}

main();
