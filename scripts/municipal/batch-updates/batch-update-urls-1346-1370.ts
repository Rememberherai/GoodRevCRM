#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1346-1370
  // Unincorporated: Dakota Ridge CO, Oildale CA, Prairieville LA, New City NY,
  // Huntington Station NY, Merritt Island FL, Golden Glades FL, Ken Caryl CO

  { name: 'Fairborn', province: 'Ohio', url: 'https://www.fairbornoh.gov/government/city_council/agendas___minutes.php' },
  { name: 'Butte', province: 'Montana', url: 'https://www.co.silverbow.mt.us/agendacenter' },
  { name: 'Mason', province: 'Ohio', url: 'http://www.masonoh.org/city-government/city-council/agendas-minutes/' },
  { name: 'Oswego', province: 'Illinois', url: 'https://www.oswegoil.org/government/agendas-minutes' },
  { name: 'Gadsden', province: 'Alabama', url: 'https://www.cityofgadsden.com/AgendaCenter' },
  { name: 'Plainfield', province: 'Indiana', url: 'https://www.townofplainfield.com/AgendaCenter/Town-Council-7' },
  { name: 'Manitowoc', province: 'Wisconsin', url: 'https://www.manitowoc.org/89/Agendas-Minutes' },
  { name: 'Lufkin', province: 'Texas', url: 'https://www.cityoflufkin.com/government/council_webcasts.php' },
  { name: 'Cedar City', province: 'Utah', url: 'https://www.cedarcityut.gov/AgendaCenter/City-Council-3' },
  { name: 'Deer Park', province: 'Texas', url: 'https://www.deerparktx.gov/2205/Regular-Meeting-Agenda-and-Minutes' },
  { name: 'McMinnville', province: 'Oregon', url: 'https://www.mcminnvilleoregon.gov/citycouncil/page/upcoming-council-agendas' },
  { name: 'Woodridge', province: 'Illinois', url: 'https://www.vil.woodridge.il.us/index.aspx?NID=197' },
  { name: 'Eastpointe', province: 'Michigan', url: 'https://eastpointemi.gov/government/mayor_and_council/index.php' },
  { name: 'Cookeville', province: 'Tennessee', url: 'https://www.cookeville-tn.gov/AgendaCenter' },
  { name: 'Westlake', province: 'Ohio', url: 'https://www.cityofwestlake.org/AgendaCenter/City-Council-2/' },
  { name: 'Lewiston', province: 'Idaho', url: 'https://www.cityoflewiston.org/' },
  { name: 'Bell', province: 'California', url: 'https://www.cityofbell.org/' },
  { name: 'Midlothian', province: 'Texas', url: 'https://www.midlothian.tx.us/' },
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
