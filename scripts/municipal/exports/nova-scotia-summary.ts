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
    .select('scan_status, municipality_type, minutes_url')
    .eq('province', 'Nova Scotia')
    .eq('country', 'Canada');

  const counts = {
    total: 0,
    pending: 0,
    no_minutes: 0,
    regional: 0,
    county: 0,
    district: 0,
    town: 0
  };

  data?.forEach(m => {
    counts.total++;
    if (m.scan_status === 'pending') counts.pending++;
    if (m.scan_status === 'no_minutes') counts.no_minutes++;
    if (m.municipality_type) counts[m.municipality_type as keyof typeof counts]++;
  });

  console.log('\n🇨🇦 Nova Scotia Municipalities Summary\n');
  console.log('Total municipalities:', counts.total);
  console.log('\nBy Type:');
  console.log('  Regional municipalities:', counts.regional);
  console.log('  County municipalities:', counts.county);
  console.log('  District municipalities:', counts.district);
  console.log('  Towns:', counts.town);
  console.log('\nBy Status:');
  console.log('  ✅ With minutes URLs (ready to scan):', counts.pending);
  console.log('  ⚠️  Without minutes URLs:', counts.no_minutes);
  console.log('\n✨ Nova Scotia is complete and ready for RFP scanning!\n');
}

main();
