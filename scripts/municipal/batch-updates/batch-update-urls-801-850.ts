#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 849-870
  { name: 'St. Clair Shores', province: 'Michigan', url: 'https://www.scsmi.net/agendacenter' },
  { name: 'Caldwell', province: 'Idaho', url: 'https://www.cityofcaldwell.org/Government/City-Council/Council-Meetings' }, // Already in 461-500 and 601-700
  { name: 'Orland Park', province: 'Illinois', url: 'https://www.orlandpark.org/government/meeting-notices' },
  { name: 'Stonecrest', province: 'Georgia', url: 'https://stonecrest-ga.municodemeetings.com/' },
  { name: 'Palm Beach Gardens', province: 'Florida', url: 'https://www.pbgfl.gov/482/Agendas' }, // Already in 501-600 and 701-750
  { name: 'Royal Oak', province: 'Michigan', url: 'https://www.romi.gov/AgendaCenter' }, // Already in 401-430
  { name: 'Margate', province: 'Florida', url: 'https://www.margatefl.com/AgendaCenter' }, // Already in 701-750
  { name: 'Blue Springs', province: 'Missouri', url: 'https://www.bluespringsgov.com/AgendaCenter' }, // Already in 501-600
  { name: 'Shoreline', province: 'Washington', url: 'https://www.shorelinewa.gov/government/council-meetings/' },
  { name: 'Midwest City', province: 'Oklahoma', url: 'https://www.midwestcityok.org/AgendaCenter' }, // Already in 501-600
  { name: 'Bowie', province: 'Maryland', url: 'https://bowiemd.portal.civicclerk.com/' }, // Already in 431-460
  { name: 'Apex', province: 'North Carolina', url: 'https://apex-nc.municodemeetings.com/' },
  { name: 'Oak Lawn', province: 'Illinois', url: 'https://www.oaklawn-il.gov/government/' },
  { name: 'Carson City', province: 'Nevada', url: 'https://www.carson.org/government/city-meetings' },
  { name: 'Queen Creek', province: 'Arizona', url: 'https://www.queencreekaz.gov/government/agendas-minutes' },
  { name: 'Leander', province: 'Texas', url: 'https://www.leandertx.gov/agendas' },
  { name: 'Bartlett', province: 'Tennessee', url: 'https://www.cityofbartlett.org/government/boards-commissions/city-board' }, // Already in 431-460 and 701-750
  { name: 'St. Cloud', province: 'Florida', url: 'https://www.stcloudfl.gov/202/Meeting-Agendas-Minutes-and-Packets' }, // Already in 351-380 and 501-600
  { name: 'Coconut Creek', province: 'Florida', url: 'https://www.coconutcreek.net/city-clerk/agendas-minutes' }, // Already in 351-380 and 701-750

  // Cities 871-890
  { name: 'Kettering', province: 'Ohio', url: 'https://www.ketteringoh.org/government/city-council/agendas-and-minutes/' },
  { name: 'Parker', province: 'Colorado', url: 'https://www.parkerco.gov/133/Agendas---Public-Meetings' }, // Already in 501-600
  { name: 'St. Peters', province: 'Missouri', url: 'https://www.stpetersmo.net/AgendaCenter' }, // Already in many batches
  { name: 'Fountain Valley', province: 'California', url: 'https://www.fountainvalley.org/government/city-council/agendas-minutes' },
  { name: 'Maricopa', province: 'Arizona', url: 'https://maricopa.legistar.com/' }, // Already in 321-350 and 501-600
  { name: 'Berwyn', province: 'Illinois', url: 'https://www.berwyn-il.gov/government/city-council/agendas-minutes/' }, // Already in 321-350 and 401-430
  { name: 'National City', province: 'California', url: 'https://www.nationalcityca.gov/government/agendas-minutes' },
  { name: 'Lenexa', province: 'Kansas', url: 'https://www.lenexa.com/government/city-council/agendas-minutes' },
  { name: 'Highland', province: 'California', url: 'https://www.cityofhighland.org/government/city-council/agendas-minutes' },
  { name: 'Arcadia', province: 'California', url: 'https://www.arcadiaca.gov/discover/city_council/city_council_meetings___agendas.php' }, // Already in 251-280 and 601-700
  { name: 'Mount Prospect', province: 'Illinois', url: 'https://www.mountprospect.org/government/agendas-minutes/' },
  { name: 'Lake Havasu City', province: 'Arizona', url: 'https://www.lhcaz.gov/government/city-council/agendas-minutes' }, // Already in 401-430
  { name: 'Tinley Park', province: 'Illinois', url: 'https://tinleypark.org/government/agendas-minutes/' },
  { name: 'DeSoto', province: 'Texas', url: 'https://www.ci.desoto.tx.us/government/public_meeting_agendas___minutes/city_council.php' }, // Already in 351-380 and 501-600
  { name: 'New Brunswick', province: 'New Jersey', url: 'https://www.cityofnewbrunswick.org/government/city-council/agendas-minutes' },
  { name: 'Chicopee', province: 'Massachusetts', url: 'https://www.chicopeema.gov/AgendaCenter/City-Council-6' }, // Already in 461-500 and 701-750
  { name: 'Madison', province: 'Alabama', url: 'https://www.madisonal.gov/city-council/agendas-minutes' },
  { name: 'West Haven', province: 'Connecticut', url: 'https://www.cityofwesthaven.com/government/city-council/agendas-minutes' }, // Already in 431-460
  { name: 'Smyrna', province: 'Georgia', url: 'https://www.smyrnaga.gov/departments/office-of-the-city-clerk/public-meetings-calendar' }, // Already in 351-380 and 701-750
  { name: 'Huntington Park', province: 'California', url: 'https://www.hpca.gov/departments/city-clerk/agendas-minutes' }, // Already in 401-430

  // Cities 891-910
  { name: 'Wylie', province: 'Texas', url: 'https://wylie-tx.municodemeetings.com/' }, // Already in 501-600
  { name: 'Diamond Bar', province: 'California', url: 'https://www.diamondbarca.gov/AgendaCenter' }, // Already in many batches
  { name: 'Apple Valley', province: 'Minnesota', url: 'https://applevalleymn.portal.civicclerk.com/' }, // Already in many batches
  { name: 'Perth Amboy', province: 'New Jersey', url: 'https://www.perthamboynj.org/government/city-council/agendas-minutes' }, // Already in 431-460
  { name: 'Bradenton', province: 'Florida', url: 'https://www.bradentonfl.gov/government/city-clerk/city-council-agendas-minutes' },
  { name: 'Brookhaven', province: 'Georgia', url: 'https://www.brookhavenga.gov/government/agendas-minutes' },
  { name: 'Manhattan', province: 'Kansas', url: 'https://www.manhattanks.gov/AgendaCenter/City-Commission-20/' }, // Already in 501-600 and 701-750
  { name: 'Tigard', province: 'Oregon', url: 'https://www.tigard-or.gov/your-government/council-agendas' }, // Already in 401-430 and 601-700
  { name: 'Yucaipa', province: 'California', url: 'https://www.yucaipa.org/government/city-council/agendas-minutes' },
  { name: 'Peabody', province: 'Massachusetts', url: 'https://www.peabody-ma.gov/meeting%20minutes.html' }, // Already in 501-600
  { name: 'Plainfield', province: 'New Jersey', url: 'https://www.plainfieldnj.gov/government/city-council/agendas-minutes' },
  { name: 'Southaven', province: 'Mississippi', url: 'https://www.southaven.org/government/city-board/agendas-minutes' },
  { name: 'Apopka', province: 'Florida', url: 'https://www.apopka.net/government/city-council/agendas-minutes' }, // Already in 431-460
  { name: 'Oak Park', province: 'Illinois', url: 'https://www.oak-park.us/government/board-trustees/agendas-minutes' },
  { name: 'Paramount', province: 'California', url: 'https://www.paramountcity.com/government/city-council/agendas-minutes' }, // Already in 401-430
  { name: 'Colton', province: 'California', url: 'https://www.ci.colton.ca.us/government/city-council/agendas-minutes' }, // Already in 381-410 and 501-600
  { name: 'Kentwood', province: 'Michigan', url: 'https://www.kentwood.us/city_services/committees_and_boards/agendas_and_minutes/index.php' }, // Already in 351-380 and 601-700
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
