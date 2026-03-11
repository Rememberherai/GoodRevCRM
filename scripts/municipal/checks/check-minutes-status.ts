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

  // Get all municipalities to group by province
  const { data: byProvince } = await supabase
    .from('municipalities')
    .select('province, minutes_url')
    .order('province');

  const stats: Record<string, { total: number; withMinutes: number; withoutMinutes: number }> = {};

  byProvince?.forEach(m => {
    if (!stats[m.province]) {
      stats[m.province] = { total: 0, withMinutes: 0, withoutMinutes: 0 };
    }
    stats[m.province].total++;
    if (m.minutes_url) {
      stats[m.province].withMinutes++;
    } else {
      stats[m.province].withoutMinutes++;
    }
  });

  console.log('\n📊 Municipality Status:\n');
  console.log(`✅ With minutes URLs: ${withMinutes}`);
  console.log(`❌ Without minutes URLs: ${withoutMinutes}`);
  console.log(`📈 Total: ${(withMinutes || 0) + (withoutMinutes || 0)}\n`);

  console.log('\n📋 Breakdown by Province (sorted by most needing minutes):\n');
  Object.entries(stats)
    .sort((a, b) => b[1].withoutMinutes - a[1].withoutMinutes)
    .forEach(([province, data]) => {
      console.log(`   ${province}:`);
      console.log(`      Total: ${data.total}`);
      console.log(`      ✅ With minutes: ${data.withMinutes}`);
      console.log(`      ❌ Need minutes: ${data.withoutMinutes}\n`);
    });
}

main().catch(console.error);
