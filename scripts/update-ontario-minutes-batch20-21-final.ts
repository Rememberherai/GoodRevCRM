#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 20
  {name: "Point Edward, Village of", url: "https://www.villageofpointedward.com/municipal-office/council-calendar"},
  {name: "Powassan, Municipality of", url: "https://www.powassan.net/content/municipal-services/minutes-agendas"},
  {name: "Prescott and Russell, United Counties of", url: "https://en.prescott-russell.on.ca/stay/county_council/meeting_agendas_and_minutes"},
  {name: "Prescott, Town of", url: "https://www.prescott.ca/town-hall/agendas-minutes/"},
  {name: "Prince Edward, County of", url: "https://www.thecounty.ca/government/council-committee-meetings/"},
  {name: "Prince, Township of", url: "https://www.princetownship.ca/agendas-and-minutes.html"},
  {name: "Rainy River, Town of", url: "http://www.rainyriver.ca/minutes.html"},
  {name: "Red Rock, Township of", url: "https://www.redrocktownship.com/government/municipal-council/council-meetings-and-minutes/"},
  {name: "Renfrew, County of", url: "https://www.countyofrenfrew.on.ca/en/county-government/agendas-minutes-and-reports.aspx"},
  {name: "Richmond Hill, City of", url: "https://www.richmondhill.ca/en/living-here/Council-Meetings-Agendas-and-Minutes.aspx"},
  {name: "Ryerson, Township of", url: "https://www.ryersontownship.ca/town-hall/council/agendas-minutes"},
  {name: "Sables-Spanish Rivers, Township of", url: "https://www.sables-spanish.ca/council-minutes-agendas/"},
  {name: "Saugeen Shores, Town of", url: "https://www.saugeenshores.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Schreiber, Township of", url: "https://www.schreiber.ca/government/town-council/meeting-agendas/"},
  {name: "Selwyn, Township of", url: "https://events.selwyntownship.ca/meetings"},
  {name: "Shuniah, Municipality of", url: "https://shuniah.civicweb.net/Portal/"},
  {name: "Simcoe, County of", url: "https://simcoe.civicweb.net/Portal/"},
  {name: "Sioux Narrows-Nestor Falls, Township of", url: "https://www.snnf.ca/town-hall/schedule-and-minutes/"},
  {name: "South Algonquin, Township of", url: "https://www.southalgonquin.ca/council/"},
  {name: "South Bruce Peninsula, Town of", url: "https://www.southbrucepeninsula.com/en/town-hall/agendas-and-minutes.aspx"},

  // Batch 21 - Final batch
  {name: "South River, Village of", url: "https://southriver.ca/en/municipal-information/council-minutes-agendas"},
  {name: "South-West Oxford, Township of", url: "https://www.swox.org/township-services/council/agendas-and-minutes"},
  {name: "Southwold, Township of", url: "https://www.southwold.ca/en/municipal-office/agendas-and-minutes.aspx"},
  {name: "Springwater, Township of", url: "https://www.springwater.ca/en/township-hall/agendas-and-minutes.aspx"},
  {name: "Stormont, Dundas and Glengarry, United Counties of", url: "https://pub-sdgcounties.escribemeetings.com"},
  {name: "Sundridge, Village of", url: "https://www.sundridge.ca/agendas-and-minutes"},
  {name: "Tehkummah, Township of", url: "https://tehkummah.ca/council-meeting/"},
  {name: "Temagami, Municipality of", url: "https://pub-temagami.escribemeetings.com"},
  {name: "Thames Centre, Municipality of", url: "https://www.thamescentre.on.ca/council-and-administration/council/council-calendar-agenda-minutes/"},
  {name: "The Blue Mountains, Town of", url: "https://www.thebluemountains.ca/town-hall/council-committees/agendas-minutes-reports"},
  {name: "The Nation Municipality", url: "https://nationmun.ca/en/council-staff/council/agendas-minutes"},
  {name: "The North Shore, Township of", url: "https://townshipofthenorthshore.ca/governing/council-minutes-agendas/"},
  {name: "Val Rita-Harty, Township of", url: "https://valharty.ca/municipality/council/"},
  {name: "Waterloo, Regional Municipality of", url: "https://www.regionofwaterloo.ca/en/regional-government/agendas-minutes-and-webcasts.aspx"},
  {name: "Wellington, County of", url: "https://www.wellington.ca/your-government/council-and-committee/agendas-minutes"},

  // Re-checking these 3 that had encoding or matching issues
  {name: "Burk's Falls, Village of", url: "https://www.burksfalls.net/townhall/council/agenda-minutes"},
  {name: "Mattice-Val Côté, Township of", url: "https://www.matticevalcote.ca/en/conseil-municipal"},
  {name: "O'Connor, Township of", url: "https://www.oconnortownship.ca/municipal-office/council/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Ontario municipalities (FINAL BATCH)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Ontario');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎉 Ontario municipalities discovery complete!`);
}
main().catch(console.error);
