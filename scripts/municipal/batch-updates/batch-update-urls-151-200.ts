#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 151-165
  { name: 'New Bedford', province: 'Massachusetts', url: 'https://www.newbedford-ma.gov/city-council/meetings-agendas/' },
  { name: 'Alexandria', province: 'Virginia', url: 'https://alexandria.legistar.com/' },
  { name: 'Paterson', province: 'New Jersey', url: 'https://www.patersonnj.gov/meetings/' },
  { name: 'Lakewood', province: 'Colorado', url: 'https://lakewoodspeaks.org/' },
  { name: 'Cary', province: 'North Carolina', url: 'https://www.carync.gov/mayor-council/meeting-calendar' },
  { name: 'Columbia', province: 'South Carolina', url: 'https://columbiacitysc.iqm2.com/Citizens/calendar.aspx' },
  { name: 'Bellevue', province: 'Washington', url: 'https://bellevue.legistar.com/' },
  { name: 'Independence', province: 'Missouri', url: 'https://independencemo.portal.civicclerk.com/' },
  { name: 'Charleston', province: 'South Carolina', url: 'https://www.charleston-sc.gov/AgendaCenter/City-Council-7' },
  { name: 'Sunnyvale', province: 'California', url: 'https://sunnyvaleca.legistar.com/' },
  { name: 'Pasadena', province: 'Texas', url: 'https://www.pasadenatx.gov/AgendaCenter' },
  { name: 'Davenport', province: 'Iowa', url: 'https://davenportia.portal.civicclerk.com/' },
  { name: 'Kent', province: 'Washington', url: 'http://kentwa.iqm2.com/citizens/default.aspx' },
  { name: 'Visalia', province: 'California', url: 'https://visalia.legistar.com/' },
  { name: 'Simi Valley', province: 'California', url: 'https://www.simivalley.org/government/city-council/city-council-meetings' },

  // Cities 166-180
  { name: 'Thornton', province: 'Colorado', url: 'https://www.thorntonco.gov/government/mayor-council/council-meeting-information' },
  { name: 'Abilene', province: 'Texas', url: 'https://abilenetx.portal.civicclerk.com' },
  { name: 'Miramar', province: 'Florida', url: 'https://miramar.legistar.com/' },
  { name: 'Surprise', province: 'Arizona', url: 'https://surpriseaz.portal.civicclerk.com/' },
  { name: 'Odessa', province: 'Texas', url: 'https://www.odessa-tx.gov/AgendaCenter/City-Council-7/' },
  { name: 'Olathe', province: 'Kansas', url: 'https://olatheks.legistar.com/' },
  { name: 'Norman', province: 'Oklahoma', url: 'https://norman-ok.municodemeetings.com/' },
  { name: 'Rochester', province: 'Minnesota', url: 'https://rochestermn.granicus.com/ViewPublisher.php?view_id=1' },
  { name: 'Carrollton', province: 'Texas', url: 'https://carrolltontx.legistar.com/' },
  { name: 'Provo', province: 'Utah', url: 'https://www.provo.gov/AgendaCenter/City-Council-Meetings-8/' },
  { name: 'Downey', province: 'California', url: 'https://www.downeyca.org/our-city/departments/city-clerk/agendas-city-documents' },
  { name: 'West Jordan', province: 'Utah', url: 'https://westjordan.primegov.com/public/portal' },
  { name: 'Dearborn', province: 'Michigan', url: 'https://dearborn.gov/government/city-council/city-council-meetings' },
  { name: 'Costa Mesa', province: 'California', url: 'https://costamesa.legistar.com/' },
  { name: 'Inglewood', province: 'California', url: 'https://www.cityofinglewood.org/AgendaCenter/City-Council-3' },

  // Cities 181-195
  { name: 'Miami Gardens', province: 'Florida', url: 'https://miamigardens.civicweb.net/Portal/' },
  { name: 'Manchester', province: 'New Hampshire', url: 'https://www.manchesternh.gov/departments/city-clerk/meeting-minutes-and-agendas' },
  { name: 'Elgin', province: 'Illinois', url: 'https://elginil.gov/agendacenter' },
  { name: 'Clearwater', province: 'Florida', url: 'https://clearwater.legistar.com/' },
  { name: 'Carlsbad', province: 'California', url: 'https://www.carlsbadca.gov/city-hall/meetings-agendas' },
  { name: 'Westminster', province: 'Colorado', url: 'https://cityofwestminster.primegov.com/Portal/Meeting?meetingTemplateId=5055' },
  { name: 'Pearland', province: 'Texas', url: 'https://pearlandtx.civicweb.net/Portal/MeetingTypeList.aspx' },
  { name: 'Pompano Beach', province: 'Florida', url: 'https://pompano.legistar.com/' },
  { name: 'West Covina', province: 'California', url: 'https://www.westcovina.org/departments/city-clerk/agendas-and-meetings' },
  { name: 'Warren', province: 'Michigan', url: 'https://www.cityofwarren.org/government/city-council/' },

  // Cities 191-200
  { name: 'Racine', province: 'Wisconsin', url: 'https://cityofracine.legistar.com/' },
  { name: 'Greeley', province: 'Colorado', url: 'https://greeleyco.portal.civicclerk.com/' },
  { name: 'Stamford', province: 'Connecticut', url: 'http://www.boardofreps.org/' },
  { name: 'Bloomington', province: 'Illinois', url: 'https://www.bloomingtonil.gov/government/city-council/meetings-agendas' },
  { name: 'Grand Junction', province: 'Colorado', url: 'https://www.gjcity.org/129/Agendas-Minutes' },
  { name: 'Sterling Heights', province: 'Michigan', url: 'https://www.sterlingheights.gov/AgendaCenter/City-Council-23' },
  { name: 'Coral Springs', province: 'Florida', url: 'https://coralsprings.granicus.com/ViewPublisher.php?view_id=3' },
  { name: 'Johnson City', province: 'Tennessee', url: 'https://johnsoncitytn.civicweb.net/Portal/MeetingSchedule.aspx' },
  { name: 'Midland', province: 'Texas', url: 'https://www.midlandtexas.gov/1231/Meetings-Agendas-and-Minutes' },
  { name: 'Yakima', province: 'Washington', url: 'https://www.yakimawa.gov/council/agendas-and-minutes/' },
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
