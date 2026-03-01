#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1250-1270
  // Unincorporated: Kendall West FL, Kearns UT, Elmont NY, Oakton VA, South Valley NM
  // Chillum MD, Princeton FL, Winchester NV, Central Islip NY, Commack NY
  // South Miami Heights FL, Egypt Lake-Leto FL, Buenaventura Lakes FL

  { name: 'Pleasant Grove', province: 'Utah', url: 'https://www.pgcityutah.gov/government/agendas_minutes.php' },
  { name: 'Leavenworth', province: 'Kansas', url: 'https://www.leavenworthks.org/citycommission/page/city-commission-regular-meeting-121' },
  { name: 'Muskogee', province: 'Oklahoma', url: 'https://www.muskogeeonline.org/government/city_council/agendas_and_minutes.php' },
  { name: 'Oregon City', province: 'Oregon', url: 'https://www.orcity.org/1709/Agendas-Videos-and-Minutes' },
  { name: 'Bartlesville', province: 'Oklahoma', url: 'https://www.cityofbartlesville.org/city-government/city-council/meeting-agendas/' },
  { name: 'Saratoga Springs', province: 'Utah', url: 'https://www.saratogaspringscity.com/707/City-Council-Meeting-Schedule' },
  { name: 'Richfield', province: 'Minnesota', url: 'https://www.richfieldmn.gov/city_government/city_council/agendas_and_minutes.php' },
  { name: 'Tucker', province: 'Georgia', url: 'https://www.tuckerga.gov/your-government/agendas/' },
  { name: 'Franklin', province: 'Wisconsin', url: 'https://www.franklinwi.gov/Departments/Meeting-Agendas-and-Minutes.htm' },
  { name: 'Lewiston', province: 'Maine', url: 'https://www.lewistonmaine.gov/105/Mayor-City-Council' },
  { name: 'Beloit', province: 'Wisconsin', url: 'https://www.beloitwi.gov/council' },
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
