#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 461-470
  { name: 'St. Cloud', province: 'Minnesota', url: 'https://www.ci.stcloud.mn.us/AgendaCenter' },
  { name: 'Barnstable', province: 'Massachusetts', url: 'https://town.barnstable.ma.us/boardscommittees/TownCouncil/' },
  { name: 'Altamonte Springs', province: 'Florida', url: 'https://www.altamonte.org/AgendaCenter' },
  { name: 'Fitchburg', province: 'Massachusetts', url: 'https://www.fitchburgma.gov/agendacenter/CITY-COUNCIL-15' },
  { name: 'West Allis', province: 'Wisconsin', url: 'https://westalliswi.legistar.com/' },
  { name: 'La Mesa', province: 'California', url: 'https://www.cityoflamesa.gov/1683/City-Council-Board-and-Commission-Meetin' },
  { name: 'Lenexa', province: 'Kansas', url: 'https://www.lenexa.com/Government/Agendas-Minutes' },
  { name: 'Sanford', province: 'Florida', url: 'https://sanfordfl.gov/government/city-clerk/city-commission-meetings/' },
  { name: 'Jefferson City', province: 'Missouri', url: 'https://www.jeffersoncitymo.gov/meetings_and_agendas/council_agendas_and_minutes.php' },
  { name: 'Altoona', province: 'Pennsylvania', url: 'https://www.altoonapa.gov/government/city-council/meeting-minutes' },

  // Cities 471-480
  { name: 'Florence', province: 'Alabama', url: 'https://florenceal.org/city_council_agenda-2/' },
  { name: 'Bryan', province: 'Texas', url: 'https://go.boarddocs.com/tx/cobtx/Board.nsf/Public' },
  { name: 'Methuen', province: 'Massachusetts', url: 'https://www.methuen.gov/AgendaCenter/City-Council-26/' },
  { name: 'Roswell', province: 'Georgia', url: 'https://www.roswellgov.com/government/city-meetings-calendar/' },
  { name: 'Attleboro', province: 'Massachusetts', url: 'https://www.cityofattleboro.us/AgendaCenter/Attleboro-Municipal-Council-5/' },
  { name: 'Shawnee', province: 'Kansas', url: 'https://cityofshawnee.civicweb.net/Portal/' },
  { name: 'Casper', province: 'Wyoming', url: 'https://cityofcasper.hosted.civiclive.com/government/city_meetings_and_agendas' },
  { name: 'Schenectady', province: 'New York', url: 'https://www.cityofschenectady.gov/AgendaCenter/City-Council-5' },
  { name: 'Fountain Valley', province: 'California', url: 'https://www.fountainvalley.gov/AgendaCenter/City-Council-2' },
  { name: 'Brookhaven', province: 'New York', url: 'https://brookhavenny.portal.civicclerk.com/' },

  // Cities 481-490
  { name: 'Pensacola', province: 'Florida', url: 'https://pensacolafl.portal.civicclerk.com/' },
  { name: 'Bismarck', province: 'North Dakota', url: 'https://bismarcknd.portal.civicclerk.com/' },
  { name: 'Carmel', province: 'Indiana', url: 'https://www.carmel.in.gov/government/city-council/2025-agendas-and-minutes' },
  { name: 'Meridian', province: 'Idaho', url: 'https://apps.meridiancity.org/CLERKSCONTENT/meridian_agenda_minutes.aspx' },
  { name: 'National City', province: 'California', url: 'https://www.nationalcityca.gov/government/mayor-and-council/city-council-calendar' },
  { name: 'Loveland', province: 'Colorado', url: 'https://cilovelandco.civicweb.net/Portal/' },
  { name: 'Gary', province: 'Indiana', url: 'https://garycommoncouncil.gov/' },
  { name: 'Redmond', province: 'Washington', url: 'https://redmond.legistar.com/' },
  { name: 'Bend', province: 'Oregon', url: 'https://www.bendoregon.gov/government/city-council/city-council-meeting-agendas-video' },
  { name: 'Chicopee', province: 'Massachusetts', url: 'https://www.chicopeema.gov/AgendaCenter/City-Council-6' },

  // Cities 491-500
  { name: 'Caldwell', province: 'Idaho', url: 'https://www.cityofcaldwell.org/Government/City-Council/Council-Meetings' },
  { name: 'Pinellas Park', province: 'Florida', url: 'https://www.pinellas-park.com/AgendaCenter' },
  { name: 'Eastvale', province: 'California', url: 'https://www.eastvaleca.gov/' },
  { name: 'Twin Falls', province: 'Idaho', url: 'https://twinfallsid.portal.civicclerk.com/' },
  { name: 'Peoria', province: 'Arizona', url: 'https://www.peoriaaz.gov/government/departments/city-clerk-office/public-meetings' },
  { name: 'Tamarac', province: 'Florida', url: 'https://www.tamarac.gov/385/Meeting-Agendas' },
  { name: 'White Plains', province: 'New York', url: 'https://www.cityofwhiteplains.com/AgendaCenter' },
  { name: 'Niagara Falls', province: 'New York', url: 'https://www.niagarafallsny.gov/government/city_council.php' },
  { name: 'Poway', province: 'California', url: 'https://poway.org/AgendaCenter' },
  { name: 'North Lauderdale', province: 'Florida', url: 'https://www.nlauderdale.org/quick_links/meetings_and_minutes/index.php' },
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
