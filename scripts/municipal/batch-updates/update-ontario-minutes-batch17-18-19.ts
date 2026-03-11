#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 17
  {name: "Burk's Falls, Village of", url: "https://www.burksfalls.net/townhall/council/agenda-minutes"},
  {name: "Limerick, Township of", url: "https://limerick.ca/businesses-government/council/minutes/"},
  {name: "Machin, Township of", url: "https://visitmachin.com/p/council-meetings"},
  {name: "Matachewan, Township of", url: "https://www.matachewan.com/"},
  {name: "Mattawan, Municipality of", url: "https://mattawan.ca/"},
  {name: "Mattice-Val Côté, Township of", url: "https://www.matticevalcote.ca/en/conseil-municipal"},
  {name: "McDougall, Township of", url: "https://www.mcdougall.ca/p/agendas-minutes"},
  {name: "Middlesex, County of", url: "https://www.middlesex.ca/government/agendas-minutes"},
  {name: "Minden Hills, Township of", url: "https://mindenhills.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Mississippi Mills, Municipality of", url: "https://www.mississippimills.ca/en/municipal-hall/archive-of-agendas-and-minutes.aspx"},
  {name: "Mono, Town of", url: "https://townofmono.com/government/council-committee-meetings-agendas"},
  {name: "Montague, Township of", url: "https://www.montaguetownship.ca/"},
  {name: "Moonbeam, Township of", url: "https://moonbeam.civicweb.net/Portal/Welcome.aspx"},
  {name: "Moosonee, Town of", url: "https://www.moosonee.ca/meeting-agendas/"},
  {name: "Morley, Township of", url: "https://townshipofmorley.ca/council-minutes/"},
  {name: "Morris-Turnberry, Municipality of", url: "https://morristurnberry.ca/government/agendas-minutes"},
  {name: "Mulmur, Township of", url: "https://mulmur.ca/town-hall/agendas-minutes/council-meeting-agendas-packages-minutes"},
  {name: "Muskoka Lakes, Township of", url: "https://www.muskokalakes.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Muskoka, District Municipality of", url: "https://www.muskoka.on.ca/en/council/agendas-minutes-and-webcasts.aspx"},
  {name: "Nairn and Hyman, Township of", url: "https://nairncentre.ca/our-government/council-minutes/"},

  // Batch 18
  {name: "Neebing, Municipality of", url: "https://www.neebing.org/en/your-local-government/speaking-at-a-council-meeting.aspx"},
  {name: "New Tecumseth, Town of", url: "https://www.newtecumseth.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Newbury, Village of", url: "https://www.newbury.ca"},
  {name: "Niagara-on-the-Lake, Town of", url: "https://www.notl.com/council-government/meetings-agendas-minutes"},
  {name: "Niagara, Regional Municipality of", url: "https://www.niagararegion.ca/government/council/agendas-minutes/default.aspx"},
  {name: "Nipigon, Township of", url: "https://www.nipigon.net"},
  {name: "Nipissing, Township of", url: "https://nipissingtownship.com/council-meeting-dates-agendas-minutes/"},
  {name: "Norfolk County", url: "https://www.norfolkcounty.ca/government/agendas-minutes/"},
  {name: "North Algona Wilberforce, Township of", url: "http://nalgonawil.com/council-2/"},
  {name: "North Dumfries, Township of", url: "https://www.northdumfries.ca/en/township-services/council-and-committee-calendar.aspx"},
  {name: "North Dundas, Township of", url: "https://www.northdundas.com/eScribe"},
  {name: "North Frontenac, Township of", url: "https://www.northfrontenac.com/en/township-services/agendas-and-minutes.aspx"},
  {name: "North Glengarry, Township of", url: "https://www.northglengarry.ca/government/council-meeting-information/"},
  {name: "North Grenville, Municipality of", url: "https://www.northgrenville.ca/council-government/council/meetings-agendas-and-minutes"},
  {name: "North Huron, Township of", url: "https://www.northhuron.ca/en/municipal-government/agendas-minutes.aspx"},
  {name: "North Kawartha, Township of", url: "https://www.northkawartha.ca/your-local-government/council-meeting-information/agendas-and-minutes/"},
  {name: "North Middlesex, Municipality of", url: "https://www.northmiddlesex.on.ca/services/council-meetings"},
  {name: "North Perth, Municipality of", url: "https://www.northperth.ca/en/municipal-services/agendas-and-minutes.aspx"},
  {name: "North Stormont, Township of", url: "https://northstormont.civicweb.net/portal/"},
  {name: "Northeastern Manitoulin and The Islands, Town of", url: "https://www.townofnemi.on.ca/p/meeting-minutes-agendas"},

  // Batch 19
  {name: "Northern Bruce Peninsula, Municipality of", url: "https://www.northbrucepeninsula.ca/government/council-committees/"},
  {name: "Northumberland, County of", url: "https://pub-northumberland.escribemeetings.com/meetingscalendarview.aspx?FillWidth=1&wmode=transparent&Expanded=Regular+Council+Meeting"},
  {name: "Norwich, Township of", url: "https://www.norwich.ca/en/our-township/agendas-and-minutes.aspx"},
  {name: "O'Connor, Township of", url: "https://www.oconnortownship.ca/municipal-office/council/"},
  {name: "Oil Springs, Village of", url: "https://oilsprings.diligent.community/Portal/Welcome.aspx"},
  {name: "Oliver Paipoonge, Municipality of", url: "https://oliverpaipoonge.ca/municipal-office/bylaws-agendas-minutes"},
  {name: "Opasatika, Township of", url: "https://www.opasatika.net/en/conseil-municipal"},
  {name: "Otonabee-South Monaghan, Township of", url: "https://otonabeesouthmonaghan.civicweb.net/portal/"},
  {name: "Oxford, County of", url: "https://pub-oxfordcounty.escribemeetings.com/"},
  {name: "Papineau-Cameron, Township of", url: "https://papineaucameron.ca/2024-minutes/"},
  {name: "Peel, Regional Municipality of", url: "https://peelregion.ca/about/peel-region-council/agendas-minutes-reports-videos"},
  {name: "Pelee, Township of", url: "https://www.pelee.org/municipality/council/meetings/"},
  {name: "Perry, Township of", url: "https://townshipofperry.ca/agendas-minutes/"},
  {name: "Perth East, Township of", url: "https://calendar.pertheast.ca/council"},
  {name: "Perth South, Township of", url: "https://calendar.perthsouth.ca/council"},
  {name: "Perth, County of", url: "https://perthcounty.civicweb.net/portal/"},
  {name: "Peterborough, County of", url: "https://www.ptbocounty.ca/en/governing/county-council-meeting-calendars.aspx"},
  {name: "Pickle Lake, Township of", url: "https://picklelake.ca/municipal-office/"},
  {name: "Plummer Additional, Township of", url: "https://plummertownship.ca/meeting-minutes-meeting-agendas/"},
  {name: "Plympton-Wyoming, Town of", url: "https://www.plympton-wyoming.com/en/municipal-office/agendas-and-minutes.aspx"}
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
