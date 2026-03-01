#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1425-1475
  // Unincorporated: Franklin Square NY, Centereach NY, Marrero LA, West Odessa TX,
  // Springfield VA, Fair Oaks CA, Bay Shore NY, Lake Magdalene FL, Sterling VA,
  // Oceanside NY, Lakeside FL, West Falls Church VA, Bel Air North MD, Orcutt CA,
  // Parkville MD, Milford Mill MD, Middle River MD, Drexel Heights AZ, Ferry Pass FL,
  // San Lorenzo CA, Granger IN, Austintown OH

  { name: 'Statesboro', province: 'Georgia', url: 'https://www.statesboroga.gov/mayor-council/agendas-minutes' },
  { name: 'North Olmsted', province: 'Ohio', url: 'https://north-olmsted.com/city-council/minutes/' },
  { name: 'Nacogdoches', province: 'Texas', url: 'https://www.ci.nacogdoches.tx.us/agendas' },
  { name: 'Canton', province: 'Georgia', url: 'https://www.cantonga.gov/government/city-council' },
  { name: 'Wheat Ridge', province: 'Colorado', url: 'https://www.ci.wheatridge.co.us/AgendaCenter' },
  { name: 'Harker Heights', province: 'Texas', url: 'https://www.harkerheights.gov/index.php/citycouncilmeetings' },
  { name: 'Rochester', province: 'New Hampshire', url: 'https://www.rochesternh.gov/minutes-and-agendas' },
  { name: 'Juneau', province: 'Alaska', url: 'https://juneau.org/assembly/assembly-minutes-and-agendas' },
  { name: 'Kingman', province: 'Arizona', url: 'https://www.cityofkingman.gov/government/agendas-minutes' },
  { name: 'Massillon', province: 'Ohio', url: 'https://massillonohio.gov/government/city-council/' },
  { name: 'Helena', province: 'Montana', url: 'https://www.helenamt.gov/Government/Helena-Citizens-Council/Agendas-and-Minutes' },
  { name: 'Lawndale', province: 'California', url: 'https://www.lawndalecity.org/government/departments/city_clerk_s_office/agendas_minutes' },
  { name: 'Desert Hot Springs', province: 'California', url: 'https://www.cityofdhs.org/city-council-agendas/' },
  { name: 'San Pablo', province: 'California', url: 'https://www.sanpabloca.gov/1400/City-CouncilLSA-Planning-Comm-AgendasMin' },
  { name: 'Windsor', province: 'Colorado', url: 'https://www.windsorgov.com/153/Agendas-and-Minutes' },
  { name: 'Bangor', province: 'Maine', url: 'https://www.bangormaine.gov/agendas' },
  { name: 'Ithaca', province: 'New York', url: 'https://www.cityofithaca.org/AgendaCenter' },
  { name: 'Clearfield', province: 'Utah', url: 'http://www.clearfieldcity.org/government/mayor_city_council' },
  { name: 'Holladay', province: 'Utah', url: 'https://cityofholladay.com/government/elected-officials/meetings-and-agendas/' },
  { name: 'Long Branch', province: 'New Jersey', url: 'https://www.longbranch.org/AgendaCenter' },
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
