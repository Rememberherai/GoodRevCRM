#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1925-1949
  // Unincorporated/CDPs: Ashland CA, Chantilly VA, West Springfield VA,
  // Copiague NY, Pace FL
  // Failed searches: North Platte NE, Jacksonville Beach FL, Brookings SD, Johnston IA

  { name: 'South Elgin', province: 'Illinois', url: 'https://www.southelgin.com/government/village_board_of_trustees/index.php' },
  { name: 'Munster', province: 'Indiana', url: 'https://www.munster.org/council/' },
  { name: 'Yukon', province: 'Oklahoma', url: 'https://www.yukonok.gov/AgendaCenter' },
  { name: 'Highland', province: 'Indiana', url: 'https://highland.in.gov/highland-town-council-minutes-memos/' },
  { name: 'Saginaw', province: 'Texas', url: 'https://www.saginawtx.org/government/city_council/archived_agendas_minutes.php' },
  { name: 'Watauga', province: 'Texas', url: 'http://www.ci.watauga.tx.us/1403/Agendas-and-Minutes' },
  { name: 'Fountain Hills', province: 'Arizona', url: 'https://www.fh.az.gov/AgendaCenter' },
  { name: 'Kenmore', province: 'Washington', url: 'https://www.kenmorewa.gov/government/city-council' },
  { name: 'Roseburg', province: 'Oregon', url: 'https://www.cityofroseburg.org/your-government/mayor-council/council-agendas' },
  { name: 'Maywood', province: 'Illinois', url: 'https://maywood-il.org/Reference-Desk/Agendas-and-Minutes.aspx' },
  { name: 'Patterson', province: 'California', url: 'https://www.ci.patterson.ca.us/agendacenter' },
  { name: 'Maple Heights', province: 'Ohio', url: 'https://mapleheightsohio.gov/government/city-council/' },
  { name: 'Rock Springs', province: 'Wyoming', url: 'https://www.rswy.net/document_center/agendas_minutes.php' },
  { name: 'Happy Valley', province: 'Oregon', url: 'https://www.happyvalleyor.gov/city-hall/agendas-minutes-packets/' },
  { name: 'Waukee', province: 'Iowa', url: 'https://www.waukee.org/AgendaCenter' },
  { name: 'Calabasas', province: 'California', url: 'https://www.cityofcalabasas.com/government/city-council/current-agenda' },
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
