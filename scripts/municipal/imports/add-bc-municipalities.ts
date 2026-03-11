#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// BC Municipalities from Wikipedia list
const bcMunicipalities = [
  // Cities (53)
  {name: "Abbotsford", type: "City", region: "Fraser Valley", population: 153524},
  {name: "Armstrong", type: "City", region: "North Okanagan", population: 5323},
  {name: "Burnaby", type: "City", region: "Metro Vancouver", population: 249125},
  {name: "Campbell River", type: "City", region: "Strathcona", population: 35519},
  {name: "Castlegar", type: "City", region: "Central Kootenay", population: 8338},
  {name: "Chilliwack", type: "City", region: "Fraser Valley", population: 93203},
  {name: "Colwood", type: "City", region: "Capital", population: 18961},
  {name: "Coquitlam", type: "City", region: "Metro Vancouver", population: 148625},
  {name: "Courtenay", type: "City", region: "Comox Valley", population: 28420},
  {name: "Cranbrook", type: "City", region: "East Kootenay", population: 20499},
  {name: "Dawson Creek", type: "City", region: "Peace River", population: 12323},
  {name: "Delta", type: "City", region: "Metro Vancouver", population: 108455},
  {name: "Duncan", type: "City", region: "Cowichan Valley", population: 5047},
  {name: "Enderby", type: "City", region: "North Okanagan", population: 3028},
  {name: "Fernie", type: "City", region: "East Kootenay", population: 6320},
  {name: "Fort St. John", type: "City", region: "Peace River", population: 21465},
  {name: "Grand Forks", type: "City", region: "Kootenay Boundary", population: 4112},
  {name: "Greenwood", type: "City", region: "Kootenay Boundary", population: 702},
  {name: "Kamloops", type: "City", region: "Thompson-Nicola", population: 97902},
  {name: "Kelowna", type: "City", region: "Central Okanagan", population: 144576},
  {name: "Kimberley", type: "City", region: "East Kootenay", population: 8115},
  {name: "Langford", type: "City", region: "Capital", population: 46584},
  {name: "Langley City", type: "City", region: "Metro Vancouver", population: 28963},
  {name: "Maple Ridge", type: "City", region: "Metro Vancouver", population: 90990},
  {name: "Merritt", type: "City", region: "Thompson-Nicola", population: 7051},
  {name: "Mission", type: "City", region: "Fraser Valley", population: 41519},
  {name: "Nanaimo", type: "City", region: "Nanaimo", population: 99863},
  {name: "Nelson", type: "City", region: "Central Kootenay", population: 11106},
  {name: "New Westminster", type: "City", region: "Metro Vancouver", population: 78916},
  {name: "North Vancouver City", type: "City", region: "Metro Vancouver", population: 58120},
  {name: "Parksville", type: "City", region: "Nanaimo", population: 13642},
  {name: "Penticton", type: "City", region: "Okanagan-Similkameen", population: 36885},
  {name: "Pitt Meadows", type: "City", region: "Metro Vancouver", population: 19146},
  {name: "Port Alberni", type: "City", region: "Alberni-Clayoquot", population: 18259},
  {name: "Port Coquitlam", type: "City", region: "Metro Vancouver", population: 61498},
  {name: "Port Moody", type: "City", region: "Metro Vancouver", population: 33535},
  {name: "Powell River", type: "City", region: "qathet", population: 13943},
  {name: "Prince George", type: "City", region: "Fraser-Fort George", population: 76708},
  {name: "Prince Rupert", type: "City", region: "North Coast", population: 12300},
  {name: "Quesnel", type: "City", region: "Cariboo", population: 9889},
  {name: "Revelstoke", type: "City", region: "Columbia Shuswap", population: 8275},
  {name: "Richmond", type: "City", region: "Metro Vancouver", population: 209937},
  {name: "Rossland", type: "City", region: "Kootenay Boundary", population: 4140},
  {name: "Salmon Arm", type: "City", region: "Columbia Shuswap", population: 19432},
  {name: "Surrey", type: "City", region: "Metro Vancouver", population: 568322},
  {name: "Terrace", type: "City", region: "Kitimat-Stikine", population: 12017},
  {name: "Trail", type: "City", region: "Kootenay Boundary", population: 7920},
  {name: "Vancouver", type: "City", region: "Metro Vancouver", population: 662248},
  {name: "Vernon", type: "City", region: "North Okanagan", population: 44519},
  {name: "Victoria", type: "City", region: "Capital", population: 91867},
  {name: "West Kelowna", type: "City", region: "Central Okanagan", population: 36078},
  {name: "White Rock", type: "City", region: "Metro Vancouver", population: 21939},
  {name: "Williams Lake", type: "City", region: "Cariboo", population: 10947},

  // District Municipalities (41)
  {name: "100 Mile House", type: "District", region: "Cariboo", population: 1928},
  {name: "Barriere", type: "District", region: "Thompson-Nicola", population: 1765},
  {name: "Central Saanich", type: "District", region: "Capital", population: 17385},
  {name: "Chetwynd", type: "District", region: "Peace River", population: 2302},
  {name: "Clearwater", type: "District", region: "Thompson-Nicola", population: 2388},
  {name: "Coldstream", type: "District", region: "North Okanagan", population: 11171},
  {name: "Elkford", type: "District", region: "East Kootenay", population: 2749},
  {name: "Esquimalt", type: "District", region: "Capital", population: 17533},
  {name: "Fort St. James", type: "District", region: "Bulkley-Nechako", population: 1386},
  {name: "Highlands", type: "District", region: "Capital", population: 2482},
  {name: "Hope", type: "District", region: "Fraser Valley", population: 6686},
  {name: "Houston", type: "District", region: "Bulkley-Nechako", population: 3052},
  {name: "Hudson's Hope", type: "District", region: "Peace River", population: 841},
  {name: "Invermere", type: "District", region: "East Kootenay", population: 3917},
  {name: "Kent", type: "District", region: "Fraser Valley", population: 6300},
  {name: "Kitimat", type: "District", region: "Kitimat-Stikine", population: 8236},
  {name: "Lake Country", type: "District", region: "Central Okanagan", population: 15817},
  {name: "Langley District", type: "District", region: "Metro Vancouver", population: 132603},
  {name: "Lantzville", type: "District", region: "Nanaimo", population: 3817},
  {name: "Lillooet", type: "District", region: "Squamish-Lillooet", population: 2302},
  {name: "Logan Lake", type: "District", region: "Thompson-Nicola", population: 2255},
  {name: "Mackenzie", type: "District", region: "Fraser-Fort George", population: 3281},
  {name: "Metchosin", type: "District", region: "Capital", population: 5067},
  {name: "New Hazelton", type: "District", region: "Kitimat-Stikine", population: 602},
  {name: "North Cowichan", type: "District", region: "Cowichan Valley", population: 31990},
  {name: "North Saanich", type: "District", region: "Capital", population: 12235},
  {name: "North Vancouver District", type: "District", region: "Metro Vancouver", population: 88168},
  {name: "Northern Rockies", type: "District", region: "Northern Rockies", population: 3947},
  {name: "Oak Bay", type: "District", region: "Capital", population: 17990},
  {name: "Peachland", type: "District", region: "Central Okanagan", population: 5789},
  {name: "Port Edward", type: "District", region: "North Coast", population: 470},
  {name: "Port Hardy", type: "District", region: "Mount Waddington", population: 3902},
  {name: "Saanich", type: "District", region: "Capital", population: 117735},
  {name: "Sechelt", type: "District", region: "Sunshine Coast", population: 10847},
  {name: "Sicamous", type: "District", region: "Columbia Shuswap", population: 2613},
  {name: "Sooke", type: "District", region: "Capital", population: 15086},
  {name: "Spallumcheen", type: "District", region: "North Okanagan", population: 5307},
  {name: "Sparwood", type: "District", region: "East Kootenay", population: 4148},
  {name: "Squamish", type: "District", region: "Squamish-Lillooet", population: 23819},
  {name: "Stewart", type: "District", region: "Kitimat-Stikine", population: 517},
  {name: "Summerland", type: "District", region: "Okanagan-Similkameen", population: 12042},
  {name: "Taylor", type: "District", region: "Peace River", population: 1317},
  {name: "Tofino", type: "District", region: "Alberni-Clayoquot", population: 2516},
  {name: "Tumbler Ridge", type: "District", region: "Peace River", population: 2399},
  {name: "Ucluelet", type: "District", region: "Alberni-Clayoquot", population: 2066},
  {name: "Vanderhoof", type: "District", region: "Bulkley-Nechako", population: 4346},
  {name: "Wells", type: "District", region: "Cariboo", population: 218},
  {name: "West Vancouver", type: "District", region: "Metro Vancouver", population: 44122},

  // Special Municipalities (4)
  {name: "shíshálh Nation", type: "First Nations", region: "qathet", population: 765},
  {name: "Bowen Island", type: "Island", region: "Metro Vancouver", population: 4256},
  {name: "Sun Peaks Mountain", type: "Resort", region: "Thompson-Nicola", population: 1404},
  {name: "Whistler", type: "Resort", region: "Squamish-Lillooet", population: 13982},

  // Towns (14)
  {name: "Comox", type: "Town", region: "Comox Valley", population: 14806},
  {name: "Creston", type: "Town", region: "Central Kootenay", population: 5583},
  {name: "Gibsons", type: "Town", region: "Sunshine Coast", population: 4758},
  {name: "Golden", type: "Town", region: "Columbia Shuswap", population: 3986},
  {name: "Ladysmith", type: "Town", region: "Cowichan Valley", population: 8990},
  {name: "Lake Cowichan", type: "Town", region: "Cowichan Valley", population: 3325},
  {name: "Oliver", type: "Town", region: "Okanagan-Similkameen", population: 5094},
  {name: "Osoyoos", type: "Town", region: "Okanagan-Similkameen", population: 5556},
  {name: "Port McNeill", type: "Town", region: "Mount Waddington", population: 2356},
  {name: "Princeton", type: "Town", region: "Okanagan-Similkameen", population: 2894},
  {name: "Qualicum Beach", type: "Town", region: "Nanaimo", population: 9303},
  {name: "Sidney", type: "Town", region: "Capital", population: 12318},
  {name: "Smithers", type: "Town", region: "Bulkley-Nechako", population: 5378},
  {name: "View Royal", type: "Town", region: "Capital", population: 11575},

  // Villages (50)
  {name: "Alert Bay", type: "Village", region: "Mount Waddington", population: 449},
  {name: "Anmore", type: "Village", region: "Metro Vancouver", population: 2356},
  {name: "Ashcroft", type: "Village", region: "Thompson-Nicola", population: 1670},
  {name: "Belcarra", type: "Village", region: "Metro Vancouver", population: 687},
  {name: "Burns Lake", type: "Village", region: "Bulkley-Nechako", population: 1659},
  {name: "Cache Creek", type: "Village", region: "Thompson-Nicola", population: 969},
  {name: "Canal Flats", type: "Village", region: "East Kootenay", population: 802},
  {name: "Chase", type: "Village", region: "Thompson-Nicola", population: 2399},
  {name: "Clinton", type: "Village", region: "Thompson-Nicola", population: 568},
  {name: "Cumberland", type: "Village", region: "Comox Valley", population: 4447},
  {name: "Daajing Giids", type: "Village", region: "North Coast", population: 964},
  {name: "Fraser Lake", type: "Village", region: "Bulkley-Nechako", population: 965},
  {name: "Fruitvale", type: "Village", region: "Kootenay Boundary", population: 1958},
  {name: "Gold River", type: "Village", region: "Strathcona", population: 1246},
  {name: "Granisle", type: "Village", region: "Bulkley-Nechako", population: 337},
  {name: "Harrison Hot Springs", type: "Village", region: "Fraser Valley", population: 1905},
  {name: "Hazelton", type: "Village", region: "Kitimat-Stikine", population: 257},
  {name: "Kaslo", type: "Village", region: "Central Kootenay", population: 1049},
  {name: "Keremeos", type: "Village", region: "Okanagan-Similkameen", population: 1608},
  {name: "Lions Bay", type: "Village", region: "Metro Vancouver", population: 1390},
  {name: "Lumby", type: "Village", region: "North Okanagan", population: 2063},
  {name: "Lytton", type: "Village", region: "Thompson-Nicola", population: 210},
  {name: "Masset", type: "Village", region: "North Coast", population: 838},
  {name: "McBride", type: "Village", region: "Fraser-Fort George", population: 588},
  {name: "Midway", type: "Village", region: "Kootenay Boundary", population: 651},
  {name: "Montrose", type: "Village", region: "Kootenay Boundary", population: 1013},
  {name: "Nakusp", type: "Village", region: "Central Kootenay", population: 1589},
  {name: "New Denver", type: "Village", region: "Central Kootenay", population: 487},
  {name: "Pemberton", type: "Village", region: "Squamish-Lillooet", population: 3407},
  {name: "Port Alice", type: "Village", region: "Mount Waddington", population: 739},
  {name: "Port Clements", type: "Village", region: "North Coast", population: 340},
  {name: "Pouce Coupe", type: "Village", region: "Peace River", population: 762},
  {name: "Radium Hot Springs", type: "Village", region: "East Kootenay", population: 1339},
  {name: "Salmo", type: "Village", region: "Central Kootenay", population: 1140},
  {name: "Sayward", type: "Village", region: "Strathcona", population: 334},
  {name: "Silverton", type: "Village", region: "Central Kootenay", population: 181},
  {name: "Slocan", type: "Village", region: "Central Kootenay", population: 379},
  {name: "Tahsis", type: "Village", region: "Strathcona", population: 393},
  {name: "Telkwa", type: "Village", region: "Bulkley-Nechako", population: 1474},
  {name: "Valemount", type: "Village", region: "Fraser-Fort George", population: 1052},
  {name: "Warfield", type: "Village", region: "Kootenay Boundary", population: 1753}
];

async function main() {
  console.log(`\n📥 Adding ${bcMunicipalities.length} British Columbia municipalities...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const muni of bcMunicipalities) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', muni.name)
      .eq('province', 'British Columbia')
      .single();

    if (existing) {
      console.log(`   ⏭️  Skipped (exists): ${muni.name}`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('municipalities')
      .insert({
        name: muni.name,
        province: 'British Columbia',
        country: 'Canada',
        municipality_type: muni.type,
        population: muni.population,
        scan_status: 'no_minutes'
      });

    if (!error) {
      console.log(`   ✅ Inserted: ${muni.name}`);
      inserted++;
    } else {
      console.error(`   ❌ Error: ${muni.name} - ${error.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📋 Total: ${bcMunicipalities.length}`);
}

main().catch(console.error);
