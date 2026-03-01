#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 751-760
  { name: 'Rome', province: 'Georgia', url: 'https://www.romega.us/AgendaCenter' },
  { name: 'Schenectady', province: 'New York', url: 'https://www.cityofschenectady.gov/AgendaCenter/City-Council-5' },
  { name: 'DeKalb', province: 'Illinois', url: 'https://www.cityofdekalb.com/AgendaCenter/City-Council-15' },
  { name: 'Petaluma', province: 'California', url: 'https://cityofpetaluma.org/meetings/' },
  { name: 'Sammamish', province: 'Washington', url: 'https://sammamishwa.civicweb.net/portal/' }, // Already in 601-700
  { name: 'Georgetown', province: 'Texas', url: 'https://georgetowntexas.gov/government/city_council/meeting_agendas/' }, // Already in 501-600
  { name: 'Carbondale', province: 'Illinois', url: 'https://www.explorecarbondale.com/AgendaCenter/City-Council-2' },
  { name: 'Delray Beach', province: 'Florida', url: 'https://delraybeach.legistar.com/' },
  { name: 'Kenner', province: 'Louisiana', url: 'https://www.kenner.la.us/AgendaCenter/City-Council-4' },
  { name: 'Albany', province: 'Oregon', url: 'https://albanyoregon.gov/council/materials' },

  // Cities 761-770
  { name: 'Ankeny', province: 'Iowa', url: 'https://www.ankenyiowa.gov/129/Agendas-Minutes' },
  { name: 'South San Francisco', province: 'California', url: 'https://ci-ssf-ca.legistar.com/' },
  { name: 'Saratoga Springs', province: 'New York', url: 'https://www.saratoga-springs.org/AgendaCenter/City-Council-2' },
  { name: 'Corvallis', province: 'Oregon', url: 'https://www.corvallisoregon.gov/mc/page/council-meeting-materials' },
  { name: 'Brentwood', province: 'New York', url: 'https://pub-brentwood.escribemeetings.com/' }, // This is Brentwood CA, not NY
  { name: 'Ames', province: 'Iowa', url: 'https://www.cityofames.org/My-Government/Departments/City-Clerk/City-Council-Meetings-Agendas-Minutes' },
  { name: 'Glens Falls', province: 'New York', url: 'https://www.cityofglensfallsny.gov/AgendaCenter' },
  { name: 'Michigan City', province: 'Indiana', url: 'https://michigancityin.gov/government/boards-commissions/city-council/' },
  { name: 'Victoria', province: 'Texas', url: 'https://victoriatx.civicweb.net/Portal/MeetingTypeList.aspx' },
  { name: 'Malden', province: 'Massachusetts', url: 'https://www.cityofmalden.org/AgendaCenter/City-Council-37' },

  // Cities 771-780
  { name: 'Weirton', province: 'West Virginia', url: 'https://www.cityofweirton.com/AgendaCenter/City-Council-2' },
  { name: 'Novi', province: 'Michigan', url: 'https://cityofnovi.org/agendas-minutes/' },
  { name: 'Alpharetta', province: 'Georgia', url: 'https://alpharettaga.portal.civicclerk.com' }, // Already in earlier batches
  { name: 'Waltham', province: 'Massachusetts', url: 'https://www.city.waltham.ma.us/minutes-and-agendas' },
  { name: 'Laguna Niguel', province: 'California', url: 'https://www.cityoflagunaniguel.org/agendacenter' }, // Already in 501-600
  { name: 'San Clemente', province: 'California', url: 'https://www.sanclemente.gov/AgendaCenter/City-Council-13' }, // Already in 601-700
  { name: 'North Little Rock', province: 'Arkansas', url: 'https://nlr.ar.gov/events/category/city-council/' },
  { name: 'Fairbanks', province: 'Alaska', url: 'https://www.fairbanksalaska.us/meetings' },
  { name: 'Eden Prairie', province: 'Minnesota', url: 'https://www.edenprairiemn.gov/city-government/city-council/city-council-meetings' },

  // Cities 787-795
  { name: 'Pflugerville', province: 'Texas', url: 'https://www.pflugervilletx.gov/departments/city-secretary/city-council-meetings' }, // Already in 381-410
  { name: 'Casper', province: 'Wyoming', url: 'https://cityofcasper.hosted.civiclive.com/government/city_meetings_and_agendas' },
  { name: 'Burnsville', province: 'Minnesota', url: 'https://burnsville.civicweb.net/Portal/' },
  { name: 'Grand Forks', province: 'North Dakota', url: 'https://www.grandforksgov.com/government/meeting-information/meeting-agendas-minutes' }, // Already in 381-410
  { name: 'Brentwood', province: 'California', url: 'https://pub-brentwood.escribemeetings.com/' }, // Already in 351-380
  { name: 'Millcreek', province: 'Utah', url: 'https://www.millcreekut.gov/AgendaCenter' },
  { name: 'Elmira', province: 'New York', url: 'https://www.cityofelmirany.gov/AgendaCenter' },
  { name: 'Sebring', province: 'Florida', url: 'https://www.mysebring.com/AgendaCenter' },
  { name: 'La Habra', province: 'California', url: 'https://www.lahabraca.gov/153/City-Council' }, // Already in 501-600
  { name: 'Coon Rapids', province: 'Minnesota', url: 'https://www.coonrapidsmn.gov/572/Agendas-Minutes' }, // Already in 431-460

  // Cities 797-810
  { name: 'Bossier City', province: 'Louisiana', url: 'https://www.bossiercity.org/AgendaCenter/City-Council-7' },
  { name: 'Hamilton', province: 'Ohio', url: 'https://www.hamilton-oh.gov/agendas-minutes' },
  { name: 'Taylor', province: 'Michigan', url: 'https://www.cityoftaylor.com/AgendaCenter/City-Council-2' },
  { name: 'Lakewood', province: 'Washington', url: 'https://cityoflakewood.us/city-council/city-council-agendas/' },
  { name: 'Greenwood', province: 'Indiana', url: 'https://www.greenwood.in.gov/boards/' }, // Already in 701-750
  { name: 'Bellevue', province: 'Nebraska', url: 'https://meeting.sparqdata.com/public/Organization/Bellevue' },
  { name: 'Montebello', province: 'California', url: 'https://www.montebelloca.gov/departments/administration/city_clerks_office/agendas__minutes__and_videos' }, // Already in 501-600
  { name: 'Moore', province: 'Oklahoma', url: 'https://www.cityofmoore.com/government/archives-public-meetings' },
  { name: 'Council Bluffs', province: 'Iowa', url: 'https://www.councilbluffs-ia.gov/2142/Agendas-Minutes' }, // Already in 601-700
  { name: 'Rowlett', province: 'Texas', url: 'https://www.rowletttx.gov/474/Agendas-and-Minutes' },
  { name: 'Pico Rivera', province: 'California', url: 'https://www.pico-rivera.org/depts/admin/clerk/am/default.asp' },
  { name: 'Port Orange', province: 'Florida', url: 'https://www.port-orange.org/agendacenter' }, // Dearborn Heights already in batch
  { name: 'Encinitas', province: 'California', url: 'https://www.encinitasca.gov/government/agendas-webcasts' },
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
