#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1191-1230
  // Unincorporated: Severna Park MD, Mission Bend TX, Land O' Lakes FL, La Presa CA
  // La Puente CA, Stanton CA, Parkland WA, East Meadow NY, Mechanicsville VA
  // Sun City AZ, Richmond West FL

  { name: 'Urbana', province: 'Illinois', url: 'https://urbanaillinois.us/cc/meetings' },
  { name: 'Olive Branch', province: 'Mississippi', url: 'https://www.obms.us/AgendaCenter/Board-of-Aldermen-6/' },
  { name: 'Keizer', province: 'Oregon', url: 'https://www.keizer.org/meetings' },
  { name: 'Roy', province: 'Utah', url: 'https://www.royutah.org/government/agendas___minutes/planning_commission.php' },
  { name: 'Issaquah', province: 'Washington', url: 'https://www.issaquahwa.gov/319/Meetings' },
  { name: 'Westerville', province: 'Ohio', url: 'https://www.westerville.org/government/clerk-of-council/2025-agendas-and-minutes' },
  { name: 'Grants Pass', province: 'Oregon', url: 'https://grantspassoregon.gov/AgendaCenter/City-Council-Meetings-16' },
  { name: 'Lynnwood', province: 'Washington', url: 'https://www.lynnwoodwa.gov/Government/City-Council/City-Council-Meetings' },
  { name: 'Calexico', province: 'California', url: 'https://www.calexico.ca.gov/councilagendas' },
  { name: 'Royal Palm Beach', province: 'Florida', url: 'https://www.royalpalmbeachfl.gov/meetings' },
  { name: 'Bettendorf', province: 'Iowa', url: 'https://www.bettendorf.org/government/agendas,_minutes,_audio_video/city_council.php' },
  { name: 'Pacifica', province: 'California', url: 'https://www.cityofpacifica.org/government/city-council/city-council-agendas' },
  { name: 'Cottage Grove', province: 'Minnesota', url: 'https://www.cottagegrovemn.gov/686/Agendas-Minutes' },
  { name: 'Clovis', province: 'New Mexico', url: 'https://www.cityofclovis.org/city-commission/' },
  { name: 'Vestavia Hills', province: 'Alabama', url: 'https://vhal.org/government/agendas/agendas-and-agenda-packets/' },
  { name: 'Holyoke', province: 'Massachusetts', url: 'https://www.holyoke.org/departments/city-council/' },
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
