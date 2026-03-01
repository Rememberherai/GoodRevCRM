#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Top 10 cities (1.4M+ population)
  { name: 'New York', province: 'New York', url: 'https://legistar.council.nyc.gov/Calendar.aspx' },
  { name: 'Los Angeles', province: 'California', url: 'https://clerk.lacity.gov/calendar' },
  { name: 'Chicago', province: 'Illinois', url: 'https://chicago.legistar.com/Calendar.aspx' },
  { name: 'Miami', province: 'Florida', url: 'https://www.miami.gov/My-Government/Meeting-Calendars-Agendas-and-Comments' },
  { name: 'Dallas', province: 'Texas', url: 'https://cityofdallas.legistar.com/' },
  { name: 'Houston', province: 'Texas', url: 'https://houston.novusagenda.com/agendapublic/' },
  { name: 'Philadelphia', province: 'Pennsylvania', url: 'https://phila.legistar.com/calendar.aspx' },
  { name: 'Atlanta', province: 'Georgia', url: 'https://citycouncil.atlantaga.gov/standing-committees/meeting-agendas/agenda' },
  { name: 'Washington', province: 'District of Columbia', url: 'https://dc.granicus.com/viewpublisher.php?view_id=2' },
  { name: 'Boston', province: 'Massachusetts', url: 'https://boston.legistar.com/' },

  // Cities 11-20 (2.4M - 4M population)
  { name: 'Phoenix', province: 'Arizona', url: 'https://phoenix.legistar.com/' },
  { name: 'Detroit', province: 'Michigan', url: 'https://detroit.legistar.com/' },
  { name: 'Seattle', province: 'Washington', url: 'https://seattle.legistar.com/' },
  { name: 'San Francisco', province: 'California', url: 'https://sfgov.legistar.com/' },
  { name: 'San Diego', province: 'California', url: 'https://www.sandiego.gov/city-clerk/city-council-docket-agenda' },
  { name: 'Minneapolis', province: 'Minnesota', url: 'https://lims.minneapolismn.gov/CityCouncil/Meetings' },
  { name: 'Brooklyn', province: 'New York', url: 'https://legistar.council.nyc.gov/Calendar.aspx' },
  { name: 'Tampa', province: 'Florida', url: 'https://tampa.gov/agendas' },
  { name: 'Denver', province: 'Colorado', url: 'https://denver.legistar.com/' },
  { name: 'Queens', province: 'New York', url: 'https://legistar.council.nyc.gov/Calendar.aspx' },

  // Cities 21-35 (685K - 1.47M population)
  { name: 'Bronx', province: 'New York', url: 'https://legistar.council.nyc.gov/Calendar.aspx' },
  { name: 'Milwaukee', province: 'Wisconsin', url: 'https://milwaukee.legistar.com/' },
  { name: 'Providence', province: 'Rhode Island', url: 'https://providenceri.iqm2.com/Citizens/calendar.aspx' },
  { name: 'Jacksonville', province: 'Florida', url: 'https://jaxcityc.legistar.com/' },
  { name: 'Salt Lake City', province: 'Utah', url: 'https://www.slc.gov/council/agendas/' },
  { name: 'Nashville', province: 'Tennessee', url: 'https://nashville.legistar.com/' },
  { name: 'Raleigh', province: 'North Carolina', url: 'https://go.boarddocs.com/nc/raleigh/Board.nsf/Public' },
  { name: 'Memphis', province: 'Tennessee', url: 'https://memphistn.gov/city-council-meeting-agenda/' },
  { name: 'Louisville', province: 'Kentucky', url: 'https://louisvilleky.gov/government/metro-council/calendar-agendas' },
  { name: 'Richmond', province: 'Virginia', url: 'https://richmondva.legistar.com/' },
  { name: 'Buffalo', province: 'New York', url: 'https://www.buffalony.gov/AgendaCenter' },
  { name: 'Oklahoma City', province: 'Oklahoma', url: 'https://www.okc.gov/Government/Public-Meetings-and-Agendas/Public-Meeting-Calendar' },
  { name: 'Bridgeport', province: 'Connecticut', url: 'https://www.bridgeportct.gov/government/boards-and-commissions/city-council/city-council/city-council-meeting-minutes-agendas-and-notices' },
  { name: 'New Orleans', province: 'Louisiana', url: 'https://council.nola.gov/meetings/' },
  { name: 'Fort Worth', province: 'Texas', url: 'https://fortworthgov.legistar.com/' },

  // Cities 36-50 (685K - 909K population)
  { name: 'Hartford', province: 'Connecticut', url: 'https://hartford.civicweb.net/Portal/MeetingInformation.aspx' },
  { name: 'Tucson', province: 'Arizona', url: 'https://www.tucsonaz.gov/Government/Mayor-Council-and-City-Manager/Meeting-Schedules-Agendas' },
  { name: 'Honolulu', province: 'Hawaii', url: 'https://hnldoc.ehawaii.gov/hnldoc/browse/agendas' },
  { name: 'McAllen', province: 'Texas', url: 'https://mcallentx.portal.civicclerk.com' },
  { name: 'Omaha', province: 'Nebraska', url: 'https://cityclerk.cityofomaha.org/category/city-council-downloads/agendas/' },
  { name: 'El Paso', province: 'Texas', url: 'https://elpasotexas.legistar.com/' },
  { name: 'Albuquerque', province: 'New Mexico', url: 'https://cabq.legistar.com/' },
  { name: 'Rochester', province: 'New York', url: 'https://www.cityofrochester.gov/departments/city-council/city-council-legislation-meeting-minutes-and-proceedings' },
  { name: 'Sarasota', province: 'Florida', url: 'https://www.sarasotafl.gov/City-Services/Meetings-Agendas-Videos' },
  { name: 'Fresno', province: 'California', url: 'https://fresno.legistar.com/' },
  { name: 'Tulsa', province: 'Oklahoma', url: 'https://www.tulsacouncil.org/meetings' },
  { name: 'Allentown', province: 'Pennsylvania', url: 'https://allentownpa.legistar.com/Calendar.aspx' },
  { name: 'Dayton', province: 'Ohio', url: 'https://www.daytonohio.gov/AgendaCenter/City-Commission-2' },
  { name: 'Birmingham', province: 'Alabama', url: 'https://www.birminghamalcitycouncil.org/council-meeting-agendas/' },
  { name: 'Charleston', province: 'South Carolina', url: 'https://www.charleston-sc.gov/AgendaCenter/City-Council-7' },
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
