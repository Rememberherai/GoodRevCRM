#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1001-1050 (excluding unincorporated communities and already uploaded cities)
  // Already uploaded: Newark CA, Roseville MI, East Lansing MI, Mentor OH, Bothell WA
  // San Luis Obispo CA, Burleson TX, East Providence RI
  // Unincorporated: Potomac MD, Sicklerville NJ, Pearl City HI

  { name: 'Middletown', province: 'Connecticut', url: 'https://middletownct.gov/AgendaCenter/Common-Council-14/' },
  { name: 'Brea', province: 'California', url: 'https://agenda.ci.brea.ca.us/' },
  { name: 'Salina', province: 'Kansas', url: 'https://www.salina-ks.gov/agendas' },
  { name: 'Farmington', province: 'New Mexico', url: 'https://www.fmtn.org/agendacenter' },
  { name: 'Ocoee', province: 'Florida', url: 'https://www.ocoee.org/AgendaCenter' },
  { name: 'Hilo', province: 'Hawaii', url: 'https://www.hawaiicounty.gov/our-county/legislative/county-council/meeting-agendas-and-actions' },
  { name: 'Oro Valley', province: 'Arizona', url: 'https://www.orovalleyaz.gov/Government/Departments/Town-Clerk/Meetings-and-Agendas' },
  { name: 'Fort Pierce', province: 'Florida', url: 'https://www.cityoffortpierce.com/223/Agendas-Minutes' },
  { name: 'Wake Forest', province: 'North Carolina', url: 'https://www.wakeforestnc.gov/public-meetings-portal' },
  { name: 'Beavercreek', province: 'Ohio', url: 'https://beavercreekohio.gov/AgendaCenter' },
  { name: 'Strongsville', province: 'Ohio', url: 'https://www.strongsville.org/government/city-council/minutes-agendas' },
  { name: 'Rockwall', province: 'Texas', url: 'https://www.rockwall.com/meetings.asp' },
  { name: 'Attleboro', province: 'Massachusetts', url: 'https://www.cityofattleboro.us/AgendaCenter' },
  { name: 'Winter Garden', province: 'Florida', url: 'https://www.cwgdn.com/AgendaCenter' },
  { name: 'Haltom City', province: 'Texas', url: 'https://www.haltomcitytx.com/AgendaCenter/City-Council-17' },
  { name: 'Altamonte Springs', province: 'Florida', url: 'https://www.altamonte.org/AgendaCenter' },
  { name: 'Hackensack', province: 'New Jersey', url: 'https://www.hackensack.org/council-meeting-schedule/' },
  { name: 'Westfield', province: 'Indiana', url: 'https://www.westfield.in.gov/egov/apps/document/center.egov?view=browse&eGov_searchType=159' },
  { name: 'Elmhurst', province: 'Illinois', url: 'https://www.elmhurst.org/government/city_council__elected_officials/meeting_schedule.php' },
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
