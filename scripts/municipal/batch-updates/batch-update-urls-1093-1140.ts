#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1093-1140
  // Unincorporated: Catonsville MD, Woodbridge VA, Channelview TX, Linton Hall VA
  // Woodlawn MD, Annandale VA, Maplewood MN, Coram NY, North Fort Myers FL

  { name: 'Jefferson City', province: 'Missouri', url: 'https://jeffcitymo.org/council/council.html' },
  { name: 'Buffalo Grove', province: 'Illinois', url: 'https://www.vbg.org/AgendaCenter' },
  { name: 'Woonsocket', province: 'Rhode Island', url: 'https://www.woonsocketri.org/city-council/events/15173' },
  { name: 'Oakley', province: 'California', url: 'https://www.ci.oakley.ca.us/3144-2/' },
  { name: 'Eagle Mountain', province: 'Utah', url: 'https://eaglemountaincity.com/city-recorder/' },
  { name: 'Ormond Beach', province: 'Florida', url: 'https://www.ormondbeach.org/122/Agendas-Minutes-Meeting-Recordings' },
  { name: 'Moline', province: 'Illinois', url: 'https://www.moline.il.us/AgendaCenter' },
  { name: 'Huber Heights', province: 'Ohio', url: 'https://www.hhoh.org/AgendaCenter' },
  { name: 'Edmonds', province: 'Washington', url: 'https://www.edmondswa.gov/government/city_council/meetings_overview' },
  { name: 'Manassas', province: 'Virginia', url: 'https://manassascity.org/connect/mayor_and_council/index.php' },
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
