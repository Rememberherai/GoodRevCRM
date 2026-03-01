#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 681-700
  { name: 'League City', province: 'Texas', url: 'https://www.leaguecitytx.gov/3377/Agendas-Minutes' },
  { name: 'Galveston', province: 'Texas', url: 'https://www.galvestontx.gov/AgendaCenter/City-Council-16' },
  { name: 'Lynchburg', province: 'Virginia', url: 'https://www.lynchburgva.gov/842/Council-Meeting-Agendas-Minutes-Video' },
  { name: 'Poway', province: 'California', url: 'https://poway.org/AgendaCenter' },
  { name: 'Temple', province: 'Texas', url: 'https://www.templetx.gov/departments/administration/city_secretary/recent_agendas___minutes/index.php' },
  { name: 'Porterville', province: 'California', url: 'https://www.ci.porterville.ca.us/government/city_council/meeting_agendas___minutes.php' },
  { name: 'Rocklin', province: 'California', url: 'https://www.rocklin.ca.us/city-council-meetings' },
  { name: 'St. Cloud', province: 'Minnesota', url: 'https://www.ci.stcloud.mn.us/AgendaCenter' },
  { name: 'Smyrna', province: 'Georgia', url: 'https://www.smyrnaga.gov/departments/office-of-the-city-clerk/public-meetings-calendar' },
  { name: 'Dunwoody', province: 'Georgia', url: 'https://www.dunwoodyga.gov/government/agendas-and-minutes' },
  { name: 'East Orange', province: 'New Jersey', url: 'https://www.eastorange-nj.gov/AgendaCenter' },
  { name: 'La Puente', province: 'California', url: 'https://lapuente.org/agenda/' },
  { name: 'Jackson', province: 'Tennessee', url: 'https://www.jacksontn.gov/government/citycouncil/agendaandminutes' },
  { name: 'Leesburg', province: 'Virginia', url: 'https://www.leesburgva.gov/government/mayor-council/current-council-agenda' },
  { name: 'San Rafael', province: 'California', url: 'https://www.cityofsanrafael.org/city-council-meetings/' },
  { name: 'Mentor', province: 'Ohio', url: 'https://cityofmentor.com/departments/city-council/' },
  { name: 'Mount Vernon', province: 'New York', url: 'https://www.mountvernonny.gov/AgendaCenter' },
  { name: 'San Luis Obispo', province: 'California', url: 'https://www.slocity.org/government/mayor-and-city-council/agendas-and-minutes' },
  { name: 'Conway', province: 'Arkansas', url: 'https://conwayarkansas.gov/meetings/' },
  { name: 'St. Peters', province: 'Missouri', url: 'https://www.stpetersmo.net/AgendaCenter' },

  // Cities 701-720
  { name: 'Placentia', province: 'California', url: 'https://www.placentia.org/agendacenter' },
  { name: 'Bountiful', province: 'Utah', url: 'https://www.bountifulutah.gov/agenda-minutes' },
  { name: 'Watsonville', province: 'California', url: 'https://www.watsonville.gov/AgendaCenter/City-Council-2' },
  { name: 'Cape Girardeau', province: 'Missouri', url: 'https://www.cityofcapegirardeau.org/departments/government/mayor-council/agendas-and-minutes/' },
  { name: 'La Crosse', province: 'Wisconsin', url: 'https://cityoflacrosse.legistar.com/' },
  { name: 'Haltom City', province: 'Texas', url: 'https://www.haltomcitytx.com/AgendaCenter/City-Council-17' },
  { name: 'Diamond Bar', province: 'California', url: 'https://www.diamondbarca.gov/AgendaCenter' },
  { name: 'Palm Beach Gardens', province: 'Florida', url: 'https://www.pbgfl.gov/482/Agendas' },
  { name: 'Manhattan', province: 'Kansas', url: 'https://www.manhattanks.gov/AgendaCenter/City-Commission-20/' },
  { name: 'Summerville', province: 'South Carolina', url: 'https://summervillesc.gov/AgendaCenter' },
  { name: 'Margate', province: 'Florida', url: 'https://www.margatefl.com/AgendaCenter' },
  { name: 'Bartlett', province: 'Illinois', url: 'https://www.bartlettil.gov/government/meetings-agendas-and-minutes' },
  { name: 'Chelsea', province: 'Massachusetts', url: 'https://www.chelseama.gov/government/city_council/agendas___minutes.php' },
  { name: 'Hanford', province: 'California', url: 'https://www.ci.hanford.ca.us/1451/Agendas-and-Minutes' },
  { name: 'North Richland Hills', province: 'Texas', url: 'https://nrhtx.legistar.com/' },
  { name: 'Plant City', province: 'Florida', url: 'https://www.plantcitygov.com/cityclerk/page/city-commission-agendas' },
  { name: 'Cedar Park', province: 'Texas', url: 'https://www.cedarparktexas.gov/AgendaCenter' },
  { name: 'Niagara Falls', province: 'New York', url: 'https://www.niagarafallsny.gov/government/city_council.php' },
  { name: 'Lafayette', province: 'California', url: 'https://www.lovelafayette.org/city-hall/city-council/city-council-meetings' },
  { name: 'Coconut Creek', province: 'Florida', url: 'https://www.coconutcreek.net/city-clerk/agendas-minutes' },
  { name: 'Newark', province: 'Ohio', url: 'http://www.newarkohio.gov/council-meetings/' },
  { name: 'Wilson', province: 'North Carolina', url: 'https://www.wilsonnc.org/residents/all-departments/administration/agendas' },
  { name: 'Grand Junction', province: 'Colorado', url: 'https://www.gjcity.org/AgendaCenter' },
  { name: 'Wheaton', province: 'Illinois', url: 'https://www.wheaton.il.us/AgendaCenter' },
  { name: 'Roy', province: 'Utah', url: 'https://www.royutah.gov/government/city_council.php' },
  { name: 'Germantown', province: 'Tennessee', url: 'https://www.germantown-tn.gov/government/city-boards-commissions/board-and-commission-schedules-and-archives' },
  { name: 'West Sacramento', province: 'California', url: 'https://meetings.cityofwestsacramento.org/OnBaseAgendaOnline' },
  { name: 'San Jacinto', province: 'California', url: 'https://www.sanjacintoca.gov/city_departments/city-clerk/city-council-meetings-and-planning-commission' },
  { name: 'Beaumont', province: 'Texas', url: 'https://beaumonttexas.gov/city-council/council-agenda/' },
  { name: 'Hoover', province: 'Alabama', url: 'https://hooveralabama.gov/AgendaCenter' },
  { name: 'Casa Grande', province: 'Arizona', url: 'https://www.casagrandeaz.gov/agendacenter' },
  { name: 'Goodyear', province: 'Arizona', url: 'https://www.goodyearaz.gov/government/departments/city-clerk-s-office/agenda-and-minutes' },
  { name: 'Chicopee', province: 'Massachusetts', url: 'https://www.chicopeema.gov/AgendaCenter/City-Council-6' },
  { name: 'Westfield', province: 'Massachusetts', url: 'https://www.cityofwestfield.org/AgendaCenter' },
  { name: 'San Marcos', province: 'Texas', url: 'https://www.sanmarcostx.gov/AgendaCenter/City-Council-4' },
  { name: 'Rosemead', province: 'California', url: 'https://www.cityofgilroy.org/agendacenter/city-council-12' },
  { name: 'Clearfield', province: 'Utah', url: 'https://clearfield.city/government/' },
  { name: 'St. Charles', province: 'Illinois', url: 'https://www.stcharlesil.gov/meetings' },
  { name: 'Aventura', province: 'Florida', url: 'https://www.cityofaventura.com/AgendaCenter' },
  { name: 'Bullhead City', province: 'Arizona', url: 'https://www.bullheadcity.com/government/departments/city-clerk/action-agendas' },
  { name: 'Meridian', province: 'Mississippi', url: 'https://meridianms.org/government/city-council/' },
  { name: 'Prescott', province: 'Arizona', url: 'https://prescottaz.portal.civicclerk.com/' },
  { name: 'Chapel Hill', province: 'North Carolina', url: 'https://chapelhill.legistar.com/' },
  { name: 'Cleveland', province: 'Tennessee', url: 'https://clevelandtn.gov/AgendaCenter' },
  { name: 'Greenwood', province: 'Indiana', url: 'https://www.greenwood.in.gov/boards/' },
  { name: 'St. Peters', province: 'Missouri', url: 'https://www.stpetersmo.net/AgendaCenter' },
  { name: 'Lakeville', province: 'Minnesota', url: 'https://www.lakevillemn.gov/129/Agendas-Minutes' },
  { name: 'Burlington', province: 'North Carolina', url: 'https://www.burlingtonnc.gov/1241/City-Council-Meetings---Agendas-and-Pack' },
  { name: 'Apple Valley', province: 'Minnesota', url: 'https://applevalleymn.portal.civicclerk.com/' },
  { name: 'Roseville', province: 'Michigan', url: 'https://www.roseville-mi.gov/AgendaCenter/City-Council-6' },
  { name: 'Lehi', province: 'Utah', url: 'https://www.lehi-ut.gov/government/public-meetings/' },
  { name: 'Gilroy', province: 'California', url: 'https://www.cityofgilroy.org/AgendaCenter' },
  { name: 'Murray', province: 'Utah', url: 'https://www.murray.utah.gov/1683/Agendas-and-Minutes' },
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
