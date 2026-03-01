#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1266-1290
  // Unincorporated: Carrollwood FL, Olney MD, Orangevale CA, Randallstown MD

  { name: 'Upper Arlington', province: 'Ohio', url: 'https://www.uaoh.net/' },
  { name: 'DeLand', province: 'Florida', url: 'https://www.deland.org/129/Agendas-Minutes' },
  { name: 'Temple City', province: 'California', url: 'https://templecity.us/117/Agendas-Minutes' },
  { name: 'Wildomar', province: 'California', url: 'https://www.cityofwildomar.org/129/Agendas-Videos-Watch-Live' },
  { name: 'Claremont', province: 'California', url: 'https://www.ci.claremont.ca.us/government/departments-divisions/city-clerk-s-office/agenda-materials-meetings' },
  { name: 'Georgetown', province: 'Kentucky', url: 'https://www.georgetownky.gov/AgendaCenter' },
  { name: 'Oak Creek', province: 'Wisconsin', url: 'https://www.oakcreekwi.org/government/boards-commissions-committees/plan-commission/' },
  { name: 'Moorpark', province: 'California', url: 'https://www.moorparkca.gov/327/City-CouncilSuccessor-Agency-Meeting-Age' },
  { name: 'Merrillville', province: 'Indiana', url: 'https://www.merrillville.in.gov/government/town_council/town_council_meetings.php' },
  { name: 'Estero', province: 'Florida', url: 'https://estero-fl.gov/meetings/' },
  { name: 'Roseville', province: 'Minnesota', url: 'https://www.cityofroseville.com/3765/Agendas-and-Meetings' },
  { name: 'Dunedin', province: 'Florida', url: 'https://www.dunedin.gov/Your-Government/City-Clerk/Commission-Meetings-Agendas' },
  { name: 'Farmers Branch', province: 'Texas', url: 'https://www.farmersbranchtx.gov/596/Agendas-Minutes' },
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
