#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1142-1191
  // Unincorporated: The Acreage FL, Essex MD, French Valley CA, Security-Widefield CO
  // Clinton MD, Meadow Woods FL, Valrico FL

  { name: 'Columbia', province: 'Tennessee', url: 'https://columbiatn.gov/725/Agendas-Minutes' },
  { name: 'Germantown', province: 'Tennessee', url: 'https://www.germantown-tn.gov/government/city-boards-commissions/board-and-commission-schedules-and-archives' },
  { name: 'Shelton', province: 'Connecticut', url: 'https://cityofshelton.org/p/minutes-agendas' },
  { name: 'Covington', province: 'Kentucky', url: 'https://www.covingtonky.gov/government/mayor-and-commission' },
  { name: 'Westfield', province: 'Massachusetts', url: 'https://www.cityofwestfield.org/AgendaCenter' },
  { name: 'Friendswood', province: 'Texas', url: 'https://friendswood.com/Agendas' },
  { name: 'Culver City', province: 'California', url: 'https://www.culvercity.org/City-Hall/Meetings-Agendas/Legistar-Insite-Redirect' },
  { name: 'Annapolis', province: 'Maryland', url: 'https://www.annapolis.gov/AgendaCenter' },
  { name: 'Duncanville', province: 'Texas', url: 'https://www.duncanville.com/government/agendas-minutes/' },
  { name: 'Cedar Falls', province: 'Iowa', url: 'https://www.cedarfalls.com/74/City-Council-Meeting-Agendas-Minutes' },
  { name: 'Milton', province: 'Georgia', url: 'https://www.cityofmiltonga.us/events/230/city-council-meeting' },
  { name: 'Weslaco', province: 'Texas', url: 'https://www.weslacotx.gov/government/city_secretary/index.php' },
  { name: 'Lake Oswego', province: 'Oregon', url: 'https://www.ci.oswego.or.us/citycouncil/agendas-schedules' },
  { name: 'Lancaster', province: 'Ohio', url: 'https://www.ci.lancaster.oh.us/AgendaCenter/City-Council-2' },
  { name: 'Findlay', province: 'Ohio', url: 'https://www.findlayohio.com/' },
  { name: 'New Berlin', province: 'Wisconsin', url: 'https://www.newberlin.org/1103/Agendas-Minutes' },
  { name: 'Hutchinson', province: 'Kansas', url: 'https://www.hutchgov.com/270/Agendas-Minutes' },
  { name: 'Holly Springs', province: 'North Carolina', url: 'https://www.hollyspringsnc.us/2128' },
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
