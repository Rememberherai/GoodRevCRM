#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Alberta Municipalities - parsed from Wikipedia list
const albertaMunicipalities = [
  // Cities
  {name: "Airdrie", type: "City", population: 74100},
  {name: "Beaumont", type: "City", population: 20888},
  {name: "Brooks", type: "City", population: 14924},
  {name: "Calgary", type: "City", population: 1306784},
  {name: "Camrose", type: "City", population: 18772},
  {name: "Chestermere", type: "City", population: 22163},
  {name: "Cold Lake", type: "City", population: 15661},
  {name: "Edmonton", type: "City", population: 1010899},
  {name: "Fort Saskatchewan", type: "City", population: 27088},
  {name: "Grande Prairie", type: "City", population: 64141},
  {name: "Lacombe", type: "City", population: 13396},
  {name: "Leduc", type: "City", population: 34094},
  {name: "Lethbridge", type: "City", population: 98406},
  {name: "Lloydminster", type: "City", population: 19739},
  {name: "Medicine Hat", type: "City", population: 63271},
  {name: "Red Deer", type: "City", population: 100844},
  {name: "Spruce Grove", type: "City", population: 37645},
  {name: "St. Albert", type: "City", population: 68232},
  {name: "Wetaskiwin", type: "City", population: 12594},

  // Towns (selecting major towns - there are 107 total)
  {name: "Athabasca", type: "Town", population: 2759},
  {name: "Banff", type: "Town", population: 8305},
  {name: "Barrhead", type: "Town", population: 4320},
  {name: "Bashaw", type: "Town", population: 848},
  {name: "Bassano", type: "Town", population: 1216},
  {name: "Bentley", type: "Town", population: 1042},
  {name: "Blackfalds", type: "Town", population: 10470},
  {name: "Bon Accord", type: "Town", population: 1461},
  {name: "Bonnyville", type: "Town", population: 6404},
  {name: "Bow Island", type: "Town", population: 2036},
  {name: "Bowden", type: "Town", population: 1280},
  {name: "Bruderheim", type: "Town", population: 1329},
  {name: "Calmar", type: "Town", population: 2183},
  {name: "Canmore", type: "Town", population: 15990},
  {name: "Cardston", type: "Town", population: 3724},
  {name: "Carstairs", type: "Town", population: 4898},
  {name: "Castor", type: "Town", population: 803},
  {name: "Claresholm", type: "Town", population: 3804},
  {name: "Coaldale", type: "Town", population: 8771},
  {name: "Coalhurst", type: "Town", population: 2869},
  {name: "Cochrane", type: "Town", population: 32199},
  {name: "Coronation", type: "Town", population: 868},
  {name: "Crossfield", type: "Town", population: 3599},
  {name: "Daysland", type: "Town", population: 789},
  {name: "Devon", type: "Town", population: 6545},
  {name: "Diamond Valley", type: "Town", population: 5341},
  {name: "Didsbury", type: "Town", population: 5070},
  {name: "Drayton Valley", type: "Town", population: 7291},
  {name: "Drumheller", type: "Town", population: 7909},
  {name: "Eckville", type: "Town", population: 1014},
  {name: "Edson", type: "Town", population: 8374},
  {name: "Elk Point", type: "Town", population: 1399},
  {name: "Fairview", type: "Town", population: 2817},
  {name: "Falher", type: "Town", population: 1001},
  {name: "Fort Macleod", type: "Town", population: 3297},
  {name: "Fox Creek", type: "Town", population: 1639},
  {name: "Gibbons", type: "Town", population: 3218},
  {name: "Grimshaw", type: "Town", population: 2601},
  {name: "Hanna", type: "Town", population: 2394},
  {name: "Hardisty", type: "Town", population: 548},
  {name: "High Level", type: "Town", population: 3922},
  {name: "High Prairie", type: "Town", population: 2380},
  {name: "High River", type: "Town", population: 14324},
  {name: "Hinton", type: "Town", population: 9817},
  {name: "Innisfail", type: "Town", population: 7985},
  {name: "Irricana", type: "Town", population: 1179},
  {name: "Killam", type: "Town", population: 918},
  {name: "Lamont", type: "Town", population: 1744},
  {name: "Legal", type: "Town", population: 1232},
  {name: "Magrath", type: "Town", population: 2481},
  {name: "Manning", type: "Town", population: 1126},
  {name: "Mayerthorpe", type: "Town", population: 1259},
  {name: "McLennan", type: "Town", population: 695},
  {name: "Milk River", type: "Town", population: 824},
  {name: "Millet", type: "Town", population: 1890},
  {name: "Morinville", type: "Town", population: 10385},
  {name: "Mundare", type: "Town", population: 689},
  {name: "Nanton", type: "Town", population: 2167},
  {name: "Nobleford", type: "Town", population: 1438},
  {name: "Okotoks", type: "Town", population: 30405},
  {name: "Olds", type: "Town", population: 9209},
  {name: "Onoway", type: "Town", population: 966},
  {name: "Oyen", type: "Town", population: 917},
  {name: "Peace River", type: "Town", population: 6619},
  {name: "Penhold", type: "Town", population: 3484},
  {name: "Picture Butte", type: "Town", population: 1930},
  {name: "Pincher Creek", type: "Town", population: 3622},
  {name: "Ponoka", type: "Town", population: 7331},
  {name: "Provost", type: "Town", population: 1900},
  {name: "Rainbow Lake", type: "Town", population: 495},
  {name: "Raymond", type: "Town", population: 4199},
  {name: "Redcliff", type: "Town", population: 5581},
  {name: "Redwater", type: "Town", population: 2115},
  {name: "Rimbey", type: "Town", population: 2470},
  {name: "Rocky Mountain House", type: "Town", population: 6765},
  {name: "Sedgewick", type: "Town", population: 761},
  {name: "Sexsmith", type: "Town", population: 2427},
  {name: "Slave Lake", type: "Town", population: 6836},
  {name: "Smoky Lake", type: "Town", population: 1127},
  {name: "Spirit River", type: "Town", population: 849},
  {name: "St. Paul", type: "Town", population: 5863},
  {name: "Stavely", type: "Town", population: 544},
  {name: "Stettler", type: "Town", population: 5695},
  {name: "Stony Plain", type: "Town", population: 17993},
  {name: "Strathmore", type: "Town", population: 14339},
  {name: "Sundre", type: "Town", population: 2672},
  {name: "Swan Hills", type: "Town", population: 1201},
  {name: "Sylvan Lake", type: "Town", population: 15995},
  {name: "Taber", type: "Town", population: 8862},
  {name: "Thorsby", type: "Town", population: 967},
  {name: "Three Hills", type: "Town", population: 3042},
  {name: "Tofield", type: "Town", population: 2045},
  {name: "Trochu", type: "Town", population: 998},
  {name: "Two Hills", type: "Town", population: 1416},
  {name: "Valleyview", type: "Town", population: 1673},
  {name: "Vauxhall", type: "Town", population: 1286},
  {name: "Vegreville", type: "Town", population: 5689},
  {name: "Vermilion", type: "Town", population: 3948},
  {name: "Viking", type: "Town", population: 986},
  {name: "Vulcan", type: "Town", population: 1769},
  {name: "Wainwright", type: "Town", population: 6606},
  {name: "Wembley", type: "Town", population: 1432},
  {name: "Westlock", type: "Town", population: 4921},
  {name: "Whitecourt", type: "Town", population: 9927}
];

async function main() {
  console.log(`\n📥 Adding ${albertaMunicipalities.length} Alberta municipalities...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const muni of albertaMunicipalities) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', muni.name)
      .eq('province', 'Alberta')
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
        province: 'Alberta',
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
  console.log(`   📋 Total: ${albertaMunicipalities.length}`);
}

main().catch(console.error);
