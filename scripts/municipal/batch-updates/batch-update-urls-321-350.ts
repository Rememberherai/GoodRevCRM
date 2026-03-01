#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 321-330
  { name: 'Boynton Beach', province: 'Florida', url: 'https://www.boynton-beach.org/129/Agendas-Minutes' },
  { name: 'Texarkana', province: 'Texas', url: 'http://texarkanacitytx.iqm2.com/Citizens/' },
  { name: 'Folsom', province: 'California', url: 'https://www.folsom.ca.us/government/city-clerk-s-office/council-meetings-agendas-and-minutes' },
  { name: 'Bellflower', province: 'California', url: 'https://bellflower.ca.gov/government/city_council/city_council_meetings.php' },
  { name: 'Pharr', province: 'Texas', url: 'https://pharr-tx.gov/government/departments/city-clerks-office/agendas-minutes/' },
  { name: 'Homestead', province: 'Florida', url: 'https://www.homesteadfl.gov/agenda' },
  { name: 'Valdosta', province: 'Georgia', url: 'https://www.valdostacity.com/city-council/agendas-minutes' },
  { name: 'Upland', province: 'California', url: 'https://www.uplandca.gov/city-council-agendasminutes' },
  { name: 'Evanston', province: 'Illinois', url: 'https://www.cityofevanston.org/government/city-council-agendas-and-minutes' },
  { name: 'Newark', province: 'Ohio', url: 'http://www.newarkohio.gov/meeting-agendas/' },

  // Cities 331-340
  { name: 'North Lauderdale', province: 'Florida', url: 'https://www.nlauderdale.org/quick_links/meetings_and_minutes/index.php' },
  { name: 'Berwyn', province: 'Illinois', url: 'https://www.berwyn-il.gov/government/council-agendas-minutes' },
  { name: 'Alpharetta', province: 'Georgia', url: 'https://alpharettaga.portal.civicclerk.com' },
  { name: 'Little Elm', province: 'Texas', url: 'https://www.littleelm.org/1258/Agendas-Minutes-Videos' },
  { name: 'Palo Alto', province: 'California', url: 'https://www.paloalto.gov/Departments/City-Clerk/City-Meeting-Groups/Meeting-Agendas-and-Minutes' },
  { name: 'Keller', province: 'Texas', url: 'https://cityofkeller.legistar.com/' },
  { name: 'Palm Desert', province: 'California', url: 'https://pub-palmdesert.escribemeetings.com/' },
  { name: 'San Luis Obispo', province: 'California', url: 'https://www.slocity.org/government/mayor-and-city-council/agendas-and-minutes' },
  { name: 'Cleveland Heights', province: 'Ohio', url: 'https://www.clevelandheights.gov/1625/City-Council-Agendas-and-Minutes' },
  { name: 'Covington', province: 'Kentucky', url: 'https://www.covingtonky.gov/government/boards-commissions/board-of-commissioners' },

  // Cities 341-350
  { name: 'Rocky Mount', province: 'North Carolina', url: 'https://www.rockymountnc.gov/AgendaCenter/City-Council-5' },
  { name: 'Baldwin Park', province: 'California', url: 'https://baldwinpark.granicus.com/ViewPublisher.php?view_id=10' },
  { name: 'Rochester Hills', province: 'Michigan', url: 'https://www.rochesterhills.org/government/city_council/agenda_minutes_synopses.php' },
  { name: 'Rowlett', province: 'Texas', url: 'https://www.rowletttx.gov/474/Agendas-and-Minutes' },
  { name: 'Grand Island', province: 'Nebraska', url: 'https://www.grand-island.com/' },
  { name: 'St. Louis Park', province: 'Minnesota', url: 'https://www.stlouisparkmn.gov/government/city-council/agendas-minutes' },
  { name: 'Richland', province: 'Washington', url: 'https://richlandwa.portal.civicclerk.com/' },
  { name: 'Maricopa', province: 'Arizona', url: 'https://maricopa.legistar.com/' },
  { name: 'Plainfield', province: 'New Jersey', url: 'https://www.plainfieldnj.gov/government/elected_officials/meeting_schedules.php' },
  { name: 'Union City', province: 'New Jersey', url: 'https://www.ucnj.com/meetings' },
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
