#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 201-210
  { name: 'St. Cloud', province: 'Minnesota', url: 'https://www.ci.stcloud.mn.us/AgendaCenter' },
  // Note: Skipping Arecibo, Puerto Rico (city 202) - territory, not state
  { name: 'Kenosha', province: 'Wisconsin', url: 'https://www.kenosha.org/government/common-council/agendas-minutes' },
  { name: 'Greenville', province: 'North Carolina', url: 'https://www.greenvillenc.gov/government/city-council/city-council-meetings/' },
  { name: 'Arvada', province: 'Colorado', url: 'https://arvadaco.portal.civicclerk.com/' },
  { name: 'Texas City', province: 'Texas', url: 'https://www.texascitytx.gov/agendacenter' },
  { name: 'Redding', province: 'California', url: 'https://reddingca.granicus.com/ViewPublisher.php?view_id=4' },
  { name: 'Lynchburg', province: 'Virginia', url: 'https://lynchburgva.portal.civicclerk.com/' },
  { name: 'Boulder', province: 'Colorado', url: 'https://bouldercolorado.gov/city-council-agendas-and-materials' },
  { name: 'Iowa City', province: 'Iowa', url: 'https://www.icgov.org/government/city-council/agendas-and-minutes' },
  { name: 'Berkeley', province: 'California', url: 'https://berkeleyca.gov/your-government/city-council/city-council-agendas' },

  // Cities 211-220
  // Note: Skipping Waldorf, Maryland (unincorporated, no city council)
  // Note: Skipping The Villages, Florida (unincorporated, no city council)
  { name: 'Duluth', province: 'Minnesota', url: 'https://duluth-mn.legistar.com/' },
  // Note: Skipping East Los Angeles, California (unincorporated, no city council)
  { name: 'Saginaw', province: 'Michigan', url: 'https://www.saginaw-mi.com/AgendaCenter/City-Council-2/' },
  { name: 'Clovis', province: 'California', url: 'https://www.clovisca.gov/government/city_council/agendas_meetings_minutes.php' },
  { name: 'Leominster', province: 'Massachusetts', url: 'https://www.leominster-ma.gov/AgendaCenter/City-Council-3' },
  { name: 'Round Rock', province: 'Texas', url: 'https://roundrock.legistar.com/' },
  { name: 'Monroe', province: 'Louisiana', url: 'https://monroela.us/government/city-council/city-council-meetings/' },
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
  console.log(`⏭️  Skipped: Arecibo PR, Waldorf MD, The Villages FL, East Los Angeles CA (territories/unincorporated)`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
