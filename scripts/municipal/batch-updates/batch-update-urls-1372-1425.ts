#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1372-1425
  // Unincorporated: Ken Caryl CO, South Riding VA, Timberwood Park TX, Martinez GA (Columbia County)
  // Pikesville MD, West Little River FL, Fallbrook CA, Pueblo West CO, Spring Valley NY (2 entries)
  // Uniondale NY, East Lake FL, Redan GA, Kiryas Joel NY

  { name: 'Cooper City', province: 'Florida', url: 'https://www.coopercityfl.org/city-commission-agendas-minutes' },
  { name: 'Woodstock', province: 'Georgia', url: 'https://www.woodstockga.gov/your_government/meetings_agendas_and_minutes.php' },
  { name: 'Valparaiso', province: 'Indiana', url: 'https://www.ci.valparaiso.in.us/AgendaCenter/City-Council-7' },
  { name: 'Parkland', province: 'Florida', url: 'https://cityofparkland.org/1434/24672/Agendas-Minutes' },
  { name: 'Walla Walla', province: 'Washington', url: 'https://www.wallawallawa.gov/government/city-council/agendas-minutes' },
  { name: 'Leawood', province: 'Kansas', url: 'https://www.leawood.org/AgendaCenter' },
  { name: 'Rexburg', province: 'Idaho', url: 'https://www.rexburg.org/page/city-council-agendas' },
  { name: 'Menlo Park', province: 'California', url: 'https://www.menlopark.gov/Agendas-and-minutes' },
  { name: 'Cottonwood Heights', province: 'Utah', url: 'https://www.cottonwoodheights.utah.gov/your-government/elected-officials/council-meeting-agendas-and-minutes' },
  { name: 'Kearney', province: 'Nebraska', url: 'https://cityofkearney.org/482/Council-Agenda-Minutes' },
  { name: 'Sahuarita', province: 'Arizona', url: 'https://sahuaritaaz.gov/1252/Agendas-Minutes' },
  { name: 'Crown Point', province: 'Indiana', url: 'https://www.crownpoint.in.gov/agendacenter' },
  { name: 'Foster City', province: 'California', url: 'https://www.fostercity.org/agendasandminutes' },
  { name: 'Englewood', province: 'Colorado', url: 'https://www.englewoodco.gov/government/city-council/agendas-and-minutes' },
  { name: 'Glendale Heights', province: 'Illinois', url: 'https://www.glendaleheights.org/board/agendas.asp' },
  { name: 'Bethel Park', province: 'Pennsylvania', url: 'https://bethelpark.net/' },
  { name: 'Dana Point', province: 'California', url: 'https://www.danapoint.org/department/city-council/meetings-agendas-minutes' },
  { name: 'Los Gatos', province: 'California', url: 'https://www.losgatosca.gov/13/Agendas-Minutes' },
  { name: 'Brooklyn Center', province: 'Minnesota', url: 'https://www.cityofbrooklyncenter.org/' },
  { name: 'Petersburg', province: 'Virginia', url: 'https://www.petersburgva.gov/' },
  { name: 'Goldsboro', province: 'North Carolina', url: 'https://www.goldsboronc.gov/' },
  { name: 'Redmond', province: 'Oregon', url: 'https://www.redmondoregon.gov/' },
  { name: 'Fuquay-Varina', province: 'North Carolina', url: 'https://www.fuquay-varina.org/' },
  { name: 'Alabaster', province: 'Alabama', url: 'https://www.cityofalabaster.com/' },
  { name: 'Gillette', province: 'Wyoming', url: 'https://www.gillettewy.gov/' },
  { name: 'Kennesaw', province: 'Georgia', url: 'https://www.kennesaw-ga.gov/' },
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
