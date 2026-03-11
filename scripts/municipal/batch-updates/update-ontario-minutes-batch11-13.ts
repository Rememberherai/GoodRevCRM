#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 11 - Major cities
  {name: "Barrie, City of", url: "https://barrie.legistar.com/"},
  {name: "Belleville, City of", url: "https://www.belleville.ca/city-hall/mayor-council/agendas-and-minutes"},
  {name: "Brampton, City of", url: "https://calendar.brampton.ca/meetings"},
  {name: "Brantford, City of", url: "https://calendar.brantford.ca/council"},
  {name: "Burlington, City of", url: "https://www.burlington.ca/city-council/agendas-and-minutes"},
  {name: "Guelph, City of", url: "https://guelph.ca/city-hall/council-and-committees/"},
  {name: "Hamilton, City of", url: "https://pub-hamilton.escribemeetings.com/"},
  {name: "Kawartha Lakes, City of", url: "https://kawarthalakes.civicweb.net/portal/"},
  {name: "Kingston, City of", url: "https://www.cityofkingston.ca/council-and-city-administration/council/council-meetings/"},
  {name: "Kitchener, City of", url: "https://calendar.kitchener.ca/council"},
  {name: "London, City of", url: "https://pub-london.escribemeetings.com/"},
  {name: "Markham, City of", url: "https://calendar.markham.ca/council"},
  {name: "Milton, Town of", url: "https://www.milton.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Mississauga, City of", url: "https://www.mississauga.ca/city-hall/council/agendas-and-minutes/"},
  {name: "Newmarket, Town of", url: "https://pub-newmarket.escribemeetings.com/"},
  {name: "Niagara Falls, City of", url: "https://www.niagarafalls.ca/city-hall/mayor-council/agendas-minutes.aspx"},
  {name: "Oakville, Town of", url: "https://calendar.oakville.ca/meetings"},
  {name: "St. Catharines, City of", url: "https://stcatharines.civicweb.net/"},
  {name: "Waterloo, City of", url: "https://pub-waterloo.escribemeetings.com/"},
  {name: "Windsor, City of", url: "https://www.citywindsor.ca/council/agendas-and-minutes/"},

  // Batch 13 - Townships M-Z
  {name: "Madawaska Valley, Township of", url: "https://www.madawaskavalley.ca/municipal-government/council/agendas-and-minutes/"},
  {name: "Magnetawan, Municipality of", url: "https://magnetawan.com/council/council-meetings/"},
  {name: "Malahide, Township of", url: "https://malahide.ca/government/council/agendas-and-minutes/"},
  {name: "Manitouwadge, Township of", url: "https://www.manitouwadge.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Mapleton, Township of", url: "https://mapleton.ca/en/municipal-services/agendas-and-minutes.aspx"},
  {name: "Marathon, Town of", url: "https://www.marathon.ca/town-hall/council/agendas-and-minutes/"},
  {name: "Markstay-Warren, Municipality of", url: "https://markstay-warren.ca/"},
  {name: "Marmora and Lake, Municipality of", url: "https://marmoraandlake.ca/government/council/agendas-and-minutes/"},
  {name: "Mattawa, Town of", url: "https://www.mattawa.ca/"},
  {name: "Mattawan, Township of", url: "https://mattawan.ca/"},
  {name: "Mattice-Val Côté, Township of", url: "https://matticevalcote.com/"},
  {name: "McDougall, Municipality of", url: "https://www.mcdougall.ca/government/council/agendas-and-minutes/"},
  {name: "McGarry, Township of", url: "https://mcgarry.ca/"},
  {name: "McKellar, Township of", url: "https://www.mckellar.ca/council/agendas-and-minutes/"},
  {name: "McMurrich/Monteith, Township of", url: "https://www.mcmurrichmonteith.ca/"},
  {name: "McNab/Braeside, Township of", url: "https://www.mcnabbraeside.com/council-meetings/"},
  {name: "Meaford, Municipality of", url: "https://meaford.civicweb.net/portal/"},
  {name: "Melancthon, Township of", url: "https://melancthontownship.ca/government/agendas-and-minutes/"},
  {name: "Merrickville-Wolford, Village of", url: "https://merrickville-wolford.ca/government/council/agendas-and-minutes/"},
  {name: "Middlesex Centre, Municipality of", url: "https://www.middlesexcentre.ca/government/council/agendas-and-minutes"}
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
