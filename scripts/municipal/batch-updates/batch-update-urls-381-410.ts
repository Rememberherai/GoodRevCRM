#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 381-400
  { name: 'Chino', province: 'California', url: 'https://chino.legistar.com/' },
  { name: 'Palm Springs', province: 'California', url: 'https://www.palmspringsca.gov/government/city-clerk/city-council-meetings' },
  { name: 'Ceres', province: 'California', url: 'https://www.ceres.gov/AgendaCenter' },
  { name: 'Gardena', province: 'California', url: 'https://cityofgardena.org/agendas-city-council/' },
  { name: 'Colton', province: 'California', url: 'https://www.coltonca.gov/AgendaCenter' },
  { name: 'Pflugerville', province: 'Texas', url: 'https://pflugerville.legistar.com/' },
  { name: 'Apple Valley', province: 'Minnesota', url: 'https://applevalleymn.portal.civicclerk.com/' },
  { name: 'Montebello', province: 'California', url: 'https://montebelloca.portal.civicclerk.com/' },
  { name: 'Lake Elsinore', province: 'California', url: 'https://www.lake-elsinore.org/204/Agendas-Minutes' },
  { name: 'Park Ridge', province: 'Illinois', url: 'https://parkridge.granicus.com/ViewPublisher.php?view_id=1' },
  { name: 'Conway', province: 'Arkansas', url: 'https://conwayarkansas.gov/meetings/' },
  { name: 'Mentor', province: 'Ohio', url: 'https://cityofmentor.com/departments/city-council/' },
  { name: 'San Marcos', province: 'Texas', url: 'https://www.sanmarcostx.gov/AgendaCenter/City-Council-4' },
  { name: 'Wilson', province: 'North Carolina', url: 'https://www.wilsonnc.org/residents/all-departments/administration/agendas' },
  { name: 'Bell Gardens', province: 'California', url: 'https://bellgardens.community.highbond.com/Portal/MeetingTypeList.aspx' },
  { name: 'Coppell', province: 'Texas', url: 'https://coppell.legistar.com/' },
  { name: 'La Quinta', province: 'California', url: 'https://www.laquintaca.gov/business/city-council/city-council-agendas' },
  { name: 'Maplewood', province: 'Minnesota', url: 'https://maplewoodmn.gov/AgendaCenter' },
  { name: 'Lauderhill', province: 'Florida', url: 'https://lauderhill-fl.legistar.com/' },
  { name: 'Grand Forks', province: 'North Dakota', url: 'https://www.grandforksgov.com/government/meeting-information/meeting-agendas-minutes' },
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
