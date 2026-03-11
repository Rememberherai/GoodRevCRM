#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Count municipalities WITH minutes URLs
  const { count: withMinutes } = await supabase
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .not('minutes_url', 'is', null);

  // Count municipalities WITHOUT minutes URLs
  const { count: withoutMinutes } = await supabase
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .is('minutes_url', null);

  // Get province statistics using aggregation
  const { data: provinces } = await supabase
    .from('municipalities')
    .select('province')
    .order('province');

  const uniqueProvinces = [...new Set(provinces?.map(p => p.province) || [])];

  console.log('\n📊 Municipality Status:\n');
  console.log(`✅ With minutes URLs: ${withMinutes}`);
  console.log(`❌ Without minutes URLs: ${withoutMinutes}`);
  console.log(`📈 Total: ${(withMinutes || 0) + (withoutMinutes || 0)}\n`);

  console.log('\n📋 Breakdown by Province (sorted by most needing minutes):\n');

  const stats = [];

  for (const province of uniqueProvinces) {
    const { count: total } = await supabase
      .from('municipalities')
      .select('id', { count: 'exact', head: true })
      .eq('province', province);

    const { count: withMins } = await supabase
      .from('municipalities')
      .select('id', { count: 'exact', head: true })
      .eq('province', province)
      .not('minutes_url', 'is', null);

    const withoutMins = (total || 0) - (withMins || 0);

    stats.push({ province, total, withMins, withoutMins });
  }

  stats.sort((a, b) => b.withoutMins - a.withoutMins);

  for (const { province, total, withMins, withoutMins } of stats) {
    console.log(`   ${province}:`);
    console.log(`      Total: ${total}`);
    console.log(`      ✅ With minutes: ${withMins}`);
    console.log(`      ❌ Need minutes: ${withoutMins}\n`);
  }
}

main().catch(console.error);
