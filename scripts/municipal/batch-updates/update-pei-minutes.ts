#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const peiUpdates = [
  // Cities
  {name: "Charlottetown", url: "https://www.charlottetown.ca/mayor___council/council_meetings"},
  {name: "Summerside", url: "https://www.summerside.ca/"},

  // Towns
  {name: "Alberton", url: "https://townofalberton.ca/"},
  {name: "Borden-Carleton", url: "https://www.borden-carleton.ca/"},
  {name: "Cornwall", url: "https://cornwallpe.ca/town-hall/council-minutes/"},
  {name: "Kensington", url: "https://kensington.ca/"},
  {name: "North Rustico", url: "https://northrustico.com/governing/council/2018-meeting-minutes/"},
  {name: "O'Leary", url: "https://townofoleary.com/"},
  {name: "Souris", url: "https://sourispei.com/"},
  {name: "Stratford", url: "https://townofstratford.ca/"},
  {name: "Three Rivers", url: "https://www.threeriverspei.com/"},
  {name: "Tignish", url: "https://www.townoftignish.ca/"},

  // Rural Municipalities
  {name: "Abram-Village", url: "https://abramvillage.wordpress.com/"},
  {name: "Alexandra", url: "https://alexandrapei.com/minutes-of-council-meetings/"},
  {name: "Bedeque and Area", url: "https://bedequeandarea.ca/"},
  {name: "Belfast", url: "https://www.ruralmunicipalityofbelfast.com/"},
  {name: "Brackley", url: "https://brackleypei.ca/"},
  {name: "Breadalbane", url: "https://www.communityofbreadalbane.ca/"},
  {name: "Central Kings", url: "https://centralkings.wordpress.com/"},
  {name: "Clyde River", url: "https://clyderiverpei.com/"},
  {name: "Crapaud", url: "https://www.communityofcrapaud.com/"},
  {name: "Eastern Kings", url: "https://www.easternkingspei.ca/agenda-minutes/"},
  {name: "Hazelbrook", url: "https://www.communityofhazelbrook.com/"},
  {name: "Hunter River", url: "https://www.municipalityofhunterriver.com/"},
  {name: "Kingston", url: "https://kingstonpei.ca/"},
  {name: "Kinkora", url: "https://kinkorapei.ca/"},
  {name: "Linkletter", url: "https://communityoflinkletter.wordpress.com/"},
  {name: "Lot 11 and Area", url: "https://lot11andarea.org/"},
  {name: "Malpeque Bay", url: "https://www.malpequebay.ca/councilminutes"},
  {name: "Miltonvale Park", url: "https://miltonvalepark.com/minutes/"},
  {name: "Miscouche", url: "https://miscouche.ca/council-minutes/"},
  {name: "Morell", url: "https://morell.ca/meetings/"},
  {name: "Mount Stewart", url: "http://mountstewartpei.com"},
  {name: "Murray Harbour", url: "https://murrayharbour.ca/administration/meetingsandfinance/"},
  {name: "Murray River", url: "https://www.murrayriverpei.ca/council-meeting-minutes/"},
  {name: "North Shore", url: "https://communityofnorthshore.weebly.com/council-minutes.html"},
  {name: "North Wiltshire", url: "https://www.northwiltshirepei.com"},
  {name: "Northport", url: "https://municipalityofnorthport.wordpress.com"},
  {name: "Sherbrooke", url: "http://www.sherbrookecommunity.ca"},
  {name: "Souris West", url: "https://www.souriswest.com/agendas-minutes-bylaws/"},
  {name: "St. Louis", url: "https://ruralmunicipalityofstlouis.wordpress.com"},
  {name: "St. Nicholas", url: "https://municipalityofstnicholas.wordpress.com"},
  {name: "St. Peters Bay", url: "http://www.stpetersbaycommunity.com/meetings/"},
  {name: "Tignish Shore", url: "https://tignishshoremunicipality.wordpress.com"},
  {name: "Tyne Valley", url: "https://www.ruralmunicipalityoftynevalley.com"},
  {name: "Union Road", url: "https://www.communityofunionroadpei.com/home/meetings"},
  {name: "Victoria", url: "https://www.rmvictoria.com/agendas-and-minutes"},
  {name: "Warren Grove", url: "https://communityofwarrengrove.com/council-minutes/"},
  {name: "Wellington", url: "https://villagewellington.wordpress.com/meeting-minutes/"},
  {name: "West River", url: "https://www.westriverpe.ca/council/meeting"},
  {name: "York", url: "https://yorkpei.ca/council"},

  // Resort Municipality
  {name: "Stanley Bridge, Hope River, Bayview, Cavendish and North Rustico", url: "https://resortmunicipalitypei.com/municipal-government/minutes/"}
];

async function main() {
  console.log(`\n📥 Updating ${peiUpdates.length} Prince Edward Island municipalities...\n`);
  let updated = 0;
  for (const item of peiUpdates) {
    const { error } = await supabase
      .from('municipalities')
      .update({minutes_url: item.url, scan_status: 'pending'})
      .eq('name', item.name)
      .eq('province', 'Prince Edward Island');

    if (!error) {
      console.log(`   ✅ ${item.name}`);
      updated++;
    } else {
      console.error(`   ❌ ${item.name}: ${error.message}`);
    }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${peiUpdates.length}`);
  console.log(`\n✅ PRINCE EDWARD ISLAND COMPLETE!`);
}

main().catch(console.error);
