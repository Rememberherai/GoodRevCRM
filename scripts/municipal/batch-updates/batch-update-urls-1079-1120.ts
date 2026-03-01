#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1079-1120
  // Unincorporated: Odenton MD, West Babylon NY, Altadena CA, Hicksville NY, Catonsville MD
  // Woodbridge VA, Channelview TX, Linton Hall VA, Woodlawn MD

  { name: 'San Bruno', province: 'California', url: 'https://www.sanbruno.ca.gov/AgendaCenter/City-Council-17' },
  { name: 'Danville', province: 'California', url: 'https://www.danville.ca.gov/129/Meetings-Agendas-Minutes' },
  { name: 'Concord', province: 'New Hampshire', url: 'https://www.concordnh.gov/282/City-Council' },
  { name: 'The Colony', province: 'Texas', url: 'https://www.thecolonytx.gov/601/Agendas-Packets-Minutes-Videos' },
  { name: 'Greenacres', province: 'Florida', url: 'https://ci.greenacres.fl.us/agendas/council_agenda.htm' },
  { name: 'Shakopee', province: 'Minnesota', url: 'https://www.shakopeemn.gov/government/mayor-city-council' },
  { name: 'Linden', province: 'New Jersey', url: 'https://linden-nj.org/documents/city-council-meetings/' },
  { name: 'North Miami Beach', province: 'Florida', url: 'https://www.citynmb.com/AgendaCenter' },
  { name: 'Gallatin', province: 'Tennessee', url: 'https://www.gallatintn.gov/AgendaCenter' },
  { name: 'Wentzville', province: 'Missouri', url: 'https://www.wentzvillemo.gov/government/meetings-minutes-agendas/' },
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
