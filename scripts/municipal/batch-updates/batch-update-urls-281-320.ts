#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 281-300
  { name: 'Waukegan', province: 'Illinois', url: 'https://www.waukeganil.gov/AgendaCenter' },
  { name: 'Buckeye', province: 'Arizona', url: 'https://www.buckeyeaz.gov/government/city-council/agendas-and-minutes' },
  // Skip Town 'n' Country FL (unincorporated)
  { name: 'Clifton', province: 'New Jersey', url: 'https://www.cliftonnj.org/AgendaCenter/City-Council-2' },
  { name: 'Bloomington', province: 'Minnesota', url: 'https://www.bloomingtonmn.gov/government/city-council/city-council-agendas-minutes' },
  { name: 'Mount Pleasant', province: 'South Carolina', url: 'https://www.tompsc.com/agendacenter' },
  { name: 'Florence', province: 'South Carolina', url: 'https://www.cityofflorencesc.gov/agendas-minutes' },
  { name: 'Newton', province: 'Massachusetts', url: 'https://www.newtonma.gov/how-do-i/view/city-council-dockets' },
  { name: 'State College', province: 'Pennsylvania', url: 'https://www.statecollegepa.us/606/Borough-Council-Agendas-Minutes' },
  { name: 'Livermore', province: 'California', url: 'https://www.livermoreca.gov/departments/city-clerk/city-council-meeting-calendar-agendas' },
  { name: 'Rapid City', province: 'South Dakota', url: 'https://www.rcgov.org/government/city-council/city-council-meetings-and-agendas' },
  { name: 'Decatur', province: 'Illinois', url: 'https://www.decaturil.gov/city-council/agendas-and-minutes/' },
  { name: 'Dalton', province: 'Georgia', url: 'https://www.daltonga.gov/AgendaCenter' },
  { name: 'Conroe', province: 'Texas', url: 'https://www.conroetx.gov/AgendaCenter' },
  { name: 'Hawthorne', province: 'California', url: 'https://hawthorne.legistar.com/' },
  { name: 'Lawrence', province: 'Massachusetts', url: 'https://www.cityoflawrence.com/AgendaCenter' },
  { name: 'New Braunfels', province: 'Texas', url: 'https://www.nbtexas.org/AgendaCenter' },
  { name: 'Citrus Heights', province: 'California', url: 'https://www.citrusheights.net/AgendaCenter' },
  { name: 'Jackson', province: 'Michigan', url: 'https://jacksonmi.portal.civicclerk.com/' },
  { name: 'Whittier', province: 'California', url: 'https://online.cityofwhittier.org/OnBaseAgendaOnline/' },

  // Cities 301-320
  { name: 'Muncie', province: 'Indiana', url: 'https://library.municode.com/in/muncie/munidocs/munidocs' },
  { name: 'Troy', province: 'Michigan', url: 'https://apps.troymi.gov/meetings/currentagenda' },
  // Skip Homosassa Springs FL (unincorporated)
  { name: 'Port Huron', province: 'Michigan', url: 'https://www.porthuron.org/AgendaCenter' },
  { name: 'Napa', province: 'California', url: 'https://napacity.legistar.com/Calendar.aspx' },
  { name: 'Deerfield Beach', province: 'Florida', url: 'https://deerfieldbeachfl.portal.civicclerk.com/' },
  { name: 'Springdale', province: 'Arkansas', url: 'https://www.springdalear.gov/AgendaCenter' },
  { name: 'Newport Beach', province: 'California', url: 'https://www.newportbeachca.gov/government/data-hub/agendas-minutes' },
  { name: 'Anderson', province: 'Indiana', url: 'https://www.cityofanderson.com/AgendaCenter/City-Council-12' },
  { name: 'San Ramon', province: 'California', url: 'https://www.sanramon.ca.gov/government/city-council/agendas-minutes' },
  { name: 'Lake Forest', province: 'California', url: 'https://www.lakeforestca.gov/AgendaCenter' },
  { name: 'Mission', province: 'Texas', url: 'https://mission-tx.municodemeetings.com/' },
  { name: 'Auburn', province: 'Washington', url: 'https://auburnwa.portal.civicclerk.com/' },
  { name: 'Brooklyn Park', province: 'Minnesota', url: 'https://nwsccc-brooklynpark.granicus.com/viewpublisher.php?view_id=5' },
  { name: 'Bryan', province: 'Texas', url: 'https://go.boarddocs.com/tx/cobtx/Board.nsf/Public' },
  { name: 'Springfield', province: 'Ohio', url: 'https://springfieldohio.gov/meetings/' },
  { name: 'Hattiesburg', province: 'Mississippi', url: 'https://hattiesburgms.portal.civicclerk.com/' },
  { name: 'Westland', province: 'Michigan', url: 'https://www.cityofwestland.com/AgendaCenter/City-Council-2/' },
  { name: 'Cicero', province: 'Illinois', url: 'https://meetings.boardbook.org/Public/Organization/1372' },
  { name: 'Albany', province: 'Georgia', url: 'https://www.albanyga.gov/AgendaCenter' },
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
  console.log(`⏭️  Skipped: Town 'n' Country FL, Homosassa Springs FL (unincorporated)`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
