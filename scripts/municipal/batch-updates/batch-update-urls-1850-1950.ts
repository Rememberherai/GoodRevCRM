#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1800-1850
  // Unincorporated/CDPs: Okemos MI, Bay Point CA, South Bradenton FL, Northdale FL,
  // Apollo Beach FL, Fort Hood TX, Dix Hills NY, Port St. John FL

  { name: 'Belvidere', province: 'Illinois', url: 'https://ci.belvidere.il.us/city-government/cityclerk/' },
  { name: 'Watertown', province: 'New York', url: 'https://www.watertown-ny.gov/meetings/330/' },
  { name: 'Reedley', province: 'California', url: 'https://reedley.ca.gov/city-council/city-council-agendas/' },
  { name: 'Tarpon Springs', province: 'Florida', url: 'https://www.ctsfl.us/agendacenter' },
  { name: 'Barstow', province: 'California', url: 'https://www.barstowca.org/government/city-clerk-records/agenda-and-minutes' },
  { name: 'Franklin', province: 'Indiana', url: 'https://www.franklin.in.gov/meetings/' },
  { name: 'Newberg', province: 'Oregon', url: 'https://www.newbergoregon.gov/government/agendas_and_minutes/index.php' },
  { name: 'Sandusky', province: 'Ohio', url: 'https://www.cityofsandusky.com/city_commission/agendas___minutes.php' },
  { name: 'Norton Shores', province: 'Michigan', url: 'https://nortonshores.org/council-meetings' },
  { name: 'University Park', province: 'Texas', url: 'https://www.uptexas.org/327/Council-Agendas-Minutes-Videos' },
  { name: 'Avon Lake', province: 'Ohio', url: 'https://www.avonlake.org/city-council/agendas-minutes' },
  { name: 'Morton Grove', province: 'Illinois', url: 'https://www.mortongroveil.org/government/agendas-minutes/' },
  { name: 'Wyandotte', province: 'Michigan', url: 'https://www.wyandotte.net/front_desk/agenda_and_minutes/city_council.php' },
  { name: 'Muskego', province: 'Wisconsin', url: 'https://www.muskego.wi.gov/government/boards_commissions/common_council.php' },
  { name: 'Romulus', province: 'Michigan', url: 'https://www.romulusgov.com/AgendaCenter' },
  { name: 'Norfolk', province: 'Nebraska', url: 'https://norfolkne.gov/government/admin-mayor-and-council/agenda-minutes-and-videos/' },
  { name: 'Marysville', province: 'Ohio', url: 'https://www.marysvilleohio.org/277/Agendas-Minutes' },
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
