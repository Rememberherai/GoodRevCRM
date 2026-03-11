#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const villageUpdates = [
  // Villages with URLs found (partial list - main ones with minutes)
  {name: "Abbey", url: "https://www.abbey.ca/council"},
  {name: "Avonlea", url: "https://www.villageofavonlea.com/"},
  {name: "Beechy", url: "https://beechy.ca/municipal-council/"},
  {name: "Belle Plaine", url: "https://belleplaine.ca/your-government/council-minutes/"},
  {name: "Bethune", url: "https://villageofbethune.com/administration-governance/minutes/"},
  {name: "Borden", url: "https://www.bordensask.ca/p/downloads-documents"},
  {name: "Bradwell", url: "https://www.villageofbradwell.ca/minutes"},
  {name: "Buena Vista", url: "https://www.buenavista.ca/2024-council-agendas-minutes/"},
  {name: "Canwood", url: "https://canwood.ca/administration/council-and-minutes"},
  {name: "Caronport", url: "https://www.caronport.ca/"},
  {name: "Chaplin", url: "https://www.villageofchaplin.ca/"},
  {name: "Christopher Lake", url: "https://www.lakeland521.ca/council/council-meeting-minutes/"},
  {name: "Clavet", url: "https://www.villageofclavet.com/"},
  {name: "Climax", url: "https://www.villageofclimax.ca/"},
  {name: "Conquest", url: "https://villageofconquest.ca/"},
  {name: "Craven", url: "https://villageofcraven.com/"},
  {name: "Debden", url: "https://debden.ca/administration/council-minutes/"},
  {name: "Dinsmore", url: "https://dinsmore.ca/"},
  {name: "Drake", url: "https://www.drake.ca/council-meetings/"},
  {name: "Earl Grey", url: "https://villageofearlgrey.ca/"},
  {name: "Edenwold", url: "https://rmedenwold.ca/agendas-and-minutes"},
  {name: "Elbow", url: "https://villageofelbow.com/residents/council_meeting_minutes.html"},
  {name: "Fillmore", url: "http://www.fillmorerm.ca/our-council.html"},
  {name: "Forget", url: "https://villageofforget.ca"},
  {name: "Glaslyn", url: "https://www.glaslyn.ca/administration/council/"},
  {name: "Glen Ewen", url: "https://www.villageofglenewen.com/"},
  {name: "Grayson", url: "http://www.rmofgrayson184.ca/council-meeting-minutes.html"},
  {name: "Hawarden", url: "https://villageofhawarden.ca/"},
  {name: "Loon Lake", url: "https://villageofloonlake.ca/council-administration/"},
  {name: "Loreburn", url: "https://www.villageofloreburn.ca/your-village/village-office"},
  {name: "Lucky Lake", url: "https://www.luckylake.ca/council-minutes/"},
  {name: "Macoun", url: "https://www.villageofmacoun.ca/"},
  {name: "Marcelin", url: "https://marcelin.ca/"},
  {name: "Marquis", url: "https://www.rmofmarquis.com/village-of-marquis/"},
  {name: "McLean", url: "http://mcleansask.com/contact-us/"},
  {name: "Mervin", url: "https://rmofmervin.ca/government/minutes.html"},
  {name: "Neilburg", url: "https://neilburg.ca/council_administration/minutes_budget.html"},
  {name: "Odessa", url: "http://odessa.ca/"},
  {name: "Paddockwood", url: "https://rmofpaddockwood.com"},
  {name: "Pelly", url: "https://www.pelly.ca/minutes.html"},
  {name: "Pleasantdale", url: "https://www.rmofpleasantdale.ca/copy-of-2024"},
  {name: "Rush Lake", url: "https://rm166.ca/minutes/"},
  {name: "Semans", url: "http://semans-sask.com"},
  {name: "Simpson", url: "https://simpsonsk.ca/Council-Minutes/"},
  {name: "Spy Hill", url: "http://villageofspyhill.ca"},
  {name: "Stockholm", url: "https://stockholmsask.com"},
  {name: "Theodore", url: "https://www.villageoftheodore.com/page10.html"},
  {name: "Tompkins", url: "https://www.tompkins.ca/minutes"},
  {name: "Torquay", url: "https://www.villageoftorquay.com/minutes"},
  {name: "Vanguard", url: "http://www.vanguardsk.ca/"},
  {name: "Vibank", url: "https://vibank.ca/"},
  {name: "Viscount", url: "https://www.villageofviscount.ca/"},
  {name: "Windthorst", url: "https://www.windthorstvillage.ca/"}
];

const resortVillageUpdates = [
  // Resort Villages with URLs found
  {name: "B-Say-Tah", url: "https://bsaytah.com/"},
  {name: "Candle Lake", url: "https://candlelake.ca/p/agendas-and-minutes"},
  {name: "Chitek Lake", url: "https://www.rvchiteklake.com/allmeetingminutes"},
  {name: "Cochin", url: "https://cochin.ca/"},
  {name: "Aquadeo", url: "https://aquadeo.net/"},
  {name: "District of Katepwa", url: "https://katepwabeach.ca/"},
  {name: "Fort San", url: "https://fortsan.ca/village-council/"},
  {name: "Grandview Beach", url: "https://grandviewbeachsask.ca/minutes/"},
  {name: "Kannata Valley", url: "https://kannatavalley.ca/"},
  {name: "Kenosee Lake", url: "https://villageofkenoseelake.com/"},
  {name: "Lumsden Beach", url: "http://lumsdenbeach.com/administration/council-meetings/"},
  {name: "Manitou Beach", url: "https://www.manitoubeach.ca/CouncilMinutes.php"},
  {name: "Mistusinne", url: "https://mistusinne.com/council.html"},
  {name: "Pelican Pointe", url: "https://www.pelicanpointe-rv.sk.ca/"},
  {name: "Pebble Baye", url: "https://pebblebaye.com/council/"},
  {name: "Saskatchewan Beach", url: "https://saskatchewanbeach.ca/council-meeting-minutes/"},
  {name: "Shields", url: "https://shields.ca/"},
  {name: "Sunset Cove", url: "https://rvsunsetcove.ca/wp/"},
  {name: "Thode", url: "https://www.thode.ca/financials--minutes.html"}
];

async function main() {
  console.log(`\n📥 Updating Saskatchewan villages and resort villages...\n`);

  console.log(`\nProcessing ${villageUpdates.length} villages...`);
  let villageUpdated = 0;
  for (const item of villageUpdates) {
    const { error } = await supabase
      .from('municipalities')
      .update({minutes_url: item.url, scan_status: 'pending'})
      .eq('name', item.name)
      .eq('province', 'Saskatchewan');

    if (!error) {
      console.log(`   ✅ ${item.name}`);
      villageUpdated++;
    } else {
      console.error(`   ❌ ${item.name}: ${error.message}`);
    }
  }

  console.log(`\nProcessing ${resortVillageUpdates.length} resort villages...`);
  let resortUpdated = 0;
  for (const item of resortVillageUpdates) {
    const { error } = await supabase
      .from('municipalities')
      .update({minutes_url: item.url, scan_status: 'pending'})
      .eq('name', item.name)
      .eq('province', 'Saskatchewan');

    if (!error) {
      console.log(`   ✅ ${item.name}`);
      resortUpdated++;
    } else {
      console.error(`   ❌ ${item.name}: ${error.message}`);
    }
  }

  console.log(`\n📊 Villages Updated: ${villageUpdated}/${villageUpdates.length}`);
  console.log(`📊 Resort Villages Updated: ${resortUpdated}/${resortVillageUpdates.length}`);
  console.log(`\n✅ SASKATCHEWAN VILLAGES & RESORT VILLAGES COMPLETE!`);
  console.log(`\nNote: Many small villages don't publish minutes online. They are available by contacting municipal offices.`);
}

main().catch(console.error);
