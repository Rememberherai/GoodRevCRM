#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batch4Updates = [
  {name: "Lucan Biddulph, Township of", url: "https://www.lucanbiddulph.on.ca/town-hall/council-agendas-minutes"},
  {name: "Machar, Township of", url: "https://townshipofmachar.ca/en/municipal-services/meetings-agendas"},
  {name: "Madawaska Valley, Township of", url: "https://madawaskavalley.civicweb.net/portal/"},
  {name: "Madoc, Township of", url: "https://madoc.ca/minutes/"},
  {name: "Mapleton, Township of", url: "https://mapleton.ca/services/council/agendas-minutes-archive"},
  {name: "Marathon, Town of", url: "https://calendar.marathon.ca/meetings"},
  {name: "Markham, City of", url: "https://pub-markham.escribemeetings.com/"},
  {name: "Meaford, Municipality of", url: "https://meaford.civicweb.net/portal/"},
  {name: "Merrickville-Wolford, Village of", url: "https://www.merrickville-wolford.ca/governance/agendas-minutes"},
  {name: "Middlesex Centre, Municipality of", url: "https://www.middlesexcentre.ca/services/residents/council-meetings"},
  {name: "Midland, Town of", url: "https://www.midland.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Minto, Town of", url: "https://www.town.minto.on.ca/government/agendas-minutes"},
  {name: "Mississippi Mills, Town of", url: "https://www.mississippimills.ca/municipal-hall/mayor-and-council/archive-of-agendas-and-minutes/"},
  {name: "Mississauga, City of", url: "https://www.mississauga.ca/council/council-activities/council-agendas-minutes-and-calendar/"},
  {name: "Newmarket, Town of", url: "https://www.newmarket.ca/TownGovernment/Pages/Council-Meetings.aspx"},
  {name: "Niagara Falls, City of", url: "https://niagarafalls.ca/city-government/city-council-and-mayor/agendas-minutes-and-schedule/"},
  {name: "North Bay, City of", url: "https://northbay.ca/city-government/meetings-agendas-minutes/"},
  {name: "Oakville, Town of", url: "https://www.oakville.ca/town-hall/mayor-council-administration/agendas-meetings/"},
  {name: "Orangeville, Town of", url: "https://calendar.orangeville.ca/meetings"},
  {name: "Orillia, City of", url: "https://orillia.civicweb.net/portal/"}
];

async function main() {
  console.log(`\n📥 Updating ${batch4Updates.length} Ontario municipalities with minutes URLs...\n`);

  let updated = 0;

  for (const item of batch4Updates) {
    const { error } = await supabase
      .from('municipalities')
      .update({
        minutes_url: item.url,
        scan_status: 'pending'
      })
      .eq('name', item.name)
      .eq('province', 'Ontario');

    if (error) {
      console.error(`   ❌ Error updating ${item.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Updated: ${item.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Summary: ✅ Updated: ${updated}`);
}

main().catch(console.error);
