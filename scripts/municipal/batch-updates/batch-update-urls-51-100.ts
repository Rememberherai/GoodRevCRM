#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 51-60
  { name: 'Denton', province: 'Texas', url: 'https://www.cityofdenton.com/AgendaCenter' },
  { name: 'Spokane', province: 'Washington', url: 'https://my.spokanecity.org/citycouncil/documents/' },
  { name: 'Oakland', province: 'California', url: 'https://oakland.legistar.com/' },
  { name: 'Lancaster', province: 'Pennsylvania', url: 'https://www.cityoflancasterpa.gov/city-council/' },
  { name: 'Poughkeepsie', province: 'New York', url: 'https://cityofpoughkeepsie.com/381/Agendas-Minutes' },
  { name: 'Boise', province: 'Idaho', url: 'https://www.cityofboise.org/departments/city-clerk/city-council-meetings/' },
  { name: 'Winston-Salem', province: 'North Carolina', url: 'https://winston-salem.legistar.com/' },
  { name: 'Syracuse', province: 'New York', url: 'https://www.syr.gov/Departments/Common-Council/Meetings-and-Agendas' },
  { name: 'Augusta', province: 'Georgia', url: 'https://augustarichmond-ga.municodemeetings.com/' },
  { name: 'Stockton', province: 'California', url: 'https://stockton.legistar.com/' },

  // Cities 61-75
  { name: 'Palm Coast', province: 'Florida', url: 'https://www.palmcoast.gov/agendas' },
  { name: 'Chattanooga', province: 'Tennessee', url: 'https://chattanooga.gov/stay-informed/council-agendas-minutes' },
  { name: 'Kissimmee', province: 'Florida', url: 'https://kissimmeefl.portal.civicclerk.com/' },
  { name: 'Durham', province: 'North Carolina', url: 'https://www.durhamnc.gov/AgendaCenter/City-Council-4' },
  { name: 'Arlington', province: 'Texas', url: 'https://www.arlingtontx.gov/Government/Meetings-Agendas' },
  { name: 'Victorville', province: 'California', url: 'https://www.victorvilleca.gov/government/agendas' },
  { name: 'Aurora', province: 'Colorado', url: 'https://www.auroragov.org/city_hall/mayor___city_council/council_meetings' },
  { name: 'Modesto', province: 'California', url: 'https://www.modestogov.com/749/City-Council-Agendas-Minutes' },
  { name: 'Fayetteville', province: 'Arkansas', url: 'https://www.fayetteville-ar.gov/3947/Public-Meetings-Agendas-Minutes-and-Vide' },
  { name: 'Scranton', province: 'Pennsylvania', url: 'https://scrantonpa.gov/citycouncil/city-council-meetings/' },

  // Cities 76-100
  { name: 'Oxnard', province: 'California', url: 'https://oxnardca.portal.civicclerk.com/' },
  { name: 'Youngstown', province: 'Ohio', url: 'https://youngstownohio.gov/city_council' },
  { name: 'Indio', province: 'California', url: 'https://indio.civicweb.net/portal/' },
  { name: 'Pensacola', province: 'Florida', url: 'https://www.cityofpensacola.com/AgendaCenter/City-Council-1' },
  { name: 'Anaheim', province: 'California', url: 'https://www.anaheim.net/AgendaCenter' },
  { name: 'Bonita Springs', province: 'Florida', url: 'https://www.cityofbonitasprings.org/services___departments/city_clerk/agendas_and_packets' },
  { name: 'Greensboro', province: 'North Carolina', url: 'https://pub-greensboro-nc.escribemeetings.com/' },
  { name: 'Huntsville', province: 'Alabama', url: 'https://huntsvilleal.legistar.com/' },
  { name: 'Corpus Christi', province: 'Texas', url: 'https://corpuschristi.legistar.com/' },
  { name: 'Fort Wayne', province: 'Indiana', url: 'https://www.cityoffortwayne.in.gov/1057/Public-Meeting-Agendas' },
  { name: 'Fayetteville', province: 'North Carolina', url: 'https://cityoffayetteville.legistar.com/' },
  { name: 'Ann Arbor', province: 'Michigan', url: 'https://a2gov.legistar.com/' },
  { name: 'Jackson', province: 'Mississippi', url: 'https://jacksonms.gov/council-agendas-minutes/' },
  { name: 'Antioch', province: 'California', url: 'https://www.antiochca.gov/government/agendas-and-minutes/' },
  { name: 'Mobile', province: 'Alabama', url: 'https://mobileal.portal.civicclerk.com/' },
  { name: 'Lexington', province: 'Kentucky', url: 'https://lexington.legistar.com/' },
  { name: 'Asheville', province: 'North Carolina', url: 'https://www.ashevillenc.gov/government/city-council-meeting-materials/' },
  { name: 'Trenton', province: 'New Jersey', url: 'https://www.trentonnj.org/AgendaCenter/City-Council-2' },
  { name: 'Santa Rosa', province: 'California', url: 'https://santa-rosa.legistar.com/' },
  { name: 'Santa Ana', province: 'California', url: 'https://www.santa-ana.org/agendas-and-minutes/' },
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
