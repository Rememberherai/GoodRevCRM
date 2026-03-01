#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1475-1550
  // Unincorporated: Lake Magdalene FL, Sterling VA, Oceanside NY, Lakeside FL,
  // West Falls Church VA, Bel Air North MD, Orcutt CA, Parkville MD, Milford Mill MD,
  // Middle River MD, Drexel Heights AZ, Ferry Pass FL, San Lorenzo CA, Granger IN,
  // Austintown OH, East Lake-Orient Park FL, Eastern Goleta Valley CA, Carney MD, Crofton MD

  { name: 'Alamogordo', province: 'New Mexico', url: 'https://ci.alamogordo.nm.us/129/Agendas-Minutes' },
  { name: 'Saratoga', province: 'California', url: 'https://www.saratoga.ca.us/AgendaCenter/City-Council-13' },
  { name: 'North Royalton', province: 'Ohio', url: 'https://www.northroyalton.org/government/council_office/agendas_minutes.php' },
  { name: 'Burlingame', province: 'California', url: 'https://www.burlingame.org/169/City-Council---Agendas-and-Minutes' },
  { name: 'Oak Ridge', province: 'Tennessee', url: 'https://www.oakridgetn.gov/210/Agendas-Minutes' },
  { name: 'Nicholasville', province: 'Kentucky', url: 'https://nicholasville.org/city-commission/' },
  { name: 'New Bern', province: 'North Carolina', url: 'https://www.newbernnc.gov/departments/administration/meeting_agendas_and_minutes.php' },
  { name: 'LaGrange', province: 'Georgia', url: 'https://lagrangega.org/' },
  { name: 'Ballwin', province: 'Missouri', url: 'https://www.ballwin.mo.us/Board-of-Aldermen-Meeting-Agendas-and-Minutes/' },
  { name: 'Cleburne', province: 'Texas', url: 'https://www.cleburne.net/AgendaCenter/City-Council-1' },
  { name: 'Niles', province: 'Illinois', url: 'https://www.vniles.com/1392/Agendas-and-Minutes' },
  { name: 'Westfield', province: 'New Jersey', url: 'https://www.westfieldnj.gov/AgendaCenter' },
  { name: 'Cornelius', province: 'North Carolina', url: 'https://cornelius.org/' },
  { name: 'SeaTac', province: 'Washington', url: 'https://www.seatacwa.gov/government/meeting-agendas-minutes' },
  { name: 'Garner', province: 'North Carolina', url: 'https://www.garnernc.gov/government/town-council/town-council-agendas-and-minutes' },
  { name: 'Gurnee', province: 'Illinois', url: 'https://www.gurnee.il.us/government/schedule-agenda-minutes-videos' },
  { name: 'Opelika', province: 'Alabama', url: 'https://www.opelika-al.gov/129/Agendas-Minutes' },
  { name: 'Hopkinsville', province: 'Kentucky', url: 'https://www.hopkinsvilleky.us/departments/city_clerk/meeting_agendas_minutes_and_packets.php' },
  { name: 'Southlake', province: 'Texas', url: 'https://www.cityofsouthlake.com/AgendaCenter' },
  { name: 'San Carlos', province: 'California', url: 'https://www.cityofsancarlos.org/city_hall/public_meetings.php' },
  { name: 'Santa Paula', province: 'California', url: 'http://www.ci.santa-paula.ca.us/agenda/index.htm' },
  { name: 'Princeton', province: 'New Jersey', url: 'https://www.princetonnj.gov/AgendaCenter' },
  { name: 'Bowling Green', province: 'Ohio', url: 'https://www.bgohio.org/AgendaCenter/City-Council-6' },
  { name: 'North Chicago', province: 'Illinois', url: 'https://www.northchicago.org/agendas_minutes' },
  { name: 'North Tonawanda', province: 'New York', url: 'https://www.northtonawanda.org/file-library.php' },
  { name: 'Miami Lakes', province: 'Florida', url: 'https://www.miamilakes-fl.gov/publishedagendas/' },
  { name: 'Morristown', province: 'Tennessee', url: 'https://www.mymorristown.com/government/council/agendas___minutes/index.php' },
  { name: 'Weatherford', province: 'Texas', url: 'https://weatherfordtx.gov/651/Agendas-Meetings-Minutes' },
  { name: 'Northport', province: 'Alabama', url: 'https://www.cityofnorthport.org/' },
  { name: 'Lawrenceville', province: 'Georgia', url: 'https://www.lawrencevillega.org/129/Agendas-Minutes' },
  { name: 'Galesburg', province: 'Illinois', url: 'https://www.ci.galesburg.il.us/resources/city_service_information/agendas_and_minutes/city_council.php' },
  { name: 'Zionsville', province: 'Indiana', url: 'https://zionsville-in.gov/AgendaCenter/Zionsville-Town-Council-10' },
  { name: 'Highland Park', province: 'Illinois', url: 'https://www.cityhpil.com/government/city_council/council_meeting_agendas_minutes.php' },
  { name: 'Liberty', province: 'Missouri', url: 'https://libertymissouri.gov/1523/City-Council-Agendas-Videos' },
  { name: 'Sanford', province: 'North Carolina', url: 'https://www.sanfordnc.net/AgendaCenter' },
  { name: 'Monterey', province: 'California', url: 'https://monterey.org/category/city-council' },
  { name: 'Southgate', province: 'Michigan', url: 'https://www.southgatemi.org/government/city_council_agenda_packets.php' },
  { name: 'Chamblee', province: 'Georgia', url: 'https://www.chambleega.com/city_clerk_s_office/agendas___minutes.php' },
  { name: 'East Palo Alto', province: 'California', url: 'https://www.cityofepa.org/citycouncil/page/agenda-and-minutes' },
  { name: 'Algonquin', province: 'Illinois', url: 'https://www.algonquin.org/board/' },
  { name: 'Bella Vista', province: 'Arkansas', url: 'https://www.bellavistaar.gov/government/elected_officials/agendas___minutes.php' },
  { name: 'Gloucester', province: 'Massachusetts', url: 'https://gloucester-ma.gov/121/City-Council' },
  { name: 'Atascadero', province: 'California', url: 'https://www.atascadero.org/committee/city-council' },
  { name: 'Oak Park', province: 'Michigan', url: 'https://www.oakparkmi.gov/' },
  { name: 'New Smyrna Beach', province: 'Florida', url: 'https://www.cityofnsb.com/AgendaCenter' },
  { name: 'Winter Park', province: 'Florida', url: 'https://cityofwinterpark.org/government/city-commission/meetings/' },
  { name: "O'Fallon", province: 'Illinois', url: 'https://www.ofallon.org/city-council/agenda/city-council-agenda-1' },
  { name: 'Rome', province: 'New York', url: 'https://romenewyork.com/meetings/' },
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
