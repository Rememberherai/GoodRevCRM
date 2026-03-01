#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 351-360
  { name: 'Kentwood', province: 'Michigan', url: 'https://www.kentwood.us/city_services/committees_and_boards/agendas_and_minutes/index.php' },
  { name: 'Smyrna', province: 'Georgia', url: 'https://smyrnacity.legistar.com/Calendar.aspx' },
  { name: 'DeSoto', province: 'Texas', url: 'https://desototexas.gov/government/city_council/agendas___minutes.php' },
  { name: 'St. Peters', province: 'Missouri', url: 'https://www.stpetersmo.net/AgendaCenter' },
  { name: 'Gilroy', province: 'California', url: 'https://cityofgilroy.org/965/Agendas-Minutes' },
  { name: 'Cedar Hill', province: 'Texas', url: 'https://www.cedarhilltx.com/75/Agendas-Minutes' },
  { name: 'Bullhead City', province: 'Arizona', url: 'https://www.bullheadcity.com/government/departments/city-clerk/agendas-videos/agendas-videos-city-council' },
  { name: 'Idaho Falls', province: 'Idaho', url: 'https://www.idahofallsidaho.gov/AgendaCenter/City-Council-2' },
  { name: 'Casa Grande', province: 'Arizona', url: 'https://www.casagrandeaz.gov/agendacenter' },
  { name: 'North Miami', province: 'Florida', url: 'https://www.northmiamifl.gov/477/Agendas-Minutes' },

  // Cities 361-370
  { name: 'Haltom City', province: 'Texas', url: 'https://www.haltomcitytx.com/AgendaCenter/City-Council-17' },
  { name: 'Brookhaven', province: 'Georgia', url: 'https://www.brookhavenga.gov/meetings?field_microsite_tid_1=27' },
  { name: 'Lakeville', province: 'Minnesota', url: 'https://lakevillemn.portal.civicclerk.com/' },
  { name: 'Sayreville', province: 'New Jersey', url: 'http://www.sayreville.com/Cit-e-Access/Meetings/?TID=87&TPID=8645' },
  { name: 'Porterville', province: 'California', url: 'https://portervilleca.portal.civicclerk.com/' },
  { name: 'Rocklin', province: 'California', url: 'https://www.rocklin.ca.us/city-council-meetings' },
  { name: 'Pasco', province: 'Washington', url: 'https://pasco.civicweb.net/Portal/' },
  { name: 'St. Cloud', province: 'Florida', url: 'https://stcloudfl.portal.civicclerk.com/' },
  { name: 'Camarillo', province: 'California', url: 'https://www.cityofcamarillo.org/departments/city_clerk/meeting_agendas___public_hearing_notices/city_council.php' },
  { name: 'Delano', province: 'California', url: 'https://www.cityofdelano.org/82/Minutes-Agendas' },

  // Cities 371-380
  { name: 'Logan', province: 'Utah', url: 'https://www.loganutah.gov/government/city_council/index.php' },
  { name: 'Coconut Creek', province: 'Florida', url: 'https://coconutcreek.legistar.com/' },
  { name: 'Petaluma', province: 'California', url: 'https://cityofpetaluma.org/meetings/' },
  { name: 'Biloxi', province: 'Mississippi', url: 'https://biloxi.ms.us/departments/city-council/agenda/' },
  { name: 'Lehi', province: 'Utah', url: 'https://lehi.granicus.com/ViewPublisher.php?view_id=1' },
  { name: 'Gaithersburg', province: 'Maryland', url: 'https://www.gaithersburgmd.gov/government/mayor-city-council' },
  { name: 'Diamond Bar', province: 'California', url: 'http://diamondbarca.iqm2.com/Citizens/Default.aspx' },
  { name: 'Brentwood', province: 'California', url: 'https://www.brentwoodca.gov/government/city-council' },
  { name: 'San Jacinto', province: 'California', url: 'https://www.sanjacintoca.gov/city_departments/city-clerk/city-council-meetings-and-planning-commission' },
  { name: 'North Richland Hills', province: 'Texas', url: 'https://nrhtx.legistar.com/' },
];

async function batchUpdate() {
  console.log(`\n💾 Batch Updating ${urlUpdates.length} Municipality URLs\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const update of urlUpdates) {
    const { data, error} = await supabase
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
