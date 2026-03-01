#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 901-914 (from previous session)
  { name: 'Twin Falls', province: 'Idaho', url: 'https://www.tfid.org/514/Agendas-Minutes-Videos' },
  { name: 'Enid', province: 'Oklahoma', url: 'https://www.enid.org/Government/City-Council' },
  { name: 'Dunwoody', province: 'Georgia', url: 'https://www.dunwoodyga.gov/government/agendas-and-minutes' }, // Already in earlier batch
  { name: 'Palm Desert', province: 'California', url: 'https://pub-palmdesert.escribemeetings.com/' },
  { name: 'Covina', province: 'California', url: 'https://covinaca.gov/our-city/government/city-council/agendas-minutes/' },
  { name: 'Cuyahoga Falls', province: 'Ohio', url: 'https://www.cityofcf.com/city-council/files' },
  { name: 'Lakewood', province: 'Ohio', url: 'https://www.lakewoodoh.gov/minutesandagendas/' },
  { name: 'Marana', province: 'Arizona', url: 'https://www.maranaaz.gov/agendas-and-minutes' },
  { name: 'Mishawaka', province: 'Indiana', url: 'https://mishawakain.portal.civicclerk.com/' },
  { name: 'Columbus', province: 'Indiana', url: 'https://www.columbus.in.gov/clerk-treasurer/city-council-agendas-minutes/' },
  { name: 'Troy', province: 'New York', url: 'https://www.troyny.gov/AgendaCenter' },
  { name: 'Milford', province: 'Connecticut', url: 'https://www.milfordct.us/AgendaCenter/Board-of-Aldermen-5/' },
  { name: 'Collierville', province: 'Tennessee', url: 'https://www.colliervilletn.gov/government/fe-test-twocolreversetemplate' },
  { name: 'Grapevine', province: 'Texas', url: 'https://www.grapevinetexas.gov/89/Agendas-Minutes' },

  // Cities 915-938
  { name: 'Summerville', province: 'South Carolina', url: 'https://summervillesc.gov/AgendaCenter' },
  { name: 'Cypress', province: 'California', url: 'https://www.cypressca.org/government/city-council-meetings' },
  { name: 'Downers Grove', province: 'Illinois', url: 'https://www.downers.us/council-meeting-archives' },
  { name: 'Murray', province: 'Utah', url: 'https://www.murray.utah.gov/1683/Agendas-and-Minutes' },
  { name: 'Draper', province: 'Utah', url: 'https://draper.ut.us/AgendaCenter' },
  { name: 'Chesterfield', province: 'Missouri', url: 'https://www.chesterfield.mo.us/minutes-and-agendas.html' },
  { name: 'Cerritos', province: 'California', url: 'https://www.cerritos.us/GOVERNMENT/city_council_meetings.php' },
  { name: 'Bedford', province: 'Texas', url: 'https://bedfordtx.gov/AgendaCenter' },
  { name: 'St. Louis Park', province: 'Minnesota', url: 'https://www.stlouispark.org/Home/Components/Calendar/Event/745/176?selcat=33' },
  { name: 'Azusa', province: 'California', url: 'https://www.azusaca.gov/1389/Watch-Meetings-Online' },
  { name: 'Euclid', province: 'Ohio', url: 'https://www.cityofeuclid.gov/city-council-agendas-minutes' },
  { name: 'Coral Gables', province: 'Florida', url: 'https://www.coralgables.com/department/city-clerks-office/city-meetings' },
  { name: 'Lincoln', province: 'California', url: 'https://www.lincolnca.gov/our-government/citycouncil-city_council/agendas-and-minutes/' },
  { name: 'Jeffersonville', province: 'Indiana', url: 'https://cityofjeff.net/events/category/city-council-meetings/' },
  { name: 'Ceres', province: 'California', url: 'https://www.ci.ceres.ca.us/Calendar.aspx?CID=24' },
  { name: 'Biloxi', province: 'Mississippi', url: 'https://biloxi.ms.us/departments/city-council/agenda/' },
  { name: 'Lawrence', province: 'Indiana', url: 'https://www.cityoflawrence.org/agendas-minutes' },
  { name: 'Poway', province: 'California', url: 'https://poway.org/agendacenter' },
  { name: 'Cedar Hill', province: 'Texas', url: 'https://www.cedarhilltx.com/75/Agendas-Minutes' },
  { name: 'Portage', province: 'Michigan', url: 'https://portagemi.gov/610/City-Council-Meeting-Agendas-Minutes' },
  { name: 'Niagara Falls', province: 'New York', url: 'https://niagarafallsusa.org/government/city_council.php' },
  { name: 'Dublin', province: 'Ohio', url: 'https://dublinohiousa.gov/council/meeting-schedule/' },
  { name: 'Mooresville', province: 'North Carolina', url: 'https://www.mooresvillenc.gov/government/town_board/minutes_and_agendas.php' },
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
