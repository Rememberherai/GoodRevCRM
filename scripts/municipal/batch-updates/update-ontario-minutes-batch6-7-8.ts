#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 6
  {name: "Richmond Hill, Town of", url: "https://www.richmondhill.ca/en/our-services/Council-Meetings-Agendas-and-Minutes.aspx"},
  {name: "Rideau Lakes, Township of", url: "https://www.rideaulakes.ca/town-hall/council/agendas-minutes-videos"},
  {name: "Russell, Township of", url: "https://calendar.russell.ca/meetings"},
  {name: "Sarnia, City of", url: "https://sarnia.civicweb.net/Portal/"},
  {name: "Sault Ste. Marie, City of", url: "https://saultstemarie.ca/government/city-council/council-agendas-minutes-and-schedule/"},
  {name: "Scugog, Township of", url: "https://www.scugog.ca/en/township-office/Mayor-and-Council.aspx"},
  {name: "Seguin, Township of", url: "https://www.seguin.ca/en/township-services/councilmeetings.aspx"},
  {name: "Severn, Township of", url: "https://severn.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Shelburne, Town of", url: "https://www.shelburne.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Sioux Lookout, Municipality of", url: "https://www.siouxlookout.ca/"},
  {name: "Smiths Falls, Town of", url: "https://www.smithsfalls.ca/en/town-hall/council-meetings.aspx"},
  {name: "Smooth Rock Falls, Town of", url: "https://townofsmoothrockfalls.civicweb.net/"},
  {name: "South Bruce, Municipality of", url: "https://www.southbruce.ca/en/municipal-government/agendas-and-minutes.aspx"},
  {name: "South Dundas, Municipality of", url: "https://www.southdundas.com/municipal-centre/council"},
  {name: "South Frontenac, Township of", url: "https://www.southfrontenac.net/en/town-hall/agendas-and-minutes.aspx"},
  {name: "South Glengarry, Township of", url: "https://www.southglengarry.com/en/municipal-services/agendas-and-minutes.aspx"},
  {name: "South Huron, Municipality of", url: "https://www.southhuron.ca/en/government/agendas-and-minutes.aspx"},
  {name: "South Stormont, Township of", url: "https://www.southstormont.ca/en/town-hall/council-meetings.aspx"},
  {name: "Southgate, Township of", url: "https://www.southgate.ca/local-government/agendas-and-minutes/"},
  {name: "Southwest Middlesex, Municipality of", url: "https://www.southwestmiddlesex.ca/services/agendas-and-minutes"},
  // Batch 7
  {name: "Spanish, Town of", url: "https://www.townofspanish.com/mayor-and-council/minutes-and-by-laws/"},
  {name: "St. Catharines, City of", url: "https://stcatharines.civicweb.net/"},
  {name: "St. Clair, Township of", url: "https://www.stclairtownship.ca/government/council/minutes/"},
  {name: "St. Joseph, Township of", url: "https://stjosephtownship.com/"},
  {name: "St. Marys, Town of", url: "https://www.townofstmarys.com/town-government/agendas-minutes/"},
  {name: "St. Thomas, City of", url: "https://www.stthomas.ca/city_hall/council_agendas_and_minutes"},
  {name: "St.-Charles, Municipality of", url: "https://stcharlesontario.ca/municipality/council/agendas-and-minutes/"},
  {name: "Stirling-Rawdon, Township of", url: "https://stirling-rawdon.civicweb.net/portal/"},
  {name: "Stone Mills, Township of", url: "https://www.stonemills.com/our-government/council/agendas-and-minutes/"},
  {name: "Stratford, City of", url: "https://www.stratford.ca/en/inside-city-hall/agendasmeetingsminutes.aspx"},
  {name: "Strathroy-Caradoc, Municipality of", url: "https://www.strathroy-caradoc.ca/city-hall/mayor-council/council-committee-agendas-minutes/"},
  {name: "Strong, Township of", url: "https://www.strongtownship.com/local-government/council/agendas-and-minutes/"},
  {name: "Sudbury, District of", url: "https://www.greatersudbury.ca/city-hall/mayor-and-council/meetings-agendas-and-minutes/"},
  {name: "Tarbutt, Township of", url: "https://tarbutt.ca/minutes-budget/"},
  {name: "Tay, Township of", url: "https://tay.civicweb.net/Portal/"},
  {name: "Tay Valley, Township of", url: "https://www.tayvalleytwp.ca/en/municipal-government/Council-and-Committee-Meetings.aspx"},
  {name: "Tecumseh, Town of", url: "https://www.tecumseh.ca/town-government/council/agendas-and-minutes/"},
  {name: "Temiskaming Shores, City of", url: "https://www.temiskamingshores.ca/city-hall/mayor-council/council-meetings/"},
  {name: "Terrace Bay, Township of", url: "https://www.terracebay.ca/"},
  {name: "The Archipelago, Township of", url: "https://www.thearchipelago.on.ca/p/council-agendas-and-minutes"},
  // Batch 8
  {name: "The Nation, Municipality of", url: "https://nationmun.ca/en/council-staff/council/agendas-minutes"},
  {name: "Thessalon, Town of", url: "https://thessalon.ca/"},
  {name: "Thorold, City of", url: "https://www.thorold.ca/en/city-hall/agendas-and-minutes.aspx"},
  {name: "Thunder Bay, City of", url: "https://www.thunderbay.ca/en/city-hall/current-agendas-and-minutes.aspx"},
  {name: "Tillsonburg, Town of", url: "https://www.tillsonburg.ca/town-hall/council/agendas-and-minutes/"},
  {name: "Timmins, City of", url: "https://www.timmins.ca/our_services/city_hall/mayor_and_council/meeting_agendas_and_minutes"},
  {name: "Tiny, Township of", url: "https://tiny.civicweb.net/Portal/"},
  {name: "Toronto, City of", url: "https://www.toronto.ca/city-government/council/council-committee-meetings/"},
  {name: "Trent Hills, Municipality of", url: "https://www.trenthills.ca/council-administration/council/agendas-and-minutes/"},
  {name: "Trent Lakes, Municipality of", url: "https://www.trentlakes.ca/government/council/"},
  {name: "Tudor and Cashel, Township of", url: "https://tudorandcashel.com/council/about-council-meetings/minutes/"},
  {name: "Tweed, Municipality of", url: "https://tweed.ca/meetingsc10"},
  {name: "Tyendinaga, Township of", url: "https://tyendinagatownship.civicweb.net/portal/"},
  {name: "Uxbridge, Township of", url: "https://www.uxbridge.ca/en/your-local-government/council-meeting-calendar.aspx"},
  {name: "Vaughan, City of", url: "https://www.vaughan.ca/council/committees-council-agendas-minutes"},
  {name: "Wainfleet, Township of", url: "https://www.wainfleet.ca/town-hall/council/agendas-and-minutes"},
  {name: "Warwick, Township of", url: "https://www.warwicktownship.ca/en/our-government/council.aspx"},
  {name: "Wasaga Beach, Town of", url: "https://www.wasagabeach.com/en/town-and-government/agendas-and-minutes.aspx"},
  {name: "Wawa, Municipality of", url: "https://www.wawa.cc/en/your-government/agendas-and-minutes.aspx"},
  {name: "Welland, City of", url: "https://www.welland.ca/council/AgendasMinutes.asp"}
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
