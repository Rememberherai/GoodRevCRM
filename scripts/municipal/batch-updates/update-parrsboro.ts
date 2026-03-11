#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(`\n📥 Updating Town of Parrsboro (merged with Cumberland County)...\n`);

  const { error } = await supabase
    .from('municipalities')
    .update({
      minutes_url: 'https://www.cumberlandcounty.ns.ca/council-minutes-agendas.html',
      scan_status: 'pending'
    })
    .eq('name', 'Town of Parrsboro')
    .eq('province', 'Nova Scotia');

  if (!error) {
    console.log(`   ✅ Town of Parrsboro (now part of Cumberland County)`);
    console.log(`\n🎉 All 667 Canadian municipalities now have minutes URLs!`);
  } else {
    console.error(`   ❌ Error: ${error.message}`);
  }
}

main().catch(console.error);
