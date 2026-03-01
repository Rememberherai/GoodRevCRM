#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1286-1310
  // Unincorporated: Westmont CA, Carrollwood FL, Olney MD, Orangevale CA, Randallstown MD
  // Oakville MO, San Luis AZ, Owings Mills MD, Spanaway WA

  { name: 'Calumet City', province: 'Illinois', url: 'https://calumetcity.org/meeting-links/' },
  { name: 'Marion', province: 'Ohio', url: 'https://www.marionohio.us/AgendaCenter/City-Council-7' },
  { name: 'Addison', province: 'Illinois', url: 'https://aglc.addison-il.org/CityViewPortal/' },
  { name: 'Lauderdale Lakes', province: 'Florida', url: 'https://www.lauderdalelakes.org/591/Commission-Meetings' },
  { name: 'Richmond', province: 'Indiana', url: 'https://www.richmondindiana.gov/meetings' },
  { name: 'West Hollywood', province: 'California', url: 'https://www.weho.org/city-government/city-council/council-agendas' },
  { name: 'Gahanna', province: 'Ohio', url: 'https://www.gahanna.gov/191/City-Council' },
  { name: 'Meridian', province: 'Mississippi', url: 'https://meridianms.org/government/city-council/minutes/' },
  { name: 'Norristown', province: 'Pennsylvania', url: 'https://www.norristown.org/129/Agendas-Minutes' },
  { name: 'Manhattan Beach', province: 'California', url: 'https://www.citymb.info/' },
  { name: 'La Porte', province: 'Texas', url: 'https://www.laportetx.gov/' },
  { name: 'Inver Grove Heights', province: 'Minnesota', url: 'https://www.invergroveheights.org/' },
  { name: 'Hilliard', province: 'Ohio', url: 'https://www.hilliardohio.gov/' },
  { name: 'Sun Prairie', province: 'Wisconsin', url: 'https://www.cityofsunprairie.com/' },
  { name: 'Copperas Cove', province: 'Texas', url: 'https://www.copperascove.com/' },
  { name: 'Torrington', province: 'Connecticut', url: 'https://www.torringtonct.org/' },
  { name: 'El Mirage', province: 'Arizona', url: 'https://www.cityofelmirage.org/' },
  { name: 'Wildwood', province: 'Missouri', url: 'https://www.cityofwildwood.com/' },
  { name: 'San Juan', province: 'Texas', url: 'https://www.sanjuantexas.com/' },
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
