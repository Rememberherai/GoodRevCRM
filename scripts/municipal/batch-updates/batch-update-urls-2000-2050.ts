#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1900-1950
  // Unincorporated/CDPs: Wekiwa Springs FL, Willowbrook CA, King of Prussia PA,
  // Lutz FL, Cockeysville MD

  { name: 'Fort Mill', province: 'South Carolina', url: 'https://fortmillsc.gov/AgendaCenter' },
  { name: 'North Augusta', province: 'South Carolina', url: 'http://weblink.northaugusta.net/WebLink' },
  { name: 'Farmington', province: 'Utah', url: 'https://farmington.utah.gov/city-government/city-council/city-council-meetings/' },
  { name: 'Lisle', province: 'Illinois', url: 'https://www.villageoflisle.org/785/Meeting-Agendas-Minutes-and-Approved-Doc' },
  { name: 'Fairfax', province: 'Virginia', url: 'https://www.fairfaxva.gov/Government/Public-Meetings/City-Meetings' },
  { name: 'Kingston', province: 'New York', url: 'https://kingston-ny.gov/agendas' },
  { name: 'Columbus', province: 'Nebraska', url: 'https://www.columbusne.us/75/Agendas-Minutes' },
  { name: 'Champlin', province: 'Minnesota', url: 'https://www.ci.champlin.mn.us/320/Meeting-Minutes' },
  { name: 'Papillion', province: 'Nebraska', url: 'https://www.papillion.org/AgendaCenter' },
  { name: 'Belton', province: 'Missouri', url: 'https://www.belton.org/Agendas-and-Minutes' },
  { name: 'Webster Groves', province: 'Missouri', url: 'https://webstergroves.org/Archive.aspx?AMID=30' },
  { name: 'Auburn', province: 'Maine', url: 'https://www.auburnmaine.gov/government/city_council/agendas_minutes.php' },
  { name: 'Wadsworth', province: 'Ohio', url: 'https://www.wadsworthcity.com/AgendaCenter' },
  { name: 'Kuna', province: 'Idaho', url: 'https://kunacity.id.gov/93/Agendas-Minutes' },
  { name: 'Muscatine', province: 'Iowa', url: 'https://www.muscatineiowa.gov/1599/Agenda-Minutes' },
  { name: 'Willoughby', province: 'Ohio', url: 'https://willoughbyohio.com/public-meetings/' },
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
