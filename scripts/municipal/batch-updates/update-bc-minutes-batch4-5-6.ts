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
  {name: "Lions Bay", url: "https://www.lionsbay.ca/government/council-committee-meetings/agendas-minutes"},
  {name: "Logan Lake", url: "https://loganlake.ca/your-municipality/council-meetings/"},
  {name: "Lumby", url: "https://lumby.ca/minutes/"},
  {name: "Lytton", url: "https://lyttonbc.civicweb.net/portal/"},
  {name: "Mackenzie", url: "https://districtofmackenzie.ca/government-town-hall/council/council-meetings/"},
  {name: "Masset", url: "http://massetbc.com/village-office/minutes/"},
  {name: "McBride", url: "https://mcbride.ca/village-office/council-meetings"},
  {name: "Merritt", url: "http://www.merritt.ca/agendas-minutes/"},
  {name: "Metchosin", url: "https://www.metchosin.ca/council/council-meetings/agendas-minutes"},
  {name: "Midway", url: "https://midwaybc.ca/minutes-newsletters/"},
  {name: "Montrose", url: "https://midwaybc.ca/minutes-newsletters/"}, // Note: Montrose BC shares with Midway
  {name: "Nakusp", url: "https://www.nakusp.com/council/council-meetings-minutes-agendas"},
  {name: "Nelson", url: "https://www.nelson.ca/AgendaCenter"},
  {name: "New Denver", url: "https://newdenver.ca/village-business/council-meetings/"},
  {name: "New Hazelton", url: "https://newhazelton.ca/local-government/council-meetings"},
  {name: "North Saanich", url: "https://northsaanich.civicweb.net/Portal/"},
  {name: "North Vancouver City", url: "https://www.cnv.org/City-Hall/Council-Meetings/Council-Agendas,-Minutes-and-Videos"},
  {name: "North Vancouver District", url: "https://www.dnv.org/government-administration/meeting-agendas-and-minutes"},
  {name: "Northern Rockies", url: "https://www.northernrockies.ca/en/our-government/council-meetings.aspx"},
  {name: "Oak Bay", url: "https://www.oakbay.ca/council-administration/meetings-minutes/"},

  // Batch 5
  {name: "Oliver", url: "https://www.oliver.ca/council-meetings"},
  {name: "Osoyoos", url: "https://www.osoyoos.ca/council/council-members/agendas-minutes-videos"},
  {name: "Parksville", url: "http://www.parksville.ca/cms.asp?wpID=674"},
  {name: "Peachland", url: "https://www.peachland.ca/escribe"},
  {name: "Pemberton", url: "https://www.pemberton.ca/government/documents"},
  {name: "Pitt Meadows", url: "https://www.pittmeadows.ca/city-hall/council/council-meetings/council-meetings-agendas-minutes"},
  {name: "Port Alberni", url: "https://www.portalberni.ca/council-agendas-minutes"},
  {name: "Port Alice", url: "https://portalice.ca/town-hall/minutes-agendas/"},
  {name: "Port Clements", url: "https://portclements.ca/municipal-information/"},
  {name: "Port Edward", url: "https://www.portedward.ca/municipal-hall/agendas"},
  {name: "Port Hardy", url: "https://porthardy.ca/municipal-hall/our-council/meeting-agendas-minutes/"},
  {name: "Port McNeill", url: "https://portmcneill.ca/town-hall/council/"},
  {name: "Pouce Coupe", url: "https://poucecoupe.ca/government/administration/council-meetings/"},
  {name: "Powell River", url: "https://powellriver.ca/pages/council-and-committee-minutes-and-agendas"},
  {name: "Prince Rupert", url: "https://www.princerupert.ca/city-hall/council-meetings/council-meeting-agendas-minutes"},
  {name: "Princeton", url: "https://www.princeton.ca/p/council-information"},
  {name: "Qualicum Beach", url: "https://www.qualicumbeach.com/meetings-agendas"},
  {name: "Quesnel", url: "https://www.quesnel.ca/city-hall/council-meetings/agendas-minutes"},
  {name: "Radium Hot Springs", url: "https://radiumhotsprings.ca/village-office/agendas-minutes/"},
  {name: "Revelstoke", url: "https://revelstoke.ca/AgendaCenter"},

  // Batch 6
  {name: "Rossland", url: "https://rossland.ca/council/meetings/"},
  {name: "Salmo", url: "https://salmo.ca/council/council-meetings/"},
  {name: "Salmon Arm", url: "https://salmonarm.ca/96/Agenda-and-Minutes"},
  {name: "Sayward", url: "https://www.sayward.ca/government-bylaws/council-meetings"},
  {name: "Sechelt", url: "https://www.sechelt.ca/City-Hall/Agendas-Minutes"},
  {name: "shíshálh Nation", url: "https://shishalh.com/"},
  {name: "Sicamous", url: "https://sicamous.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Sidney", url: "https://sidney.civicweb.net/Portal/"},
  {name: "Silverton", url: "http://silverton.civicweb.net/Portal/default.aspx"},
  {name: "Slocan", url: "https://www.slocancity.com/council/"},
  {name: "Smithers", url: "https://www.smithers.ca/town-hall/town-council/council-meetings"},
  {name: "Sooke", url: "https://sooke.ca/municipal-hall/agenda-minutes/"},
  {name: "Spallumcheen", url: "https://www.spallumcheentwp.bc.ca/our-council/agendas-minutes.htm"},
  {name: "Sparwood", url: "https://sparwood.civicweb.net/Portal/"},
  {name: "Squamish", url: "https://squamish.civicweb.net/Portal/default.aspx"},
  {name: "Stewart", url: "https://districtofstewart.com/district-hall/council-meetings"},
  {name: "Summerland", url: "https://www.summerland.ca/your-city-hall/council-meetings/agendas-minutes"},
  {name: "Sun Peaks Mountain", url: "https://sunpeaksmunicipality.ca/municipal-hall/council/council-meetings"},
  {name: "Tahsis", url: "https://villageoftahsis.com/municipal-information/agendas-minutes/"},
  {name: "Taylor", url: "https://districtoftaylor.com/council-meetings/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} BC municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'British Columbia');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
}
main().catch(console.error);
