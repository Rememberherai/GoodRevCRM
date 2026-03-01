#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1125-1175
  // Unincorporated: North Fort Myers FL, Coram NY, The Acreage FL, Essex MD
  // Valley Stream NY, French Valley CA, Security-Widefield CO, Clinton MD, Meadow Woods FL

  { name: 'Schertz', province: 'Texas', url: 'https://schertz.com/273/Agendas-Minutes' },
  { name: 'Newnan', province: 'Georgia', url: 'https://www.newnan.gov/' },
  { name: 'Clermont', province: 'Florida', url: 'https://www.clermontfl.gov/AgendaCenter' },
  { name: 'Marlborough', province: 'Massachusetts', url: 'https://www.marlborough-ma.gov/agendacenter' },
  { name: 'Bartlett', province: 'Illinois', url: 'https://www.vill.bartlett.il.us/' },
  { name: 'Hollister', province: 'California', url: 'https://hollister.ca.gov/government/agendas___minutes.php' },
  { name: 'Bullhead City', province: 'Arizona', url: 'https://www.bullheadcity.com/government/departments/city-clerk/agendas-videos' },
  { name: 'Lancaster', province: 'Texas', url: 'https://www.lancaster-tx.com/1546/Agenda-and-Minutes' },
  { name: 'Grove City', province: 'Ohio', url: 'https://www.grovecityohio.gov/454/Agendas-Minutes' },
  { name: 'Marion', province: 'Iowa', url: 'https://www.cityofmarion.org/about-us/mayor-city-council/agendas-minutes/' },
  { name: 'Brookfield', province: 'Wisconsin', url: 'https://www.ci.brookfield.wi.us/AgendaCenter' },
  { name: 'Delaware', province: 'Ohio', url: 'https://www.delawareohio.net/government/city-council-boards-commissions-committees/agendas-motion-summaries' },
  { name: 'Hallandale Beach', province: 'Florida', url: 'https://cohb.org/Calendar.aspx?CID=50' },
  { name: 'Woburn', province: 'Massachusetts', url: 'https://woburnma.gov/minutes-agendas/' },
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
