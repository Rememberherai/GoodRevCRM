#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 431-440
  { name: 'Everett', province: 'Massachusetts', url: 'https://cityofeverett.com/city-hall/departments/city-clerk/agenda/' },
  { name: 'Mishawaka', province: 'Indiana', url: 'https://mishawakain.portal.civicclerk.com/' },
  { name: 'Apple Valley', province: 'California', url: 'https://applevalley.org/government/meetings-and-agendas/' },
  { name: 'Summerville', province: 'South Carolina', url: 'https://summervillesc.gov/AgendaCenter' },
  { name: 'Sheboygan', province: 'Wisconsin', url: 'https://sheboygan-wi.municodemeetings.com/' },
  { name: 'West Haven', province: 'Connecticut', url: 'https://www.cityofwesthaven.com/AgendaCenter/City-Council-2' },
  { name: 'Iowa City', province: 'Iowa', url: 'https://www.icgov.org/government/city-council/agendas-and-minutes' },
  { name: 'Perth Amboy', province: 'New Jersey', url: 'https://www.perthamboynj.org/government/agendas_minutes/city_council' },
  { name: 'Woodland', province: 'California', url: 'https://www.cityofwoodland.gov/agendacenter' },
  { name: 'North Little Rock', province: 'Arkansas', url: 'http://nlr.ar.gov/government/city_council' },

  // Cities 441-450
  { name: 'Weymouth', province: 'Massachusetts', url: 'https://www.weymouth.ma.us/town-council/pages/2025-minutes-agendas-archive' },
  { name: 'Battle Creek', province: 'Michigan', url: 'https://www.battlecreekmi.gov/420/Agendas-Minutes-Videos' },
  { name: 'Auburn', province: 'Alabama', url: 'https://www.auburnal.gov/agenda/' },
  { name: 'Rocky Hill', province: 'Connecticut', url: 'https://rockyhillct.gov/agendacenter' },
  { name: 'East Lansing', province: 'Michigan', url: 'https://cityofeastlansing.civicweb.net/Portal/' },
  { name: 'Glendora', province: 'California', url: 'https://meetings.ci.glendora.ca.us/onbaseagendaonline' },
  { name: 'Portage', province: 'Michigan', url: 'https://portagemi.portal.civicclerk.com/' },
  { name: 'Wheaton', province: 'Illinois', url: 'https://www.wheaton.il.us/AgendaCenter/City-Council-24' },
  { name: 'Bartlett', province: 'Tennessee', url: 'https://www.cityofbartlett.org/42/Read-Board-Agendas-Minutes' },
  { name: 'Revere', province: 'Massachusetts', url: 'https://www.revere.org/elected-officials/city-council' },

  // Cities 451-460
  { name: 'Apopka', province: 'Florida', url: 'https://apopkafl.portal.civicclerk.com/' },
  { name: 'Bowie', province: 'Maryland', url: 'https://www.cityofbowie.org/138/Agendas-Minutes-Status-Reports' },
  { name: 'Grove City', province: 'Ohio', url: 'https://grovecityoh.portal.civicclerk.com/' },
  { name: 'Coon Rapids', province: 'Minnesota', url: 'https://www.coonrapidsmn.gov/572/Agendas-Minutes' },
  { name: 'Hallandale Beach', province: 'Florida', url: 'https://hallandalebeach.legistar.com/MainBody.aspx' },
  { name: 'Passaic', province: 'New Jersey', url: 'https://www.cityofpassaic.com/AgendaCenter/City-Council-4' },
  { name: 'Elkhart', province: 'Indiana', url: 'https://www.elkhartindiana.org/council/' },
  { name: 'Linden', province: 'New Jersey', url: 'https://linden-nj.gov/documents/city-council-meetings/' },
  { name: 'Madera', province: 'California', url: 'https://www.madera.gov/home/departments/city-clerk/city-council-agendas-meetings/' },
  { name: 'Shelton', province: 'Connecticut', url: 'https://cityofshelton.org/p/minutes-agendas' },
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
