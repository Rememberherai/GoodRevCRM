#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetStuckScans() {
  console.log('\n🔄 Resetting municipalities stuck in "scanning" status...\n');

  const { data, error } = await supabase
    .from('municipalities')
    .update({
      scan_status: 'pending',
      scan_error: null,
    })
    .eq('country', 'USA')
    .eq('scan_status', 'scanning')
    .select('name, province');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Reset ${data?.length || 0} municipalities back to pending:\n`);

  if (data && data.length > 0) {
    // Group by province for cleaner output
    const byProvince = data.reduce((acc, m) => {
      if (!acc[m.province]) acc[m.province] = [];
      acc[m.province].push(m.name);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(byProvince).forEach(([province, cities]) => {
      console.log(`  ${province}: ${cities.length} cities`);
    });
  }

  console.log('\n✅ Ready to resume scanning with:');
  console.log('   npx tsx scripts/scan-municipal-minutes.ts\n');
}

resetStuckScans();
