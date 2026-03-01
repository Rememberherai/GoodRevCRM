#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1550-1650
  // Unincorporated/CDPs: Fleming Island FL, Lakewood Ranch FL, Golden Gate FL, Perry Hall MD,
  // Laplace LA (unincorporated), Magna UT, East Niles CA, Summerlin South NV, Mehlville MO,
  // Drexel Hill PA, Orchards WA, Forest Hills MI, Ewa Gentry HI, Shirley NY, South Laurel MD,
  // Mililani Town HI, Kahului HI, Reisterstown MD, Immokalee FL, West Islip NY, Temescal Valley CA,
  // Ilchester MD, Bethany OR (unincorporated)

  // Cities 1550-1583
  { name: 'Hobart', province: 'Indiana', url: 'https://www.cityofhobart.org/agendacenter' },
  { name: 'Fountain', province: 'Colorado', url: 'https://www.fountaincolorado.org/government/city_departments___divisions/city_clerk/council_agendas_and_recordings' },
  { name: 'Laurel', province: 'Maryland', url: 'https://www.cityoflaurel.org/1534/Meetings-Agendas-and-Minutes' },
  { name: 'Suisun City', province: 'California', url: 'https://www.suisun.com/Government/City-Council/Agendas' },
  { name: 'Fridley', province: 'Minnesota', url: 'https://www.fridleymn.gov/Your-Government/City-Council-Commissions/Agenda-Center' },
  { name: 'Matthews', province: 'North Carolina', url: 'https://www.matthewsnc.gov/agenda.aspx' },
  { name: 'Jacksonville', province: 'Arkansas', url: 'https://www.cityofjacksonville.net/AgendaCenter' },
  { name: 'Schererville', province: 'Indiana', url: 'https://www.schererville.org/council/' },
  { name: 'Northampton', province: 'Massachusetts', url: 'https://northamptonma.gov/AgendaCenter/City-Council-157/' },
  { name: 'Erie', province: 'Colorado', url: 'https://www.erieco.gov/318/Town-Council' },
  { name: 'Fitchburg', province: 'Wisconsin', url: 'https://www.fitchburgwi.gov/2346/Agendas-Minutes' },
  { name: 'Hazleton', province: 'Pennsylvania', url: 'https://www.hazletoncity.org/council/council-minutes' },
  { name: 'Seguin', province: 'Texas', url: 'https://www.seguintexas.gov/AgendaCenter' },
  { name: 'Kirkwood', province: 'Missouri', url: 'https://www.kirkwoodmo.org/government/city-council/city-council-meeting-minutes' },
  { name: 'Shaker Heights', province: 'Ohio', url: 'https://shakeronline.com/AgendaCenter/Search/?term=' },
  { name: 'Englewood', province: 'New Jersey', url: 'https://cityofenglewood.org/AgendaCenter' },
  { name: 'Lake in the Hills', province: 'Illinois', url: 'https://www.lith.org/government/transparency' },

  // Cities 1583-1620
  { name: 'New Iberia', province: 'Louisiana', url: 'https://cityofnewiberia.com/site439.php' },
  { name: 'Prosper', province: 'Texas', url: 'https://www.prospertx.gov/agendacenter' },
  { name: 'Morrisville', province: 'North Carolina', url: 'https://www.townofmorrisville.org/government/meet-your-town-council' },
  { name: 'Jamestown', province: 'New York', url: 'https://www.jamestownny.gov/city-council/meeting-minutes/' },
  { name: 'Jeffersontown', province: 'Kentucky', url: 'http://www.jeffersontownky.gov/27/Government' },
  { name: 'Casselberry', province: 'Florida', url: 'https://www.casselberry.org/343/Agendas-Minutes' },
  { name: 'Madison Heights', province: 'Michigan', url: 'https://www.madison-heights.org/AgendaCenter/City-Council-Agendas-14' },
  { name: 'Walnut', province: 'California', url: 'https://www.cityofwalnut.org/my-government/meetings-agendas/city-council' },
  { name: 'Harrison', province: 'New York', url: 'https://www.harrison-ny.gov/home/pages/agendas-minutes' },
  { name: 'Monroeville', province: 'Pennsylvania', url: 'https://monroeville.pa.us/AgendaCenter' },
  { name: 'McDonough', province: 'Georgia', url: 'https://www.mcdonoughga.org/192/Meeting-Agendas-Minutes' },
  { name: 'Glen Ellyn', province: 'Illinois', url: 'https://www.glenellyn.org/734/Village-Agendas-Minutes' },
  { name: 'Frankfort', province: 'Kentucky', url: 'https://www.frankfort.ky.gov/1827/Agendas-Minutes' },
  { name: 'Allen Park', province: 'Michigan', url: 'https://cityofallenpark.org/government/agenda_and_minutes/allen_park_michigan_city_council.php' },
  { name: 'Brownsburg', province: 'Indiana', url: 'https://www.brownsburg.org/AgendaCenter/Town-Council-5' },
  { name: 'Maryland Heights', province: 'Missouri', url: 'https://www.marylandheights.com/departments/administration/index.php' },
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
