#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 9
  {name: "Wellesley, Township of", url: "https://www.wellesley.ca/council-and-administration/"},
  {name: "Wellington North, Township of", url: "https://www.wellington-north.com/government/council-committees/agendas-minutes"},
  {name: "West Elgin, Municipality of", url: "https://calendar.westelgin.net/meetings"},
  {name: "West Grey, Municipality of", url: "https://www.westgrey.com/municipal-government/agendas-and-minutes/"},
  {name: "West Lincoln, Township of", url: "https://www.westlincoln.ca/en/township-office/council-and-committee-meetings.aspx"},
  {name: "West Nipissing, Municipality of", url: "https://www.westnipissing.ca/town-hall/council/council-meetings/"},
  {name: "West Perth, Municipality of", url: "https://westperth.civicweb.net/portal/"},
  {name: "Westport, Village of", url: "https://villageofwestport.civicweb.net/Portal/"},
  {name: "Whitby, Town of", url: "https://www.whitby.ca/en/town-hall/council-meeting.aspx"},
  {name: "Whitchurch-Stouffville, Town of", url: "https://whitchurch.civicweb.net/"},
  {name: "White River, Township of", url: "https://www.whiteriver.ca/council-business"},
  {name: "Whitestone, Municipality of", url: "https://www.whitestone.ca/p/council-agendas-and-minutes"},
  {name: "Whitewater Region, Township of", url: "https://council.whitewaterregion.ca/"},
  {name: "Wilmot, Township of", url: "https://www.wilmot.ca/en/living-here/Past-Council-Agendas-and-Minutes.aspx"},
  {name: "Windsor, City of", url: "https://www.citywindsor.ca/city-hall/city-council-meetings"},
  {name: "Wollaston, Township of", url: "https://wollaston.ca/township-hall/minutes/"},
  {name: "Woodstock, City of", url: "https://www.cityofwoodstock.ca/en/city-governance/agendas-meetings-and-minutes.aspx"},
  {name: "Woolwich, Township of", url: "https://www.woolwich.ca/en/township-services/Council-Meetings.aspx"},
  {name: "York, Regional Municipality of", url: "https://www.york.ca/york-region/council-and-committee/agendas-minutes-and-reports"},
  {name: "Zorra, Township of", url: "http://www.zorra.on.ca/Home/Our-Township/Council/Council-Agenda-Minutes"},
  // Batch 10 - Additional
  {name: "Espanola, Town of", url: "https://espanola.ca/mayor-council/agendas-and-minutes"},
  {name: "Fort Erie, Town of", url: "https://pub-forterie.escribemeetings.com/"},
  {name: "Frontenac, County of", url: "https://www.frontenaccounty.ca/en/government/agendas-and-minutes.aspx"},
  {name: "Georgina, Town of", url: "https://www.georgina.ca/municipal-government/council-meetings/agendas-minutes-and-meetings"},
  {name: "Macdonald, Meredith and Aberdeen Additional, Township of", url: "https://echobay.ca/council-minutes/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Ontario municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Ontario');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
}
main().catch(console.error);
