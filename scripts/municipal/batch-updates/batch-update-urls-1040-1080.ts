#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1040-1080
  // Unincorporated: Whitney NV, Ashburn VA, Lake Ridge VA

  { name: 'Bountiful', province: 'Utah', url: 'https://www.bountifulutah.gov/agenda-minutes' },
  { name: 'Littleton', province: 'Colorado', url: 'https://www.littletongov.org/connect-with-us/calendars/public-meetings-calendar/' },
  { name: 'Huntsville', province: 'Texas', url: 'https://www.huntsvilletx.gov/AgendaCenter' },
  { name: 'Cleveland Heights', province: 'Ohio', url: 'https://www.clevelandheights.com/1142/2022-Agendas-and-Minutes' },
  { name: 'Morgan Hill', province: 'California', url: 'https://www.morgan-hill.ca.gov/149/Agendas-Minutes' },
  { name: 'Keller', province: 'Texas', url: 'https://www.cityofkeller.com/services/city-council' },
  { name: 'Kyle', province: 'Texas', url: 'https://www.cityofkyle.com/meetings/recent' },
  { name: 'Little Elm', province: 'Texas', url: 'https://www.littleelm.org/1258/Agendas-Minutes-Videos' },
  { name: 'Prescott', province: 'Arizona', url: 'https://prescott-az.gov/prescott-city-clerk/council-meetings/' },
  { name: 'Sayreville', province: 'New Jersey', url: 'https://www.sayreville.com/cn/meetings/?tpid=8645' },
  { name: 'Urbandale', province: 'Iowa', url: 'https://www.urbandale.org/AgendaCenter' },
  { name: 'Sierra Vista', province: 'Arizona', url: 'https://www.sierravistaaz.gov/government/city-council/council-meetings' },
  { name: 'Cutler Bay', province: 'Florida', url: 'https://pub-cutlerbay-fl.escribemeetings.com/' },
  { name: 'Palm Springs', province: 'California', url: 'https://www.palmspringsca.gov/government/city-clerk/city-council-meetings' },
  { name: 'Riverton', province: 'Utah', url: 'https://www.rivertoncity.com/index.php/government/city_council/' },
  { name: 'North Lauderdale', province: 'Florida', url: 'https://www.nlauderdale.org/quick_links/meetings_and_minutes/index.php' },
  { name: 'Fairfield', province: 'Ohio', url: 'https://www.fairfield-city.org/AgendaCenter' },
  { name: 'West Lafayette', province: 'Indiana', url: 'https://www.westlafayette.in.gov/government/office-of-the-clerk/agendas-and-minutes-352' },
  { name: 'Goose Creek', province: 'South Carolina', url: 'https://www.cityofgoosecreek.com/government/mayor-and-city-council/2021-agenda-and-minutes' },
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
