#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 4
  {name: "Ponoka", url: "https://www.ponoka.ca/p/council-minutes-and-agendas"},
  {name: "Provost", url: "https://www.provost.ca/p/council-meetings"},
  {name: "Rainbow Lake", url: "https://www.rainbowlake.ca/council-meetings"},
  {name: "Raymond", url: "https://raymond.ca/municipal-office/council-meetings/"},
  {name: "Redcliff", url: "https://redcliff.ca/p/council-meetings"},
  {name: "Redwater", url: "https://www.redwater.ca/your-town/town-council/council-meetings"},
  {name: "Rimbey", url: "https://www.rimbey.com/p/council-meetings"},
  {name: "Rocky Mountain House", url: "https://www.rockymtnhouse.com/p/council-meetings"},
  {name: "Sedgewick", url: "https://www.sedgewick.ca/administration/council-meetings"},
  {name: "Sexsmith", url: "https://www.sexsmith.ca/p/agendas-and-minutes"},
  {name: "Slave Lake", url: "https://www.slavelake.ca/AgendaCenter"},
  {name: "Smoky Lake", url: "https://www.smokylake.ca/p/council-meetings"},
  {name: "Spirit River", url: "https://spiritriver.ca/government/council-meetings/"},
  {name: "St. Paul", url: "https://www.town.stpaul.ab.ca/p/council-meetings"},
  {name: "Stavely", url: "https://stavely.ca/p/council-meetings"},
  {name: "Stettler", url: "https://stettler.net/agendacenter"},
  {name: "Stony Plain", url: "https://www.stonyplain.com/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Strathmore", url: "https://strathmore.ca/government/council-committee-meetings/agendas-minutes-videos"},
  {name: "Sundre", url: "https://www.sundre.com/agendas-minutes"},
  {name: "Swan Hills", url: "https://swanhills.ca/government/council-meetings/"},

  // Batch 5
  {name: "Sylvan Lake", url: "https://www.sylvanlake.ca/town-hall/agendas-minutes"},
  {name: "Taber", url: "https://www.taber.ca/town-hall/meeting-agendas-minutes"},
  {name: "Thorsby", url: "https://www.thorsby.ca/your-town/council-meetings"},
  {name: "Three Hills", url: "https://threehills.ca/community/council-meetings"},
  {name: "Tofield", url: "https://www.tofield.ca/p/minutes-and-agendas"},
  {name: "Trochu", url: "https://trochu.ca/p/council-meetings"},
  {name: "Two Hills", url: "https://www.twohills.ca/p/agendas-and-minutes"},
  {name: "Valleyview", url: "https://www.valleyview.ca/government/agendas-and-minutes/"},
  {name: "Vauxhall", url: "https://www.vauxhall.ca/your-town/council-meetings"},
  {name: "Vegreville", url: "https://www.vegreville.com/p/agendas-and-minutes"},
  {name: "Vermilion", url: "https://vermilion.ca/your-town/town-council/council-meetings"},
  {name: "Viking", url: "https://www.viking.ca/p/council-meetings"},
  {name: "Vulcan", url: "https://vulcan.ca/municipal-office/council/agendas-minutes/"},
  {name: "Wainwright", url: "https://www.wainwright.ca/p/minutes-and-agendas"},
  {name: "Wembley", url: "https://www.wembley.ca/p/council-meetings"},
  {name: "Westlock", url: "https://www.westlock.ca/government/council/agendas-minutes"},
  {name: "Whitecourt", url: "https://whitecourt.ca/government/agendas-minutes/"},
  {name: "Wetaskiwin", url: "https://wetaskiwin.civicweb.net/Portal/MeetingTypeList.aspx"}
];

async function main() {
  console.log(`\n📥 Updating final ${batchUpdates.length} Alberta municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Alberta');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎉 Alberta municipalities now complete!`);
}
main().catch(console.error);
