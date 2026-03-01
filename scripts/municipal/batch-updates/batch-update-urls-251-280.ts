#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 251-265
  { name: 'Lafayette', province: 'Colorado', url: 'https://www.lafayetteco.gov/247/City-Council' },
  { name: 'Santa Fe', province: 'New Mexico', url: 'https://santafenm.gov/city-clerk-1/meetings-minutes-and-agendas' },
  { name: 'Hesperia', province: 'California', url: 'https://www.cityofhesperia.us/135/Agendas-Minutes' },
  { name: 'La Crosse', province: 'Wisconsin', url: 'https://www.cityoflacrosse.org/your-government/city-council' },
  // Skip Riverview FL (unincorporated)
  { name: 'Kingsport', province: 'Tennessee', url: 'https://www.kingsporttn.gov/government/agendas-minutes/' },
  { name: 'Edinburg', province: 'Texas', url: 'https://cityofedinburg.com/government/agendas_and_minutes/index.php' },
  { name: 'Vista', province: 'California', url: 'https://www.cityofvista.com/city-hall/city-council' },
  { name: 'Bowling Green', province: 'Kentucky', url: 'https://www.bgky.org/city-commission' },
  { name: 'Carmel', province: 'Indiana', url: 'https://www.carmel.in.gov/government/boards-commissions-committees/all-meetings-agendas-minutes' },
  { name: 'Longview', province: 'Texas', url: 'https://www.longviewtexas.gov/AgendaCenter' },
  { name: 'Tracy', province: 'California', url: 'https://www.cityoftracy.org/government/city-council/council-meeting-agendas' },
  { name: 'Prescott Valley', province: 'Arizona', url: 'https://www.pvaz.net/274/Meeting-Agendas-Minutes' },
  { name: 'Beaverton', province: 'Oregon', url: 'https://www.beavertonoregon.gov/1016/Meeting-Agenda-Minutes' },
  { name: 'Portsmouth', province: 'New Hampshire', url: 'https://www.portsmouthnh.gov/citycouncil/city-council-agendas' },
  { name: 'Portsmouth', province: 'Virginia', url: 'https://www.portsmouthva.gov/AgendaCenter' },

  // Cities 266-280
  { name: 'Fishers', province: 'Indiana', url: 'https://fishers.in.us/AgendaCenter' },
  { name: 'Orem', province: 'Utah', url: 'https://orem.gov/meetings/' },
  { name: 'Sandy', province: 'Utah', url: 'https://sandy.utah.gov/1204/City-Council' },
  { name: 'Sunrise', province: 'Florida', url: 'https://www.sunrisefl.gov/city-commission/commission-agendas' },
  // Skip San Tan Valley AZ (unincorporated)
  { name: 'Compton', province: 'California', url: 'https://www.comptoncity.org/departments/city-clerk/agendas-meetings-and-minutes' },
  // Skip Arden-Arcade CA (unincorporated)
  { name: 'Hanford', province: 'California', url: 'https://hanfordca.portal.civicclerk.com/' },
  { name: 'Boca Raton', province: 'Florida', url: 'https://www.myboca.us/129/Agendas' },
  { name: 'Middletown', province: 'Ohio', url: 'https://www.cityofmiddletown.org/AgendaCenter' },
  { name: 'Livonia', province: 'Michigan', url: 'https://livonia.gov/129/Agendas-Minutes' },
  { name: 'Carson', province: 'California', url: 'https://ci.carson.ca.us/AgendaMinutes.aspx' },
  { name: 'Lawrence', province: 'Kansas', url: 'https://lawrenceks.org/agendas/' },
  { name: 'Slidell', province: 'Louisiana', url: 'https://myslidell.com/government/slidell-city-council/agenda/' },
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
  console.log(`⏭️  Skipped: Riverview FL, San Tan Valley AZ, Arden-Arcade CA (unincorporated)`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
