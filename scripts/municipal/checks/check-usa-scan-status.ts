#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatus() {
  const { data } = await supabase
    .from('municipalities')
    .select('scan_status, country')
    .eq('country', 'USA')
    .not('minutes_url', 'is', null);

  const byStatus = data?.reduce((acc, m) => {
    acc[m.scan_status] = (acc[m.scan_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log('\n📊 USA Municipalities with URLs - Status Breakdown:\n');
  console.log('Total:', data?.length || 0);
  console.log('\nBy Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('');
}

checkStatus();
