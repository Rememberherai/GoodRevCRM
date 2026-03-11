#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 14
  {name: "Athens, Township of", url: "https://athenstownship.ca/"},
  {name: "Atikokan, Town of", url: "https://atikokan.ca/"},
  {name: "Brockville, City of", url: "https://brockville.civicweb.net/Portal/MeetingSchedule.aspx"},
  {name: "Bruce Mines, Town of", url: "https://brucemines.ca/"},
  {name: "Burk's Falls, Village of", url: "https://www.burksfalls.net/townhall/council/agenda-minutes"},
  {name: "Casey, Township of", url: "https://casey.ca/"},
  {name: "Chamberlain, Township of", url: "https://www.chamberlaintownship.com/"},
  {name: "Chapple, Township of", url: "https://chapple.civicweb.net/Portal/"},
  {name: "Charlton and Dack, Municipality of", url: "http://www.charltonanddack.com/council/"},
  {name: "Clarence-Rockland, City of", url: "https://www.clarence-rockland.com/en/hotel-de-ville/meetings-and-minutes.aspx"},
  {name: "Dorion, Township of", url: "https://doriontownship.ca/township/council/agendas-minutes"},
  {name: "Durham, Regional Municipality of", url: "https://www.durham.ca/en/regional-government/agendas-and-minutes.aspx"},
  {name: "Dutton/Dunwich, Municipality of", url: "https://www.duttondunwich.on.ca/en/municipal-services/council-and-committee-calendar.aspx"},
  {name: "Ear Falls, Township of", url: "https://ear-falls.com/residents/council-agendas-and-minutes/"},
  {name: "East Ferris, Township of", url: "https://eastferris.ca/en/your-government/meetings-agendas"},
  {name: "Elgin, County of", url: "https://www.elgincounty.ca/your-government/council-committees-of-council-minutes-agendas/"},
  {name: "Emo, Township of", url: "https://emo.ca/agendas-minutes/"},
  {name: "Enniskillen, Township of", url: "https://www.enniskillen.ca/minutes-agendas/"},
  {name: "Essex, County of", url: "https://www.countyofessex.ca/county-government/county-council/agendas-and-minutes/"},
  {name: "Evanturel, Township of", url: "https://evanturel.com/"},

  // Batch 15
  {name: "Fauquier-Strickland, Township of", url: "https://fauquierstrickland.civicweb.net/Portal/Subscribe.aspx"},
  {name: "Front of Yonge, Township of", url: "https://mallorytown.ca/town-hall/council-committees-boards/"},
  {name: "Gillies, Township of", url: "https://www.gilliestownship.com/en/our-government/agendas-and-minutes.aspx"},
  {name: "Goderich, Town of", url: "https://www.goderich.ca/en/town-hall-and-services/agendas-and-minutes.aspx"},
  {name: "Gordon/Barrie Island, Municipality of", url: "https://www.gordonbarrieisland.ca/"},
  {name: "Haldimand County", url: "https://www.haldimandcounty.ca/government-administration/council/council-meetings/"},
  {name: "Halton Hills, Town of", url: "https://pub-haltonhills.escribemeetings.com/"},
  {name: "Halton, Regional Municipality of", url: "https://www.halton.ca/the-region/regional-council-and-committees/council-committee-documents-(agendas,-minutes-and"},
  {name: "Harley, Township of", url: "https://211north.ca/record/65313714/"},
  {name: "Harris, Township of", url: "https://harristownship.weebly.com/"},
  {name: "Hastings, County of", url: "https://hastingscounty.com/government/warden-council/meetings-agendas-minutes-bylaws/"},
  {name: "Havelock-Belmont-Methuen, Township of", url: "https://www.hbmtwp.ca/township-services/mayor-and-council/agendas-and-minutes/"},
  {name: "Hawkesbury, Town of", url: "https://hawkesbury.ca/en/my-town/democratic-life/council-meetings"},
  {name: "Hilliard, Township of", url: "https://townshipofhilliard.ca/municipal-government/agendas-and-minutes/"},
  {name: "Hilton Beach, Village of", url: "https://hiltonbeach.com/government/council-minutes/"},
  {name: "Hornepayne, Township of", url: "https://www.townshipofhornepayne.ca/our-government/council/council-meetings/"},
  {name: "Horton, Township of", url: "https://www.hortontownship.ca/council/council-meeting-packages/"},
  {name: "Hudson, Township of", url: "https://hudson.ca/council-minutes/"},
  {name: "Huron, County of", url: "https://www.huroncounty.ca/minutes-and-agendas/"},
  {name: "Innisfil, Town of", url: "https://innisfil.ca/en/my-government/agendas-and-minutes.aspx"},

  // Batch 16
  {name: "Iroquois Falls, Town of", url: "https://www.iroquoisfalls.com/council-administration/council/council-videos-agendas-and-minutes/"},
  {name: "James, Township of", url: "https://elklake.ca/agendasminutes"},
  {name: "Jocelyn, Township of", url: "https://jocelyn.ca/agendas/"},
  {name: "Joly, Township of", url: "https://townshipofjoly.com/en/minutes/meeting-agendas-minutes"},
  {name: "Kearney, Town of", url: "https://townofkearney.ca/your-government/council/agendas-minutes/"},
  {name: "Kerns, Township of", url: "https://kerns.ca/agendas/"},
  {name: "Killaloe, Hagarty and Richards, Township of", url: "https://www.killaloe-hagarty-richards.ca/township-council/meeting-minutes"},
  {name: "Kirkland Lake, Town of", url: "http://kirklandlake.ca/index.php?id=13"},
  {name: "La Vallee, Township of", url: "https://lavallee.ca/council-and-staff/"},
  {name: "Laird, Township of", url: "https://lairdtownship.ca/"},
  {name: "Lake of Bays, Township of", url: "https://calendar.lakeofbays.on.ca/council"},
  {name: "Lake of the Woods, Township of", url: "https://www.lakeofthewoods.ca/administration/minutes/"},
  {name: "Lakeshore, Municipality of", url: "https://www.lakeshore.ca/en/municipal-services/agendas-and-minutes.aspx"},
  {name: "Lambton Shores, Municipality of", url: "https://www.lambtonshores.ca/en/our-government/council-meetings.aspx"},
  {name: "Lanark, County of", url: "https://lanarkcounty.civicweb.net/portal/"},
  {name: "LaSalle, Town of", url: "https://www.lasalle.ca/town-hall/mayor-and-council/agendas-meetings-and-minutes/"},
  {name: "Laurentian Hills, Town of", url: "https://www.laurentianhills.ca/council/minutes-agendas/"},
  {name: "Laurentian Valley, Township of", url: "https://www.lvtownship.ca/en/lv-government-services/agendas-and-minutes.aspx"},
  {name: "Leeds and the Thousand Islands, Township of", url: "https://www.leeds1000islands.ca/en/governing/Agendas-and-Minutes.aspx"},
  {name: "Lennox and Addington, County of", url: "https://lennoxandaddington.civicweb.net/Portal/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Ontario municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Ontario');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
}
main().catch(console.error);
