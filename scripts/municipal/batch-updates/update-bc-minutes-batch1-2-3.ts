#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 1
  {name: "100 Mile House", url: "http://www.100milehouse.com/agendas-and-minutes/"},
  {name: "Alert Bay", url: "http://www.alertbay.ca/documents/"},
  {name: "Anmore", url: "https://anmore.com/village-hall/council-meetings/council-meeting-agendas/"},
  {name: "Armstrong", url: "https://cityofarmstrong.bc.ca/mayor-and-council/agendas-and-meetings/"},
  {name: "Ashcroft", url: "https://ashcroftbc.ca/"},
  {name: "Barriere", url: "https://barriere.ca/p/agendas-and-minutes"},
  {name: "Belcarra", url: "https://belcarra.ca/municipal-hall/council-meetings/"},
  {name: "Bowen Island", url: "https://www.bowenislandmunicipality.ca/our-government/council/council-meetings/"},
  {name: "Burns Lake", url: "https://www.burnslake.ca/local-government/mayor-council/agendas-minutes"},
  {name: "Cache Creek", url: "https://cachecreek.ca/agendas"},
  {name: "Canal Flats", url: "https://canalflats.civicweb.net/filepro/documents/82/"},
  {name: "Castlegar", url: "https://castlegar.ca/government/city-council/city-council-meetings-minutes-videos/"},
  {name: "Central Saanich", url: "https://www.centralsaanich.ca/municipal-hall/council-meetings"},
  {name: "Chase", url: "https://chasebc.ca/council-meetings"},
  {name: "Chetwynd", url: "https://www.gochetwynd.com/municipal-office/mayor-and-council/agendas-and-minutes/"},
  {name: "Clearwater", url: "https://districtofclearwater.civicweb.net/portal/"},
  {name: "Clinton", url: "https://village.clinton.bc.ca/local-government/your-council/minutes-agendas/"},
  {name: "Coldstream", url: "https://coldstream.civicweb.net/portal/"},
  {name: "Colwood", url: "https://colwood.civicweb.net/portal/"},
  {name: "Comox", url: "https://www.comox.ca/councilmeetings"},

  // Batch 2
  {name: "Courtenay", url: "https://www.courtenay.ca/EN/main/city-hall/mayor-council/council-meetings.html"},
  {name: "Cranbrook", url: "https://cranbrook.civicweb.net/Portal/MeetingInformation.aspx"},
  {name: "Creston", url: "https://www.creston.ca/meetings-agenda-and-minutes"},
  {name: "Cumberland", url: "https://cumberland.ca/meetings/"},
  {name: "Daajing Giids", url: "https://daajinggiids.civicweb.net/Portal/Default.aspx"},
  {name: "Dawson Creek", url: "https://dawsoncreek.civicweb.net/Portal/MeetingSchedule.aspx"},
  {name: "Duncan", url: "https://duncan.ca/"},
  {name: "Elkford", url: "https://www.elkford.ca/town-hall/district-council/meetings-agendas-minutes"},
  {name: "Enderby", url: "https://www.cityofenderby.com/mayor-council/agendas/"},
  {name: "Esquimalt", url: "https://www.esquimalt.ca/government-bylaws/council-meetings/agendas-minutes-reports"},
  {name: "Fernie", url: "https://www.fernie.ca/EN/main/city/meeting-agendas-minutes.html"},
  {name: "Fort St. James", url: "https://fortstjames.civicweb.net/filepro/documents/"},
  {name: "Fort St. John", url: "https://www.fortstjohn.ca/EN/main/local-gov/mayor-council/agendas-minutes.html"},
  {name: "Fraser Lake", url: "https://www.fraserlake.ca/municipal-hall/council-meetings-0"},
  {name: "Fruitvale", url: "https://fruitvale.ca/council/council-information/"},
  {name: "Gibsons", url: "https://gibsons.civicweb.net/Portal/"},
  {name: "Gold River", url: "https://goldriver.ca/municipal-services/council-agendas-and-minutes/"},
  {name: "Golden", url: "https://golden.civicweb.net/portal/"},
  {name: "Grand Forks", url: "https://www.grandforks.ca/council-agendas-and-minutes/"},
  {name: "Granisle", url: "https://granisle.civicweb.net/"},

  // Batch 3
  {name: "Greenwood", url: "https://www.greenwoodcity.com/city-info/agenda/"},
  {name: "Harrison Hot Springs", url: "https://www.harrisonhotsprings.ca/village-office/agendas-minutes-videos"},
  {name: "Hazelton", url: "https://hazelton.ca/council-meetings/"},
  {name: "Highlands", url: "https://www.highlands.ca/127/Council"},
  {name: "Hope", url: "https://www.hope.ca/p/minutes-agendas"},
  {name: "Houston", url: "https://www.houston.ca/council_meetings"},
  {name: "Hudson's Hope", url: "https://hudsonshope.ca/district-office/council-minutes/"},
  {name: "Invermere", url: "https://invermere.civicweb.net/Portal/MeetingSchedule.aspx"},
  {name: "Kaslo", url: "https://kaslo.ca/p/council-meetings"},
  {name: "Kent", url: "https://calendar.kentbc.ca/meetings"},
  {name: "Keremeos", url: "https://www.keremeos.ca/meeting-agendas-minutes-and-highlights"},
  {name: "Kimberley", url: "https://www.kimberley.ca/city-hall/city-council/council-meetings-agendas-minutes"},
  {name: "Kitimat", url: "https://www.kitimat.ca/en/municipal-hall/agendas-and-minutes.aspx"},
  {name: "Ladysmith", url: "https://www.ladysmith.ca/city-hall/mayor-council/council-minutes-and-agendas"},
  {name: "Lake Country", url: "https://www.lakecountry.bc.ca/council-meeting-calendar"},
  {name: "Lake Cowichan", url: "https://www.town.lakecowichan.bc.ca/minutes.php"},
  {name: "Langley City", url: "https://www.langleycity.ca/city-hall/city-council/council-meetings-public-hearings"},
  {name: "Langley District", url: "https://www.tol.ca/en/the-township/council-agendas-and-minutes.aspx"},
  {name: "Lantzville", url: "https://www.lantzville.ca/cms.asp?wpID=449"},
  {name: "Lillooet", url: "https://www.lillooet.ca/council-meetings"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} BC municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'British Columbia');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
}
main().catch(console.error);
