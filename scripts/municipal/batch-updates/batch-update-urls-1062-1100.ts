#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1062-1100
  // Unincorporated: Burke VA, Odenton MD, West Babylon NY, Altadena CA
  // Puerto Rico: Trujillo Alto PR (skipped - not USA state)

  { name: 'Salem', province: 'Massachusetts', url: 'https://www.salem.com/AgendaCenter/City-Council-13/' },
  { name: 'Los Banos', province: 'California', url: 'https://losbanos.org/city-council-and-commission-meetings/' },
  { name: 'Rohnert Park', province: 'California', url: 'https://www.rpcity.org/129/Meeting-Central' },
  { name: 'Fond du Lac', province: 'Wisconsin', url: 'https://fonddulac.granicus.com/ViewPublisher.php?view_id=1' },
  { name: 'Brentwood', province: 'Tennessee', url: 'https://www.brentwoodtn.gov/Your-Government/Agendas-Minutes-Videos/City-Commission-Meetings' },
  { name: 'Freeport', province: 'New York', url: 'https://www.freeportny.gov/928/Board-of-Trustees-AgendasMinutes' },
  { name: 'Lombard', province: 'Illinois', url: 'https://www.villageoflombard.org/209/Agendas-Minutes' },
  { name: 'Plainfield', province: 'Illinois', url: 'https://www.plainfieldil.gov/government/agendas-meetings' },
  { name: 'Lompoc', province: 'California', url: 'https://www.cityoflompoc.com/government/committees-boards/city-council' },
  { name: 'Moorhead', province: 'Minnesota', url: 'https://moorheadmn.gov/government/mayor-city-council/council-meetings' },
  { name: 'Oakland Park', province: 'Florida', url: 'https://oaklandparkfl.gov/AgendaCenter' },
  { name: 'Wilkes-Barre', province: 'Pennsylvania', url: 'https://www.wilkes-barre.city/citycouncil' },
  { name: 'Campbell', province: 'California', url: 'https://www.ci.campbell.ca.us/472/City-Council' },
  { name: 'Mankato', province: 'Minnesota', url: 'https://www.mankatomn.gov/your-government/city-council/meeting-agendas-and-information' },
  { name: 'Pittsfield', province: 'Massachusetts', url: 'https://www.pittsfieldma.gov/agendacenter' },
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
