#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1650-1750
  // Unincorporated/CDPs: Citrus Park FL, Monsey NY, Clarksburg MD, Short Pump VA,
  // Plum PA, Lochearn MD, Holbrook NY, Sun City Center FL, Deer Park NY,
  // Leisure City FL, Plainview NY, Fortuna Foothills AZ, Palm Springs FL,
  // Ruskin FL, Suitland MD, Sun City West AZ, West Whittier-Los Nietos CA,
  // Tysons VA, Columbine CO, Coral Terrace FL, Fort Washington MD

  { name: 'Chaska', province: 'Minnesota', url: 'https://www.chaskamn.com/AgendaCenter' },
  { name: 'Oak Forest', province: 'Illinois', url: 'https://www.oak-forest.org/AgendaCenter/City-Council-1' },
  { name: 'Ramsey', province: 'Minnesota', url: 'https://cityoframsey.com/613/Agendas' },
  { name: 'Mason City', province: 'Iowa', url: 'https://www.masoncity.net/agenda.aspx' },
  { name: 'Converse', province: 'Texas', url: 'https://www.conversetx.net/Archive.aspx?AMID=36' },
  { name: 'Granite City', province: 'Illinois', url: 'https://www.granitecity.illinois.gov/government/agendas_minutes.php' },
  { name: 'Huntley', province: 'Illinois', url: 'https://www.huntley.il.us/government/agendas_and_minutes.php' },
  { name: 'Garden City', province: 'Michigan', url: 'https://www.gardencitymi.org/agendacenter' },
  { name: 'Fremont', province: 'Nebraska', url: 'https://www.fremontne.gov/agendacenter' },
  { name: 'Prior Lake', province: 'Minnesota', url: 'https://www.cityofpriorlake.com/DocumentCenter' },
  { name: 'Neenah', province: 'Wisconsin', url: 'https://www2.ci.neenah.wi.us/Minutes-Agendas' },
  { name: 'Twentynine Palms', province: 'California', url: 'https://www.ci.twentynine-palms.ca.us/council-meeting-archives' },
  { name: 'West Linn', province: 'Oregon', url: 'https://westlinnoregon.gov/meetings' },
  { name: 'Daphne', province: 'Alabama', url: 'https://www.daphneal.com/AgendaCenter' },
  { name: 'Pearl', province: 'Mississippi', url: 'https://www.cityofpearl.com/board-agenda-minutes' },
  { name: 'Hutto', province: 'Texas', url: 'https://www.huttotx.gov/129/Agendas-Minutes-Archive' },
  { name: 'New Lenox', province: 'Illinois', url: 'https://www.newlenox.net/AgendaCenter' },
  { name: 'Thomasville', province: 'North Carolina', url: 'https://www.thomasville-nc.gov/government/council_meetings/council___committee_agendas.php' },
  { name: 'Crestview', province: 'Florida', url: 'https://www.cityofcrestview.org/546/Agendas-Minutes' },
  { name: 'Auburn', province: 'New York', url: 'https://www.auburnny.gov/minutes-and-agendas' },
  { name: 'Shoreview', province: 'Minnesota', url: 'https://www.shoreviewmn.gov/government/agendas-and-minutes' },
  { name: 'South Pasadena', province: 'California', url: 'https://www.southpasadenaca.gov/Your-Government/Your-City-Council/City-Council-Agendas' },
  { name: 'Gladstone', province: 'Missouri', url: 'https://www.gladstone.mo.us/CityGovernment/agendas/' },
  { name: 'Sachse', province: 'Texas', url: 'https://www.cityofsachse.com/328/Agendas-Minutes-and-Videos' },
  { name: 'Key West', province: 'Florida', url: 'https://www.cityofkeywest-fl.gov/AgendaCenter' },
  { name: 'Carrollton', province: 'Georgia', url: 'https://www.carrollton-ga.gov/city-government/agendas-minutes-summaries/' },
  { name: 'Eureka', province: 'California', url: 'http://www.ci.eureka.ca.gov/depts/city_clerk/agenda_information/council/default.asp' },
  { name: 'Wooster', province: 'Ohio', url: 'https://www.woosteroh.com/city-council/city-council-meeting-minutes' },
  { name: 'Vernon Hills', province: 'Illinois', url: 'https://www.vernonhills.org/AgendaCenter' },
  { name: 'Paramus', province: 'New Jersey', url: 'https://www.paramusborough.org/AgendaCenter/Mayor-Council-8' },
  { name: 'Lemoore', province: 'California', url: 'https://lemoore.com/councilagendas' },
  { name: 'Horn Lake', province: 'Mississippi', url: 'https://www.hornlake.org/meetingdashboard' },
  { name: 'Superior', province: 'Wisconsin', url: 'https://www.ci.superior.wi.us/agendacenter' },
  { name: 'Temple Terrace', province: 'Florida', url: 'https://templeterrace.com/Archive.aspx?ADID=&AMID=44&Type=' },
  { name: 'Windsor', province: 'California', url: 'https://townofwindsor.com/721/Agendas-Minutes-Videos' },
  { name: 'Haines City', province: 'Florida', url: 'https://hainescity.com/AgendaCenter' },
  { name: 'East Chicago', province: 'Indiana', url: 'https://www.eastchicago.com/300/Council-Minutes' },
  { name: 'Brawley', province: 'California', url: 'https://www.brawley-ca.gov/government/city-council' },
  { name: 'South Portland', province: 'Maine', url: 'https://go.boarddocs.com/me/sport/Board.nsf/Public' },
  { name: 'Sanger', province: 'California', url: 'https://www.ci.sanger.ca.us/AgendaCenter' },
  { name: 'Dickinson', province: 'Texas', url: 'https://www.dickinson-tx.gov/AgendaCenter' },
  { name: 'Wayne', province: 'Michigan', url: 'https://www.ci.wayne.mi.us/AgendaCenter' },
  { name: 'Jacksonville', province: 'Illinois', url: 'https://www.jacksonville-il.gov/AgendaCenter' },
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
