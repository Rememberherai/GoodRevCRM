#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 951-1000 (excluding unincorporated communities)
  // Unincorporated: Levittown PA, Florin CA, Country Club FL, North Bethesda MD, Catalina Foothills AZ
  // East Honolulu HI, McLean VA, Rowland Heights CA, El Dorado Hills CA, North Highlands CA
  // Antelope CA, University FL, Tuckahoe VA

  { name: 'Spring Hill', province: 'Tennessee', url: 'https://www.springhilltn.org/AgendaCenter' },
  { name: 'Everett', province: 'Massachusetts', url: 'https://cityofeverett.com/city-hall/departments/city-clerk/agenda/' },
  { name: 'Roswell', province: 'New Mexico', url: 'https://www.roswell-nm.gov/AgendaCenter' },
  { name: 'Leesburg', province: 'Virginia', url: 'https://www.leesburgva.gov/government/mayor-council/current-council-agenda' },
  { name: 'Rancho Santa Margarita', province: 'California', url: 'https://www.cityofrsm.org/AgendaCenter' },
  { name: 'Titusville', province: 'Florida', url: 'https://titusville.com/AgendaCenter' },
  { name: 'Glenview', province: 'Illinois', url: 'https://www.glenview.il.us/meetings' },
  { name: 'Wauwatosa', province: 'Wisconsin', url: 'https://www.wauwatosa.net/government/agendas-minutes' },
  { name: 'Stillwater', province: 'Oklahoma', url: 'https://stillwater.org/agenda/org/citycouncil' },
  { name: 'Minot', province: 'North Dakota', url: 'https://www.minotnd.gov/AgendaCenter' },
  { name: 'La Mirada', province: 'California', url: 'https://www.cityoflamirada.org/about-us/agendas-and-minutes' },
  { name: 'Wilson', province: 'North Carolina', url: 'https://www.wilsonnc.org/residents/all-departments/administration/agendas' },
  { name: 'Newark', province: 'California', url: 'https://www.newark.org/departments/city-manager-s-office/2022-meetings-agendas-minutes-copy' },
  { name: 'Roseville', province: 'Michigan', url: 'https://www.roseville-mi.gov/AgendaCenter' },
  { name: 'East Lansing', province: 'Michigan', url: 'https://www.cityofeastlansing.com/AgendaCenter' },
  { name: 'Mentor', province: 'Ohio', url: 'https://cityofmentor.com/departments/city-council/' },
  { name: 'Bothell', province: 'Washington', url: 'https://www.bothellwa.gov/AgendaCenter' },
  { name: 'San Luis Obispo', province: 'California', url: 'https://www.slocity.org/government/mayor-and-city-council/agendas-and-minutes' },
  { name: 'Burleson', province: 'Texas', url: 'https://burlesontx.com/agendas' },
  { name: 'East Providence', province: 'Rhode Island', url: 'https://eastprovidenceri.gov/agendas-minutes' },
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
