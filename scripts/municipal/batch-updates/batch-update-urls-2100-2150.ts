#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1950-1974
  // Unincorporated/CDPs: Taylors SC, Jasmine Estates FL, Linda CA,
  // Kapolei HI (part of Honolulu), Allison Park PA, Ballenger Creek MD,
  // Eastmont WA
  // Failed searches: Waverly MI

  { name: 'Johnston', province: 'Iowa', url: 'https://www.cityofjohnston.com/AgendaCenter' },
  { name: 'Farragut', province: 'Tennessee', url: 'https://www.townoffarragut.org/AgendaCenter' },
  { name: 'Griffin', province: 'Georgia', url: 'https://www.cityofgriffin.com/government/agendas-after-agendas' },
  { name: 'New Brighton', province: 'Minnesota', url: 'https://www.newbrightonmn.gov/AgendaCenter' },
  { name: 'Farmington', province: 'Minnesota', url: 'https://www.farmingtonmn.gov/AgendaCenter' },
  { name: 'Loves Park', province: 'Illinois', url: 'https://cityoflovespark.com/minutes-agendas/' },
  { name: 'Van Buren', province: 'Arkansas', url: 'https://www.vanburencity.org/AgendaCenter' },
  { name: 'Clinton', province: 'Utah', url: 'http://clintoncity.com/AgendaCenter' },
  { name: 'Simpsonville', province: 'South Carolina', url: 'https://www.simpsonville.com/meetings/' },
  { name: 'Christiansburg', province: 'Virginia', url: 'https://www.christiansburg.org/AgendaCenter' },
  { name: 'Trotwood', province: 'Ohio', url: 'https://trotwood.org/government/city-council/' },
  { name: 'Crystal', province: 'Minnesota', url: 'https://www.crystalmn.gov/government/city_council/meetings_and_work_sessions' },
  { name: 'Mountain House', province: 'California', url: 'https://www.mountainhouseca.gov/186/Agendas-Minutes-Archives-Live-Streaming' },
  { name: 'Laguna Beach', province: 'California', url: 'https://www.lagunabeachcity.net/live-here/city-council/meetings-agendas-and-minutes' },
  { name: 'Garden City', province: 'New York', url: 'https://www.gardencityny.net/AgendaCenter' },
  { name: 'Millbrae', province: 'California', url: 'https://www.ci.millbrae.ca.us/AgendaCenter' },
];

async function batchUpdate() {
  console.log(`\n💾 Batch Updating ${urlUpdates.length} Municipality URLs\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const update of urlUpdates) {
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
      .select('id');

    if (error) {
      console.error(`❌ ${update.name}, ${update.province}:`, error.message);
      errorCount++;
    } else if (!data || data.length === 0) {
      console.error(`❌ ${update.name}, ${update.province}: Not found in database`);
      errorCount++;
    } else {
      console.log(`✅ ${update.name}, ${update.province}`);
      successCount++;
    }
  }

  console.log(`\n==================================`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
