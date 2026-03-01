#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFailed() {
  // Get all USA municipalities with scan status breakdown
  const { data: allData } = await supabase
    .from('municipalities')
    .select('scan_status, name, province')
    .eq('country', 'USA')
    .not('minutes_url', 'is', null);

  const byStatus = allData?.reduce((acc, m) => {
    acc[m.scan_status] = (acc[m.scan_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log('\n📊 USA Municipalities Scan Status:\n');
  console.log('Total:', allData?.length || 0);
  console.log('\nBy Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Get failed municipalities
  const { data: failed } = await supabase
    .from('municipalities')
    .select('name, province, minutes_url, scan_error')
    .eq('country', 'USA')
    .eq('scan_status', 'failed')
    .order('province')
    .order('name');

  if (failed && failed.length > 0) {
    console.log(`\n❌ Failed Municipalities (${failed.length}):\n`);
    failed.forEach((m) => {
      console.log(`  ${m.name}, ${m.province}`);
      if (m.scan_error) {
        console.log(`     Error: ${m.scan_error}`);
      }
    });
  }

  // Get no_minutes municipalities
  const { data: noMinutes } = await supabase
    .from('municipalities')
    .select('name, province, minutes_url')
    .eq('country', 'USA')
    .eq('scan_status', 'no_minutes')
    .order('province')
    .order('name');

  if (noMinutes && noMinutes.length > 0) {
    console.log(`\n⚠️  No Minutes Found (${noMinutes.length}):\n`);
    noMinutes.forEach((m) => {
      console.log(`  ${m.name}, ${m.province}`);
    });
  }

  console.log('');
}

checkFailed();
