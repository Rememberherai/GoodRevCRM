#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1212-1250
  // Unincorporated/CDP: Evans GA (Columbia County), La Presa CA, La Puente CA
  // Stanton CA, Parkland WA, East Meadow NY, Mechanicsville VA, Sun City AZ
  // Richmond West FL

  { name: 'Apache Junction', province: 'Arizona', url: 'https://www.ajcity.net/' },
  { name: 'Menomonee Falls', province: 'Wisconsin', url: 'https://www.menomonee-falls.org/293/Agendas-Minutes' },
  { name: 'Phenix City', province: 'Alabama', url: 'https://phenixcityal.us/government/transparency-portal/' },
  { name: 'Post Falls', province: 'Idaho', url: 'https://www.postfallsidaho.org/your-government/agendas/' },
  { name: 'La Vergne', province: 'Tennessee', url: 'https://www.lavergnetn.gov/AgendaCenter' },
  { name: 'Mount Juliet', province: 'Tennessee', url: 'https://www.mtjuliet-tn.gov/agendacenter' },
  { name: 'Hot Springs', province: 'Arkansas', url: 'https://www.cityhs.net/AgendaCenter' },
  { name: 'Winter Springs', province: 'Florida', url: 'https://www.winterspringsfl.org/bc/page/meetings' },
  { name: 'Monrovia', province: 'California', url: 'https://pav.cityofmonrovia.org/publicaccess/' },
  { name: 'Prattville', province: 'Alabama', url: 'https://www.prattvilleal.gov/table/city-council/agendas/' },
  { name: 'Carpentersville', province: 'Illinois', url: 'https://www.cville.org/agendacenter' },
  { name: 'West Fargo', province: 'North Dakota', url: 'https://www.westfargond.gov/1202/Agendas-Minutes' },
  { name: 'Northglenn', province: 'Colorado', url: 'https://webdocs.northglenn.org/' },
  { name: 'East Point', province: 'Georgia', url: 'https://www.eastpointcity.org/city-council/' },
  { name: 'Tupelo', province: 'Mississippi', url: 'https://www.tupeloms.gov/my-government/city-council/agendas-minutes' },
  { name: 'Rosenberg', province: 'Texas', url: 'https://www.rosenbergtx.gov/129/Agendas-Minutes' },
  { name: 'Montclair', province: 'California', url: 'https://www.cityofmontclair.org/council-meetings/' },
  { name: 'Peachtree City', province: 'Georgia', url: 'https://www.peachtree-city.org/1201/Meetings-Agendas' },
  { name: 'La Quinta', province: 'California', url: 'https://www.laquintaca.gov/business/city-council/city-council-agendas' },
  { name: 'Greenfield', province: 'Wisconsin', url: 'http://www.greenfieldwi.us/334/Common-Council' },
  { name: 'Owasso', province: 'Oklahoma', url: 'https://www.cityofowasso.com/AgendaCenter/City-Council-3' },
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
