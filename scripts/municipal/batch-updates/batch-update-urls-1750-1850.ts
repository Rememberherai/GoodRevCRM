#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1750-1850
  // Unincorporated/CDPs: Holt MI, North Tustin CA, Ives Estates FL, Cloverleaf TX,
  // Mill Creek East WA, Ladera Ranch CA, Palm River-Clair Mel FL, Palm City FL,
  // Keystone FL, Terrytown LA, Silver Springs Shores FL, Fairland MD, Cave Spring VA,
  // Bayonet Point FL, Okemos MI, Fort Hood TX, Dix Hills NY, Port St. John FL,
  // Wright FL, Northdale FL, South Bradenton FL, Apollo Beach FL

  { name: 'Colleyville', province: 'Texas', url: 'https://www.colleyville.com/government/meeting-agendas-packets-and-minutes' },
  { name: 'Camas', province: 'Washington', url: 'https://www.cityofcamas.us/meetings' },
  { name: 'Rockville Centre', province: 'New York', url: 'http://www.rvcny.us/VillageDocuments.html' },
  { name: 'West Melbourne', province: 'Florida', url: 'https://www.westmelbourne.org/AgendaCenter/City-Council-1' },
  { name: 'Forest Grove', province: 'Oregon', url: 'https://forestgrove-or.gov/city-hall/city-council-and-mayor/city-council-agendas-and-minutes.html' },
  { name: 'Stevens Point', province: 'Wisconsin', url: 'https://stevenspoint.com/1317/AgendasMinutesVideos' },
  { name: 'Chanhassen', province: 'Minnesota', url: 'https://www.ci.chanhassen.mn.us/agendas' },
  { name: 'Rosemount', province: 'Minnesota', url: 'https://www.ci.rosemount.mn.us/AgendaCenter' },
  { name: 'Mercer Island', province: 'Washington', url: 'http://www.mercergov.org/councilmeetings' },
  { name: 'Clayton', province: 'North Carolina', url: 'https://www.townofclaytonnc.org/129/Agendas-Minutes' },
  { name: 'Elk River', province: 'Minnesota', url: 'https://elkrivermn.gov/285/Agendas-and-Minutes' },
  { name: 'Hazelwood', province: 'Missouri', url: 'https://www.hazelwoodmo.org/588/Agenda-and-Minutes' },
  { name: 'Xenia', province: 'Ohio', url: 'https://www.ci.xenia.oh.us/AgendaCenter/City-Council-2' },
  { name: 'Galt', province: 'California', url: 'https://www.ci.galt.ca.us/city-departments/city-council/meeting-agendas-and-minutes' },
  { name: 'Lafayette', province: 'California', url: 'https://www.lovelafayette.org/city-hall/city-council/city-council-meetings' },
  { name: 'Derby', province: 'Kansas', url: 'http://www.derbyweb.com/534/Agendas-Minutes' },
  { name: 'Staunton', province: 'Virginia', url: 'https://www.ci.staunton.va.us/agendas-minutes' },
  { name: 'Florence', province: 'Arizona', url: 'https://www.florenceaz.gov/town-council/' },
  { name: 'Moscow', province: 'Idaho', url: 'https://www.ci.moscow.id.us/581/Agendas-and-Minutes' },
  { name: 'Salem', province: 'Virginia', url: 'https://www.salemva.gov/757/Agenda-Portal' },
  { name: 'Newport', province: 'Rhode Island', url: 'https://opengov.sos.ri.gov/OpenMeetingsPublic/OpenMeetingDashboard?EntityID=2181' },
  { name: 'Barberton', province: 'Ohio', url: 'https://www.cityofbarberton.com/AgendaCenter' },
  { name: 'Pooler', province: 'Georgia', url: 'https://www.pooler-ga.gov/government/public-meetings/' },
  { name: 'Edwardsville', province: 'Illinois', url: 'https://www.cityofedwardsville.com/AgendaCenter' },
  { name: 'De Pere', province: 'Wisconsin', url: 'https://www.de-pere.org/department/board.php?structureid=45' },
  { name: 'Seal Beach', province: 'California', url: 'https://www.sealbeachca.gov/Government/Agendas-Notices-Meeting-Videos' },
  { name: 'Athens', province: 'Alabama', url: 'http://www.athensal.us/AgendaCenter' },
  { name: 'Jenks', province: 'Oklahoma', url: 'https://www.jenks.com/AgendaCenter' },
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
