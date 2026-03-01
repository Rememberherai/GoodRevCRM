#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 501-510
  { name: 'Casa Grande', province: 'Arizona', url: 'https://www.casagrandeaz.gov/agendacenter' },
  { name: 'Orland Park', province: 'Illinois', url: 'https://www.orlandpark.org/government/meeting-notices' },
  { name: 'Valley Stream', province: 'New York', url: 'https://www.vsvny.org/index.asp?SEC=7688056C-67A0-42DE-9A59-69D72093951A&DE=395CE9E4-B1E4-4979-8F47-10BAB34F53C4' },
  { name: 'Palm Beach Gardens', province: 'Florida', url: 'https://www.pbgfl.gov/482/Agendas' },
  { name: 'Moore', province: 'Oklahoma', url: 'https://www.cityofmoore.com/government/archives-public-meetings' },
  { name: 'Germantown', province: 'Tennessee', url: 'https://www.germantown-tn.gov/government/city-boards-commissions/board-and-commission-schedules-and-archives' },
  { name: 'Great Falls', province: 'Montana', url: 'https://greatfallsmt.net/meetings' },
  { name: 'St. Peters', province: 'Missouri', url: 'https://www.stpetersmo.net/290/Mayor-Board-of-Aldermen' },
  { name: 'Lakewood', province: 'Colorado', url: 'https://lakewoodspeaks.org/' },
  { name: 'Homestead', province: 'Florida', url: 'https://www.homesteadfl.gov/agenda' },

  // Cities 511-520
  { name: 'Leander', province: 'Texas', url: 'https://www.leandertx.gov/129/Agendas-Minutes' },
  { name: 'Gilroy', province: 'California', url: 'https://cityofgilroy.org/965/Agendas-Minutes' },
  { name: 'Oak Lawn', province: 'Illinois', url: 'https://www.oaklawn-il.gov/government/' },
  { name: 'Highland', province: 'California', url: 'https://www.cityofhighland.org/AgendaCenter' },
  { name: 'Draper', province: 'Utah', url: 'https://www.draperutah.gov/city-government/agendas-and-minutes/' },
  { name: 'Pflugerville', province: 'Texas', url: 'https://pflugerville.legistar.com/' },
  { name: 'Grand Junction', province: 'Colorado', url: 'https://www.gjcity.org/129/Agendas-Minutes' },
  { name: 'Woonsocket', province: 'Rhode Island', url: 'https://woonsocketri.civicweb.net/portal/' },
  { name: 'Colton', province: 'California', url: 'https://www.coltonca.gov/agendacenter' },
  { name: 'Delray Beach', province: 'Florida', url: 'https://delraybeach.legistar.com/' },

  // Cities 521-530
  { name: 'Haltom City', province: 'Texas', url: 'https://www.haltomcitytx.com/AgendaCenter/City-Council-17' },
  { name: 'Ceres', province: 'California', url: 'https://www.ceres.gov/AgendaCenter' },
  { name: 'Rancho Cucamonga', province: 'California', url: 'https://www.cityofrc.us/your-government/city-council-agendas' },
  { name: 'Prescott', province: 'Arizona', url: 'https://prescott-az.gov/prescott-city-clerk/council-meetings/' },
  { name: 'Dublin', province: 'California', url: 'https://www.dublin.ca.gov/1604/Meetings-Agendas-Minutes-Video-on-Demand' },
  { name: 'Chino Hills', province: 'California', url: 'https://www.chinohills.org/60/Agendas-Minutes' },
  { name: 'Georgetown', province: 'Texas', url: 'https://georgetowntx.novusagenda.com/AgendaPublic/MeetingsResponsive.aspx' },
  { name: 'Edinburg', province: 'Texas', url: 'https://cityofedinburg.com/government/agendas_and_minutes/index.php' },
  { name: 'Rocklin', province: 'California', url: 'https://www.rocklin.ca.us/city-council-meetings' },
  { name: 'Mission Viejo', province: 'California', url: 'https://dms.cityofmissionviejo.org/OnBaseAgendaOnline' },

  // Cities 531-540
  { name: 'Sarasota', province: 'Florida', url: 'https://www.sarasotafl.gov/City-Services/Meetings-Agendas-Videos' },
  { name: 'Cedar Park', province: 'Texas', url: 'https://www.cedarparktexas.gov/596/City-Council-Agendas' },
  { name: 'Porterville', province: 'California', url: 'https://portervilleca.portal.civicclerk.com/' },
  { name: 'Hendersonville', province: 'Tennessee', url: 'https://www.hvilletn.org/agendacenter' },
  { name: 'Roseville', province: 'Michigan', url: 'https://www.roseville-mi.gov/AgendaCenter' },
  { name: 'Warren', province: 'Michigan', url: 'https://www.cityofwarren.org/government/city-council/' },
  { name: 'Brentwood', province: 'California', url: 'https://www.brentwoodca.gov/government/city-council' },
  { name: 'North Richland Hills', province: 'Texas', url: 'https://nrhtx.legistar.com/' },
  { name: 'Weston', province: 'Florida', url: 'https://www.westonfl.org/government/agendas-and-minutes' },
  { name: 'Cathedral City', province: 'California', url: 'https://www.cathedralcity.gov/government/agendas-minutes/agendas-and-minutes' },

  // Cities 541-550
  { name: 'San Jacinto', province: 'California', url: 'https://www.sanjacintoca.gov/city_departments/city-clerk/city-council-meetings-and-planning-commission' },
  { name: 'Alpharetta', province: 'Georgia', url: 'https://alpharettaga.portal.civicclerk.com' },
  { name: 'Palo Alto', province: 'California', url: 'https://www.paloalto.gov/Departments/City-Clerk/City-Meeting-Groups/Meeting-Agendas-and-Minutes' },
  { name: 'Wellington', province: 'Florida', url: 'https://www.wellingtonfl.gov/300/Agendas-Meetings' },
  { name: 'Maricopa', province: 'Arizona', url: 'https://maricopa.legistar.com/' },
  { name: 'Diamond Bar', province: 'California', url: 'http://diamondbarca.iqm2.com/Citizens/Default.aspx' },
  { name: 'Stillwater', province: 'Oklahoma', url: 'https://stillwaterok.portal.civicclerk.com/' },
  { name: 'Cedar Hill', province: 'Texas', url: 'https://www.cedarhilltx.com/75/Agendas-Minutes' },
  { name: 'Bell Gardens', province: 'California', url: 'https://bellgardens.community.highbond.com/Portal/MeetingTypeList.aspx' },
  { name: 'Palm Springs', province: 'California', url: 'https://www.palmspringsca.gov/government/city-clerk/city-council-meetings' },

  // Cities 551-560
  { name: 'Grapevine', province: 'Texas', url: 'https://www.grapevinetexas.gov/89/Agendas-Minutes' },
  { name: 'Lake Oswego', province: 'Oregon', url: 'https://www.ci.oswego.or.us/citycouncil/city-council-meetings' },
  { name: 'Wylie', province: 'Texas', url: 'https://wylie-tx.municodemeetings.com/' },
  { name: 'Titusville', province: 'Florida', url: 'https://titusville.com/129/Agenda-Center' },
  { name: 'Oro Valley', province: 'Arizona', url: 'https://www.orovalleyaz.gov/Government/Departments/Town-Clerk/Meetings-and-Agendas' },
  { name: 'Hackensack', province: 'New Jersey', url: 'https://www.hackensack.org/council-meeting-schedule/' },
  { name: 'Enid', province: 'Oklahoma', url: 'https://www.enid.org/Government/City-Clerk' },
  { name: 'Lompoc', province: 'California', url: 'https://www.cityoflompoc.com/how-do-i/access-city-council-meeting-agendas' },
  { name: 'Stanton', province: 'California', url: 'https://www.stantonca.gov/government/agendas___minutes/city_council.php' },
  { name: 'Coolidge', province: 'Arizona', url: 'https://www.coolidgeaz.com/?SEC=B3A2F728-ADEC-4D59-B3CA-6D40780E00F1' },

  // Cities 561-570
  { name: 'Peabody', province: 'Massachusetts', url: 'https://www.peabody-ma.gov/meeting%20minutes.html' },
  { name: 'Crystal Lake', province: 'Illinois', url: 'https://www.crystallake.org/your-government/city-meetings-agendas' },
  { name: 'Placentia', province: 'California', url: 'https://www.placentia.org/agendacenter' },
  { name: 'DeSoto', province: 'Texas', url: 'https://www.ci.desoto.tx.us/government/public_meeting_agendas___minutes/city_council.php' },
  { name: 'Manchester', province: 'Connecticut', url: 'https://www.manchesterct.gov/Home' },
  { name: 'Midwest City', province: 'Oklahoma', url: 'https://midwestcityok.org/AgendaCenter' },
  { name: 'Waterbury', province: 'Connecticut', url: 'https://waterburyct.org/boards-commissions/meetings/agendas-minutes' },
  { name: 'Goodyear', province: 'Arizona', url: 'https://www.goodyearaz.gov/government/departments/city-clerk-s-office/agenda-and-minutes' },
  { name: 'Hutchinson', province: 'Kansas', url: 'https://www.hutchinsonks.gov/270/Agendas-Minutes' },

  // Cities 571-580
  { name: 'Hanford', province: 'California', url: 'https://www.ci.hanford.ca.us/1451/Agendas-and-Minutes' },
  { name: 'Sanford', province: 'North Carolina', url: 'https://www.sanfordnc.net/AgendaCenter' },
  { name: 'Laguna Niguel', province: 'California', url: 'https://www.cityoflagunaniguel.org/agendacenter' },
  { name: 'Pittsfield', province: 'Massachusetts', url: 'https://www.pittsfieldma.gov/AgendaCenter/City-Council-16' },
  { name: 'Harrisonburg', province: 'Virginia', url: 'https://www.harrisonburgva.gov/agendas' },
  { name: 'Danville', province: 'California', url: 'https://www.danville.ca.gov/129/Meetings-Agendas-Minutes' },
  { name: 'Walnut Creek', province: 'California', url: 'https://www.walnutcreekca.gov/government/public-meeting-agendas-and-videos' },
  { name: 'Covina', province: 'California', url: 'https://covinaca.gov/our-city/government/city-council/agendas-minutes/' },
  { name: 'Jacksonville', province: 'North Carolina', url: 'https://jacksonvillenc.gov/agendacenter' },

  // Cities 581-590
  { name: 'Georgetown', province: 'South Carolina', url: 'https://georgetownsc.portal.civicclerk.com/' },
  { name: 'Kearny', province: 'New Jersey', url: 'https://www.kearnynj.org/council-meeting-agendas/' },
  { name: 'Blue Springs', province: 'Missouri', url: 'https://www.bluespringsgov.com/AgendaCenter' },
  { name: 'Manhattan', province: 'Kansas', url: 'https://www.manhattanks.gov/2280/Agendas-Minutes' },
  { name: 'Rock Hill', province: 'South Carolina', url: 'https://www.cityofrockhill.com/government/city-council/meetings/agendas-minutes' },
  { name: 'Bozeman', province: 'Montana', url: 'https://www.bozeman.net/departments/city-commission' },
  { name: 'Fishers', province: 'Indiana', url: 'https://fishersin.gov/agenda-center/' },
  { name: 'Newark', province: 'Ohio', url: 'http://www.newarkohio.gov/meeting-agendas/' },
  { name: 'Springfield', province: 'Oregon', url: 'https://springfield-or.gov/city/city-council-meetings/' },

  // Cities 591-600
  { name: 'St. Cloud', province: 'Florida', url: 'https://www.stcloudfl.gov/202/Meeting-Agendas-Minutes-and-Packets' },
  { name: 'La Crosse', province: 'Wisconsin', url: 'https://cityoflacrosse.legistar.com/' },
  { name: 'Rancho Santa Margarita', province: 'California', url: 'https://www.cityofrsm.org/129/Agendas-Minutes' },
  { name: 'La Habra', province: 'California', url: 'https://www.lahabraca.gov/153/City-Council' },
  { name: 'Buena Park', province: 'California', url: 'https://www.buenapark.com/city_departments/city_council/council_agenda.php' },
  { name: 'Lake Forest', province: 'California', url: 'https://www.lakeforestca.gov/city_government/agendas_and_minutes/index.php' },
  { name: 'Montebello', province: 'California', url: 'https://www.montebelloca.gov/departments/administration/city_clerks_office/agendas__minutes__and_videos' },
  { name: 'Parker', province: 'Colorado', url: 'https://www.parkerco.gov/133/Agendas---Public-Meetings' },
  { name: 'Lynwood', province: 'California', url: 'https://www.lynwoodca.gov/129/Agendas-Minutes' },
  { name: 'Gastonia', province: 'North Carolina', url: 'https://www.gastonianc.gov/agendas-minutes-videos.html' },
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
