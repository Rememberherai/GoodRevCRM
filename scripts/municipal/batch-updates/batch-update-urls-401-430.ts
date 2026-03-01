#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 401-410
  { name: 'Rancho Cordova', province: 'California', url: 'https://ranchocordovaca.portal.civicclerk.com/' },
  { name: 'Santa Maria', province: 'California', url: 'https://www.cityofsantamaria.org/services/departments/city-clerk-records/agenda-center-meetings-portal' },
  { name: 'Georgetown', province: 'Texas', url: 'https://georgetowntx.novusagenda.com/AgendaPublic/MeetingsResponsive.aspx' },
  { name: 'St. Charles', province: 'Missouri', url: 'https://www.stcharlescitymo.gov/AgendaCenter/City-Council-1' },
  { name: 'Lake Havasu City', province: 'Arizona', url: 'https://www.lhcaz.gov/city-clerk/agendas-minutes' },
  { name: 'Alameda', province: 'California', url: 'https://www.alamedaca.gov/GOVERNMENT/Agendas-Minutes-Announcements' },
  { name: 'Burien', province: 'Washington', url: 'https://burienwa.civicweb.net/portal/' },
  { name: 'Jupiter', province: 'Florida', url: 'https://www.jupiter.fl.us/348/Agendas-Minutes' },
  { name: 'Tigard', province: 'Oregon', url: 'https://www.tigard-or.gov/your-government/council-agendas' },
  { name: 'Danbury', province: 'Connecticut', url: 'https://www.danbury-ct.gov/AgendaCenter/City-Council-20' },

  // Cities 411-420
  { name: 'Dunwoody', province: 'Georgia', url: 'https://www.dunwoodyga.gov/government/agendas-and-minutes' },
  { name: 'Jurupa Valley', province: 'California', url: 'https://www.jurupavalley.org/AgendaCenter' },
  { name: 'Berwyn', province: 'Illinois', url: 'https://www.berwyn-il.gov/government/council-agendas-minutes' },
  { name: 'Morgan Hill', province: 'California', url: 'https://morganhillca.portal.civicclerk.com/' },
  { name: 'Calexico', province: 'California', url: 'https://www.calexico.ca.gov/councilagendas' },
  { name: 'Dubuque', province: 'Iowa', url: 'https://dubuqueia.portal.civicclerk.com/' },
  { name: 'East Orange', province: 'New Jersey', url: 'https://www.eastorange-nj.gov/AgendaCenter/City-Council-2' },
  { name: 'Blaine', province: 'Minnesota', url: 'https://blainemn.portal.civicclerk.com/' },
  { name: 'Huntington Park', province: 'California', url: 'https://www.hpca.gov/58/Agendas-and-Minutes' },
  { name: 'North Port', province: 'Florida', url: 'https://cityofnorthport.legistar.com/' },

  // Cities 421-430
  { name: 'Royal Oak', province: 'Michigan', url: 'https://romi.gov/1867/Meeting-Agendas-and-Minutes' },
  { name: 'Paramount', province: 'California', url: 'https://www.paramountcity.gov/government/city-council/meeting-agendas-minutes/' },
  { name: 'Elyria', province: 'Ohio', url: 'https://www.cityofelyria.org/city-council-updates/' },
  { name: 'Norwich', province: 'Connecticut', url: 'https://www.norwichct.gov/AgendaCenter/City-Council-9/' },
  { name: 'Coachella', province: 'California', url: 'https://www.coachella.org/city-government/city-council/agendas-and-minutes' },
  { name: 'Cedar Rapids', province: 'Iowa', url: 'https://cedar-rapids.org/local_government/city_council/city_council_meetings/index.php' },
  { name: 'Olympia', province: 'Washington', url: 'https://olympia.legistar.com/' },
  { name: 'Brookfield', province: 'Wisconsin', url: 'https://www.ci.brookfield.wi.us/AgendaCenter/Common-Council-1/' },
  { name: 'Prescott Valley', province: 'Arizona', url: 'https://www.pvaz.net/274/Meeting-Agendas-Minutes' },
  { name: 'Bell', province: 'California', url: 'https://www.cityofbell.gov/City-Hall/City-Clerk/Agendas-and-Minutes' },
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
