#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateUrls() {
  const updates = [
    { name: 'Miami', province: 'Florida', url: 'https://www.miami.gov/My-Government/Meeting-Calendars-Agendas-and-Comments' },
    { name: 'Dallas', province: 'Texas', url: 'https://cityofdallas.legistar.com/' },
    { name: 'Houston', province: 'Texas', url: 'https://houston.novusagenda.com/agendapublic/' },
    { name: 'Philadelphia', province: 'Pennsylvania', url: 'https://phila.legistar.com/calendar.aspx' },
  ];

  console.log('\n💾 Updating USA Municipality URLs\n');

  for (const update of updates) {
    const { data, error } = await supabase
      .from('municipalities')
      .update({
        minutes_url: update.url,
        scan_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('name', update.name)
      .eq('province', update.province)
      .eq('country', 'USA')
      .select('id, name, province');

    if (error) {
      console.error(`❌ Failed to update ${update.name}:`, error.message);
    } else {
      console.log(`✅ Updated ${update.name}, ${update.province}`);
      console.log(`   URL: ${update.url}`);
      console.log(`   Records updated: ${data?.length || 0}\n`);
    }
  }

  // Check for Philadelphia duplicates
  const { data: phillyDupes } = await supabase
    .from('municipalities')
    .select('id, name, province, created_at, minutes_url')
    .eq('name', 'Philadelphia')
    .eq('province', 'Pennsylvania')
    .eq('country', 'USA');

  if (phillyDupes && phillyDupes.length > 1) {
    console.log(`⚠️  Found ${phillyDupes.length} Philadelphia entries:`);
    phillyDupes.forEach((p) => console.log(`   - ID: ${p.id}, created: ${p.created_at}`));
  }
}

updateUrls().catch(console.error);
