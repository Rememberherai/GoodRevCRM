#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batch5Updates = [
  {name: "Oro-Medonte, Township of", url: "https://oromedonte.civicweb.net/Portal/"},
  {name: "Oshawa, City of", url: "https://pub-oshawa.escribemeetings.com/"},
  {name: "Ottawa, City of", url: "https://ottawa.ca/en/city-hall/council-committees-and-boards/agendas-minutes-and-videos"},
  {name: "Owen Sound, City of", url: "https://pub-owensound.escribemeetings.com/"},
  {name: "Parry Sound, Town of", url: "https://www.parrysound.ca/government/inside-town-council/agendas-and-minutes/"},
  {name: "Pelham, Town of", url: "https://pelham-pub.escribemeetings.com/"},
  {name: "Pembroke, City of", url: "https://calendar.pembroke.ca/meetings"},
  {name: "Penetanguishene, Town of", url: "https://www.penetanguishene.ca/townhall/council/"},
  {name: "Perth, Town of", url: "https://perth.civicweb.net/Portal/MeetingSchedule.aspx"},
  {name: "Petawawa, Town of", url: "https://www.petawawa.ca/townhall/council/"},
  {name: "Peterborough, City of", url: "https://pub-peterborough.escribemeetings.com/"},
  {name: "Petrolia, Town of", url: "https://petrolia.civicweb.net/Portal/"},
  {name: "Pickering, City of", url: "https://calendar.pickering.ca/council"},
  {name: "Port Colborne, City of", url: "https://calendar.portcolborne.ca/meetings"},
  {name: "Port Hope, Municipality of", url: "https://www.porthope.ca/en/your-municipal-government/agendas-and-minutes.aspx"},
  {name: "Puslinch, Township of", url: "https://puslinch.ca/calendar/"},
  {name: "Quinte West, City of", url: "https://quintewest.civicweb.net/portal/"},
  {name: "Ramara, Township of", url: "https://ramara.civicweb.net/portal/"},
  {name: "Red Lake, Municipality of", url: "https://www.redlake.ca/our-government/council/agendas-minutes-and-videos/"},
  {name: "Renfrew, Town of", url: "https://www.renfrew.ca/town-hall/council-committees/councilmeetings"}
];

async function main() {
  console.log(`\n📥 Updating ${batch5Updates.length} Ontario municipalities...\n`);
  let updated = 0;
  for (const item of batch5Updates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Ontario');
    if (error) console.error(`   ❌ ${item.name}: ${error.message}`);
    else { console.log(`   ✅ ${item.name}`); updated++; }
  }
  console.log(`\n📊 ✅ Updated: ${updated}`);
}
main().catch(console.error);
