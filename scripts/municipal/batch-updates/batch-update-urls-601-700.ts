#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 601-610
  { name: 'Camarillo', province: 'California', url: 'https://www.cityofcamarillo.org/departments/city_clerk/meeting_agendas___public_hearing_notices/' },
  { name: 'Carson', province: 'California', url: 'https://ci.carson.ca.us/AgendaMinutes.aspx' },
  { name: 'Arcadia', province: 'California', url: 'https://www.arcadiaca.gov/discover/city_council/city_council_meetings___agendas.php' },
  { name: 'Framingham', province: 'Massachusetts', url: 'https://www.framinghamma.gov/3662/Public-Meeting-Calendar' },
  { name: 'West New York', province: 'New Jersey', url: 'https://www.westnewyorknj.org/meetings/' },
  { name: 'Chesterfield', province: 'Missouri', url: 'https://www.chesterfield.mo.us/minutes-and-agendas.html' },
  { name: 'Oshkosh', province: 'Wisconsin', url: 'https://www.oshkoshwi.gov/CityCouncil/MeetingAgendasMinutes.aspx' },
  { name: 'Lakeville', province: 'Minnesota', url: 'https://www.lakevillemn.gov/129/Agendas-Minutes' },
  { name: 'Clovis', province: 'New Mexico', url: 'https://cityofclovis.com/government/city-council/city-council-agendas/' },
  { name: 'Gardena', province: 'California', url: 'https://cityofgardena.org/agendas-city-council/' },

  // Cities 611-620
  { name: 'Pawtucket', province: 'Rhode Island', url: 'https://clerkshq.com/Pawtucket-ri' },
  { name: 'St. George', province: 'Utah', url: 'https://sgcityutah.gov/government/city_council/agendas_and_minutes.php' },
  { name: 'Bellflower', province: 'California', url: 'https://bellflower.ca.gov/government/city_council/city_council_meetings.php' },
  { name: 'Rapid City', province: 'South Dakota', url: 'https://www.rcgov.org/agendas/city-council-agendas.html' },
  { name: 'Minot', province: 'North Dakota', url: 'https://www.minotnd.gov/819/Agenda-Minutes' },
  { name: "Coeur d'Alene", province: 'Idaho', url: 'https://www.cdaid.org/3155/departments/council/council-agenda-packets' },
  { name: 'Grand Forks', province: 'North Dakota', url: 'https://www.grandforksgov.com/government/meeting-information/meeting-agendas-minutes' },
  { name: 'Apple Valley', province: 'Minnesota', url: 'https://mn-applevalley.civicplus.com/91/Agendas-Minutes' },
  { name: 'Royal Palm Beach', province: 'Florida', url: 'https://www.royalpalmbeachfl.gov/meetings' },
  { name: 'Pasco', province: 'Washington', url: 'https://www.pasco-wa.gov/868/City-Council-Agendas-Packets' },

  // Cities 621-640
  { name: 'Merced', province: 'California', url: 'https://www.cityofmerced.org/departments/city-clerk/council-meetings/agendas-minutes' },
  { name: 'Delano', province: 'California', url: 'https://www.cityofdelano.org/82/Minutes-Agendas' },
  { name: 'Cedar Falls', province: 'Iowa', url: 'https://www.cedarfalls.com/74/City-Council-Meeting-Agendas-Minutes' },
  { name: 'Portage', province: 'Indiana', url: 'https://www.portagein.gov/237/City-Council' },
  { name: 'San Clemente', province: 'California', url: 'https://www.sanclemente.gov/AgendaCenter/City-Council-13' },
  { name: 'Lake Elsinore', province: 'California', url: 'https://www.lake-elsinore.org/204/Agendas-Minutes' },
  { name: 'Palm Desert', province: 'California', url: 'https://www.palmdesert.gov/connect/city-council' },
  { name: 'Glendora', province: 'California', url: 'https://meetings.ci.glendora.ca.us/onbaseagendaonline' },
  { name: 'Cypress', province: 'California', url: 'https://www.cypressca.org/government/city-council-meetings' },
  { name: 'Grand Island', province: 'Nebraska', url: 'https://www.grand-island.com/page/city-council-agenda-packets' },
  { name: 'Richland', province: 'Washington', url: 'https://www.ci.richland.wa.us/government/agendas-and-minutes' },
  { name: 'Caldwell', province: 'Idaho', url: 'https://www.cityofcaldwell.org/Government/City-Council/Council-Meetings' },
  { name: 'North Miami Beach', province: 'Florida', url: 'https://www.citynmb.com/539/Agendas-Minutes' },
  { name: 'Beavercreek', province: 'Ohio', url: 'http://beavercreekohio.gov/AgendaCenter' },
  { name: 'Cleveland Heights', province: 'Ohio', url: 'https://www.clevelandheights.gov/1625/City-Council-Agendas-and-Minutes' },
  { name: 'East Providence', province: 'Rhode Island', url: 'https://eastprovidenceri.gov/agendas-minutes' },
  { name: 'Hollister', province: 'California', url: 'https://hollister.ca.gov/government/city-council-agenda-minutes/' },
  { name: 'Twin Falls', province: 'Idaho', url: 'https://www.tfid.org/514/Agendas-Minutes-Videos' },
  { name: 'Commerce City', province: 'Colorado', url: 'https://www.c3gov.com/Government/City-Council' },
  { name: 'Prescott Valley', province: 'Arizona', url: 'https://www.prescottvalley-az.gov/274/Meeting-Agendas-Minutes' },

  // Cities 641-660
  { name: 'Broomfield', province: 'Colorado', url: 'https://www.broomfield.org/4079/City-Council-Meetings' },
  { name: 'Novato', province: 'California', url: 'https://www.novato.gov/government/city-council/agendas-minutes-videos' },
  { name: 'Manhattan Beach', province: 'California', url: 'https://www.manhattanbeach.gov/government/city-council/city-council-meetings-agendas-and-minutes' },
  { name: 'Tigard', province: 'Oregon', url: 'https://www.tigard-or.gov/your-government/council-agendas' },
  { name: 'Council Bluffs', province: 'Iowa', url: 'https://www.councilbluffs-ia.gov/2142/Agendas-Minutes' },
  { name: 'Rockwall', province: 'Texas', url: 'https://www.rockwall.com/meetings.asp' },
  { name: 'Dubuque', province: 'Iowa', url: 'https://www.cityofdubuque.org/68/Agendas-Minutes' },
  { name: 'Lehi', province: 'Utah', url: 'https://www.lehi-ut.gov/government/public-meetings/' },
  { name: 'Redmond', province: 'Oregon', url: 'https://www.redmondoregon.gov/government/city-council/council-meeting-info/meeting-agendas-minutes-and-video' },
  { name: 'Morgan Hill', province: 'California', url: 'https://www.morganhill.ca.gov/2101/Agendas-Minutes' },
  { name: 'Oakley', province: 'California', url: 'https://www.oakleyca.gov/129/Agendas-Minutes' },
  { name: 'Casa Grande', province: 'Arizona', url: 'https://www.casagrandeaz.gov/agendacenter' },
  { name: 'Dublin', province: 'Ohio', url: 'https://dublinohiousa.gov/council/meeting-schedule/' },
  { name: 'Huntington', province: 'Indiana', url: 'https://www.huntington.in.us/city/meetings/' },
  { name: 'Saratoga Springs', province: 'Utah', url: 'https://www.saratogasprings-ut.gov/AgendaCenter' },
  { name: 'Brunswick', province: 'Ohio', url: 'https://www.brunswick.oh.us/city-council/' },
  { name: 'Sammamish', province: 'Washington', url: 'https://sammamishwa.civicweb.net/portal/' },
  { name: 'West Des Moines', province: 'Iowa', url: 'https://www.wdm.iowa.gov/government/mayor-city-council/city-council-minutes-agendas' },
  { name: 'Aliso Viejo', province: 'California', url: 'https://avcity.org/129/Agendas-Minutes' },
  { name: 'Alpharetta', province: 'Georgia', url: 'https://alpharettaga.portal.civicclerk.com' },

  // Cities 661-680
  { name: 'Folsom', province: 'California', url: 'https://www.folsom.ca.us/government/city-clerk-s-office/council-meetings-agendas-and-minutes' },
  { name: 'Grand Prairie', province: 'Texas', url: 'https://www.gptx.org/Government/Mayor-and-City-Council/City-Council-Meetings' },
  { name: 'West Jordan', province: 'Utah', url: 'https://www.westjordan.utah.gov/citycouncil/meetings/' },
  { name: 'Rochester Hills', province: 'Michigan', url: 'https://www.rochesterhills.org/government/city_council/agenda_minutes_synopses.php' },
  { name: 'Bristol', province: 'Connecticut', url: 'https://www.bristolct.gov/AgendaCenter/City-Council-1' },
  { name: 'University City', province: 'Missouri', url: 'https://www.ucitymo.org/28/City-Council-and-City-Clerk' },
  { name: 'Pleasanton', province: 'California', url: 'https://pleasantonca.portal.civicclerk.com/' },
  { name: 'Oro Valley', province: 'Arizona', url: 'https://www.orovalleyaz.gov/Government/Departments/Town-Clerk/Meetings-and-Agendas' },
  { name: 'Cupertino', province: 'California', url: 'https://www.cupertino.org/our-city/agendas-minutes' },
  { name: 'Dearborn Heights', province: 'Michigan', url: 'https://www.dearbornheightsmi.gov/129/Agendas-Minutes' },
  { name: 'San Marcos', province: 'Texas', url: 'https://www.sanmarcostx.gov/AgendaCenter/City-Council-4' },
  { name: 'Middletown', province: 'Connecticut', url: 'https://www.middletownct.gov/129/Agendas-Minutes' },
  { name: 'Alameda', province: 'California', url: 'https://www.alamedaca.gov/GOVERNMENT/Agendas-Minutes-Announcements' },
  { name: 'Eagan', province: 'Minnesota', url: 'https://cityofeagan.com/meetings' },
  { name: 'Calumet City', province: 'Illinois', url: 'https://calumet-il.municodemeetings.com/' },
  { name: 'Draper', province: 'Utah', url: 'https://www.draperutah.gov/95/Agendas-Minutes' },
  { name: 'Cary', province: 'North Carolina', url: 'https://www.carync.gov/mayor-council/meeting-calendar' },
  { name: 'Bentonville', province: 'Arkansas', url: 'https://bentonvillear.com/592/Agendas-Minutes' },
  { name: 'Moorhead', province: 'Minnesota', url: 'https://www.cityofmoorhead.com/government/mayor-city-council/council-meetings' },
  { name: 'Kentwood', province: 'Michigan', url: 'https://www.kentwood.us/city_services/committees_and_boards/agendas_and_minutes/index.php' },
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
