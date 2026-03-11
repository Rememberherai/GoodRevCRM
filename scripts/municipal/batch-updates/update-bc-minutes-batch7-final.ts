#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  {name: "Telkwa", url: "https://www.telkwa.ca/council-meetings"},
  {name: "Terrace", url: "https://www.terrace.ca/city-hall/council-agendas-and-minutes"},
  {name: "Tofino", url: "https://tofino.ca/your-government/council/council-meetings/"},
  {name: "Trail", url: "https://trail.ca/en/inside-city-hall/council-meetings.aspx"},
  {name: "Tumbler Ridge", url: "https://www.districtoftumblerridge.ca/p/council-meeting"},
  {name: "Ucluelet", url: "https://ucluelet.ca/government/council-and-committees/council-meetings/"},
  {name: "Valemount", url: "https://valemount.ca/"},
  {name: "Vanderhoof", url: "https://vanderhoof.ca/municipal-hall/council-meetings/"},
  {name: "View Royal", url: "https://www.viewroyal.ca/EN/main/town/agendas-minutes-videos/council-meetings.html"},
  {name: "Warfield", url: "https://warfield.ca/village-office/council-meetings/"},
  {name: "Wells", url: "https://www.wells.ca/district-wells/council-meeting-schedule"},
  {name: "Whistler", url: "https://www.whistler.ca/mayor-council/council-meetings/council-video-agendas-minutes/"},
  {name: "White Rock", url: "https://www.whiterockcity.ca/894/Council-Meeting-Agendas-Minutes-Videos"},
  {name: "Williams Lake", url: "https://www.williamslake.ca/729/Council-Meetings"}
];

async function main() {
  console.log(`\n📥 Updating final ${batchUpdates.length} BC municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'British Columbia');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎉 All British Columbia municipalities now have minutes URLs!`);
}
main().catch(console.error);
