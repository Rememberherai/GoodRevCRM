#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1975-1999
  // Unincorporated/CDPs: Union Hill-Novelty Hill WA, West Puente Valley CA,
  // Brushy Creek TX (utility district), East San Gabriel CA (not separate city),
  // Camp Springs MD, Candler-McAfee GA
  // Failed searches: Junction City KS, Watertown WI, Hialeah Gardens FL,
  // Machesney Park IL

  { name: 'Searcy', province: 'Arkansas', url: 'https://www.cityofsearcy.org/city-council' },
  { name: 'Lexington', province: 'South Carolina', url: 'https://lexsc.com/AgendaCenter/Town-Council-2' },
  { name: 'Gardner', province: 'Kansas', url: 'https://www.gardnerkansas.gov/government/city_council/agendas_minutes.php' },
  { name: 'Greenfield', province: 'Indiana', url: 'https://www.greenfieldin.org/home/143-documents/451-council-minutes-and-agendas' },
  { name: 'Hopewell', province: 'Virginia', url: 'https://www.hopewellva.gov/AgendaCenter' },
  { name: 'Oakdale', province: 'California', url: 'https://www.oakdalegov.com/agendas' },
  { name: 'Shelbyville', province: 'Tennessee', url: 'https://www.shelbyvilletn.org/government/city_council/city_meetings___minutes.php' },
  { name: 'Cudahy', province: 'California', url: 'https://www.cityofcudahy.com/agendacenter' },
  { name: 'Hudson', province: 'Ohio', url: 'https://www.hudson.oh.us/814/Council-Agendas-Minutes-Videos' },
  { name: 'Middletown', province: 'Delaware', url: 'https://www.middletown.delaware.gov/meetings' },
  { name: 'Roselle', province: 'Illinois', url: 'https://www.roselle.il.us/AgendaCenter' },
  { name: 'Keene', province: 'New Hampshire', url: 'https://ci.keene.nh.us/minutes' },
  { name: 'Edgewater', province: 'Florida', url: 'https://www.cityofedgewater.org/citycouncil/page/meetings-and-agendas' },
  { name: 'Blue Island', province: 'Illinois', url: 'https://www.blueisland.org/AgendaCenter' },
  { name: 'Nixa', province: 'Missouri', url: 'https://www.nixa.com/mayor-council/' },
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
