#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 221-235
  { name: 'Gresham', province: 'Oregon', url: 'https://www.greshamoregon.gov/government/mayor-and-council/council-meeting-agendas-and-videos/' },
  { name: 'Utica', province: 'New York', url: 'https://www.cityofutica.com/government/common-council/agendas/index' },
  { name: 'Broken Arrow', province: 'Oklahoma', url: 'https://brokenarrow.legistar.com/' },
  { name: 'Chico', province: 'California', url: 'https://chico-ca.granicus.com/ViewPublisher.php?view_id=2' },
  { name: 'Sioux City', province: 'Iowa', url: 'https://www.sioux-city.org/government/city-council/council-agenda-and-minutes' },
  { name: 'League City', province: 'Texas', url: 'https://www.leaguecitytx.gov/3377/Agendas-Minutes' },
  { name: 'San Buenaventura', province: 'California', url: 'https://www.cityofventura.ca.gov/AgendaCenter' },
  { name: 'Everett', province: 'Washington', url: 'https://www.everettwa.gov/AgendaCenter' },
  { name: 'El Centro', province: 'California', url: 'https://elcentroca.portal.civicclerk.com/' },
  { name: 'Sugar Land', province: 'Texas', url: 'https://www.sugarlandtx.gov/2908/Meeting-Agendas-Minutes-and-Videos' },
  { name: 'El Monte', province: 'California', url: 'https://www.ci.el-monte.ca.us/AgendaCenter' },
  { name: 'Lewisville', province: 'Texas', url: 'https://cityoflewisville.legistar.com/' },
  { name: 'Temecula', province: 'California', url: 'https://temeculaca.gov/129/Agendas-Action-Minutes' },
  { name: 'Bend', province: 'Oregon', url: 'https://www.bendoregon.gov/government/city-council/city-council-meeting-agendas-video' },
  { name: 'Salisbury', province: 'Maryland', url: 'https://salisburymd.granicus.com/ViewPublisher.php?view_id=1' },

  // Cities 236-250
  { name: 'Jacksonville', province: 'North Carolina', url: 'https://jacksonvillenc.gov/agendacenter' },
  { name: 'Centennial', province: 'Colorado', url: 'https://www.centennialco.gov/Government/Mayor-Council/City-Council-Meetings/Agendas-Minutes' },
  { name: 'Burbank', province: 'California', url: 'https://www.burbankca.gov/web/city-clerks-office/meeting-agendas-and-minutes' },
  { name: 'Sparks', province: 'Nevada', url: 'https://www.cityofsparks.us/your_government/public_meetings/archived_minutes.php' },
  { name: 'Sandy Springs', province: 'Georgia', url: 'https://sandyspringsga.portal.civicclerk.com/' },
  { name: 'Bloomington', province: 'Indiana', url: 'https://bloomington.in.gov/council/meetings' },
  { name: 'Logan', province: 'Utah', url: 'https://www.loganutah.gov/government/city_council/agendas.php' },
  // Note: Skipping Kailua, Hawaii (unincorporated, no city council)
  { name: 'El Cajon', province: 'California', url: 'https://www.elcajon.gov/your-government/city-council/agendas' },
  { name: 'Hillsboro', province: 'Oregon', url: 'https://hillsboro-oregon.civicweb.net/portal/' },
  { name: 'South Fulton', province: 'Georgia', url: 'https://cityofsouthfultonga.gov/AgendaCenter' },
  { name: 'Renton', province: 'Washington', url: 'https://renton.civicweb.net/portal/' },
  // Note: Skipping Mandeville, Louisiana (town, not city - different government structure)
  // Note: Skipping San Mateo based on search similarity - will add in next batch
  // Note: Skipping Columbia, Maryland (unincorporated, no city council)
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
  console.log(`⏭️  Skipped: Kailua HI, Mandeville LA, Columbia MD (unincorporated/different gov structure)`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
