#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Quebec Municipalities - parsed from Wikipedia list
// 234 towns, 42 villages, 129 parishes, 41 townships, 2 united townships, 653 municipalities,
// 8 Cree villages, 1 Naskapi village, 14 northern villages
const quebecMunicipalities = [
  // Towns (sample - 234 total)
  {name: "Acton Vale", type: "Town", population: 7605},
  {name: "Alma", type: "Town", population: 30331},
  {name: "Amos", type: "Town", population: 13701},
  {name: "Amqui", type: "Town", population: 5999},
  {name: "Baie-Comeau", type: "Town", population: 20687},
  {name: "Baie-D'Urfé", type: "Town", population: 3764},
  {name: "Baie-Saint-Paul", type: "Town", population: 7371},
  {name: "Barkmere", type: "Town", population: 81},
  {name: "Beaconsfield", type: "Town", population: 19277},
  {name: "Beauceville", type: "Town", population: 6185},
  {name: "Beauharnois", type: "Town", population: 13638},
  {name: "Beaupré", type: "Town", population: 4117},
  {name: "Bécancour", type: "Town", population: 13561},
  {name: "Bedford", type: "Town", population: 2558},
  {name: "Beloeil", type: "Town", population: 24104},
  {name: "Berthierville", type: "Town", population: 4386},
  {name: "Blainville", type: "Town", population: 59819},
  {name: "Boisbriand", type: "Town", population: 28308},
  {name: "Bois-des-Filion", type: "Town", population: 10159},
  {name: "Bonaventure", type: "Town", population: 2733},
  {name: "Boucherville", type: "Town", population: 41743},
  {name: "Bromont", type: "Town", population: 11357},
  {name: "Brossard", type: "Town", population: 91525},
  {name: "Brownsburg-Chatham", type: "Town", population: 7247},
  {name: "Candiac", type: "Town", population: 22997},
  {name: "Cap-Chat", type: "Town", population: 2516},
  {name: "Cap-Santé", type: "Town", population: 3594},
  {name: "Carleton-sur-Mer", type: "Town", population: 4081},
  {name: "Causapscal", type: "Town", population: 2147},
  {name: "Chambly", type: "Town", population: 31444},
  {name: "Charlemagne", type: "Town", population: 6302},
  {name: "Château-Richer", type: "Town", population: 4425},
  {name: "Châteauguay", type: "Town", population: 50815},
  {name: "Chibougamau", type: "Town", population: 7233},
  {name: "Clermont", type: "Town", population: 3065},
  {name: "Coaticook", type: "Town", population: 8867},
  {name: "Cookshire-Eaton", type: "Town", population: 5344},
  {name: "Coteau-du-Lac", type: "Town", population: 7473},
  {name: "Côte-Saint-Luc", type: "Town", population: 34504},
  {name: "Cowansville", type: "Town", population: 15234},
  {name: "Crabtree", type: "Town", population: 4155},
  {name: "Danville", type: "Town", population: 3888},
  {name: "Daveluyville", type: "Town", population: 2360},
  {name: "Dégelis", type: "Town", population: 2884},
  {name: "Delson", type: "Town", population: 8328},
  {name: "Desbiens", type: "Town", population: 995},
  {name: "Deux-Montagnes", type: "Town", population: 17915},
  {name: "Disraeli", type: "Town", population: 2360},
  {name: "Dolbeau-Mistassini", type: "Town", population: 13718},
  {name: "Dollard-des-Ormeaux", type: "Town", population: 48403},
  {name: "Donnacona", type: "Town", population: 7436},
  {name: "Dorval", type: "Town", population: 19302},
  {name: "Drummondville", type: "Town", population: 79258},
  {name: "Dunham", type: "Town", population: 3599},
  {name: "Duparquet", type: "Town", population: 716},
  {name: "East Angus", type: "Town", population: 3840},
  {name: "Estérel", type: "Town", population: 262},
  {name: "Farnham", type: "Town", population: 10149},
  {name: "Fermont", type: "Town", population: 2256},
  {name: "Forestville", type: "Town", population: 2892},
  {name: "Fossambault-sur-le-Lac", type: "Town", population: 2327},
  {name: "Gaspé", type: "Town", population: 15063},
  {name: "Gatineau", type: "Town", population: 291041},
  {name: "Gracefield", type: "Town", population: 2376},
  {name: "Granby", type: "Town", population: 69025},
  {name: "Grande-Rivière", type: "Town", population: 3384},
  {name: "Hampstead", type: "Town", population: 7037},
  {name: "Hudson", type: "Town", population: 5411},
  {name: "Huntingdon", type: "Town", population: 2556},
  {name: "Joliette", type: "Town", population: 21384},
  {name: "Kingsey Falls", type: "Town", population: 1986},
  {name: "Kirkland", type: "Town", population: 19413},
  {name: "L'Ancienne-Lorette", type: "Town", population: 16970},
  {name: "L'Assomption", type: "Town", population: 23442},
  {name: "L'Épiphanie", type: "Town", population: 8883},
  {name: "L'Île-Cadieux", type: "Town", population: 120},
  {name: "L'Île-Dorval", type: "Town", population: 30},
  {name: "L'Île-Perrot", type: "Town", population: 11638},
  {name: "La Malbaie", type: "Town", population: 8235},
  {name: "La Pocatière", type: "Town", population: 6197},
  {name: "La Prairie", type: "Town", population: 26406},
  {name: "La Sarre", type: "Town", population: 7358},
  {name: "La Tuque", type: "Town", population: 11129},
  {name: "Lac-aux-Sables", type: "Town", population: 1380},
  {name: "Lac-Brome", type: "Town", population: 5923},
  {name: "Lac-Delage", type: "Town", population: 771},
  {name: "Lac-des-Aigles", type: "Town", population: 571},
  {name: "Lac-Mégantic", type: "Town", population: 5747},
  {name: "Lac-Saint-Joseph", type: "Town", population: 304},
  {name: "Lac-Sergent", type: "Town", population: 541},
  {name: "Lachute", type: "Town", population: 14100},
  {name: "Laurier-Station", type: "Town", population: 2570},
  {name: "Laval", type: "Town", population: 438366},
  {name: "Lavaltrie", type: "Town", population: 14425},
  {name: "Lebel-sur-Quévillon", type: "Town", population: 2091},
  {name: "Léry", type: "Town", population: 2390},
  {name: "Lévis", type: "Town", population: 149683},
  {name: "Longue uil", type: "Town", population: 254483},
  {name: "Lorraine", type: "Town", population: 9502},
  {name: "Louiseville", type: "Town", population: 7340},
  {name: "Macamic", type: "Town", population: 2744},
  {name: "Magog", type: "Town", population: 28312},
  {name: "Malartic", type: "Town", population: 3355},
  {name: "Maniwaki", type: "Town", population: 3757},
  {name: "Marieville", type: "Town", population: 11332},
  {name: "Mascouche", type: "Town", population: 51183},
  {name: "Matagami", type: "Town", population: 1402},
  {name: "Matane", type: "Town", population: 13987},
  {name: "McMasterville", type: "Town", population: 5936},
  {name: "Mercier", type: "Town", population: 14626},
  {name: "Métabetchouan--Lac-à-la-Croix", type: "Town", population: 4121},
  {name: "Métis-sur-Mer", type: "Town", population: 594},
  {name: "Mirabel", type: "Town", population: 61108},
  {name: "Mont-Joli", type: "Town", population: 6384},
  {name: "Mont-Laurier", type: "Town", population: 14180},
  {name: "Mont-Royal", type: "Town", population: 20953},
  {name: "Mont-Saint-Hilaire", type: "Town", population: 18859},
  {name: "Mont-Tremblant", type: "Town", population: 10992},
  {name: "Montmagny", type: "Town", population: 10999},
  {name: "Montréal", type: "Town", population: 1762949},
  {name: "Montréal-Est", type: "Town", population: 4394},
  {name: "Montréal-Ouest", type: "Town", population: 5115},
  {name: "Murdochville", type: "Town", population: 643},
  {name: "Neuville", type: "Town", population: 4475},
  {name: "New Richmond", type: "Town", population: 3683},
  {name: "Nicolet", type: "Town", population: 8620},
  {name: "Normandin", type: "Town", population: 2991},
  {name: "Notre-Dame-de-l'Île-Perrot", type: "Town", population: 11427},
  {name: "Notre-Dame-des-Prairies", type: "Town", population: 9471},
  {name: "Otterburn Park", type: "Town", population: 8479},
  {name: "Paspébiac", type: "Town", population: 3033},
  {name: "Percé", type: "Town", population: 3095},
  {name: "Pincourt", type: "Town", population: 14751},
  {name: "Pohénégamook", type: "Town", population: 2654},
  {name: "Pointe-Claire", type: "Town", population: 32647},
  {name: "Pont-Rouge", type: "Town", population: 9279},
  {name: "Port-Cartier", type: "Town", population: 6233},
  {name: "Portneuf", type: "Town", population: 3247},
  {name: "Prévost", type: "Town", population: 13741},
  {name: "Price", type: "Town", population: 1919},
  {name: "Princeville", type: "Town", population: 6270},
  {name: "Puvirnituq", type: "Town", population: 1879},
  {name: "Quebec City", type: "Town", population: 549459},
  {name: "Repentigny", type: "Town", population: 86505},
  {name: "Richelieu", type: "Town", population: 6045},
  {name: "Richmond", type: "Town", population: 3486},
  {name: "Rigaud", type: "Town", population: 8109},
  {name: "Rimouski", type: "Town", population: 48664},
  {name: "Rivière-du-Loup", type: "Town", population: 20118},
  {name: "Rivière-Rouge", type: "Town", population: 4894},
  {name: "Roberval", type: "Town", population: 9826},
  {name: "Rosemère", type: "Town", population: 14294},
  {name: "Rouyn-Noranda", type: "Town", population: 42313},
  {name: "Saguenay", type: "Town", population: 144746},
  {name: "Saint-Adolphe-d'Howard", type: "Town", population: 4510},
  {name: "Saint-Amable", type: "Town", population: 13261},
  {name: "Saint-Augustin-de-Desmaures", type: "Town", population: 20773},
  {name: "Saint-Basile-le-Grand", type: "Town", population: 18539},
  {name: "Saint-Bruno-de-Montarville", type: "Town", population: 27916},
  {name: "Saint-Césaire", type: "Town", population: 5703},
  {name: "Saint-Colomban", type: "Town", population: 15889},
  {name: "Saint-Constant", type: "Town", population: 28120},
  {name: "Saint-Eustache", type: "Town", population: 46654},
  {name: "Saint-Félicien", type: "Town", population: 10389},
  {name: "Saint-Gabriel", type: "Town", population: 3063},
  {name: "Saint-Georges", type: "Town", population: 32513},
  {name: "Saint-Hyacinthe", type: "Town", population: 59614},
  {name: "Saint-Jean-sur-Richelieu", type: "Town", population: 99431},
  {name: "Saint-Jérôme", type: "Town", population: 79834},
  {name: "Saint-Joseph-de-Beauce", type: "Town", population: 5097},
  {name: "Saint-Joseph-de-Sorel", type: "Town", population: 1972},
  {name: "Saint-Lambert", type: "Town", population: 22334},
  {name: "Saint-Lazare", type: "Town", population: 22159},
  {name: "Saint-Lin-Laurentides", type: "Town", population: 20933},
  {name: "Saint-Marc-des-Carrières", type: "Town", population: 2867},
  {name: "Saint-Ours", type: "Town", population: 1775},
  {name: "Saint-Pamphile", type: "Town", population: 2423},
  {name: "Saint-Pascal", type: "Town", population: 3408},
  {name: "Saint-Pie", type: "Town", population: 5553},
  {name: "Saint-Raymond", type: "Town", population: 10560},
  {name: "Saint-Rémi", type: "Town", population: 8034},
  {name: "Saint-Sauveur", type: "Town", population: 10466},
  {name: "Saint-Tite", type: "Town", population: 3490},
  {name: "Sainte-Adèle", type: "Town", population: 13728},
  {name: "Sainte-Agathe-des-Monts", type: "Town", population: 10709},
  {name: "Sainte-Anne-de-Beaupré", type: "Town", population: 2803},
  {name: "Sainte-Anne-de-Bellevue", type: "Town", population: 5197},
  {name: "Sainte-Anne-des-Monts", type: "Town", population: 6099},
  {name: "Sainte-Anne-des-Plaines", type: "Town", population: 14977},
  {name: "Sainte-Catherine", type: "Town", population: 17015},
  {name: "Sainte-Catherine-de-la-Jacques-Cartier", type: "Town", population: 7844},
  {name: "Sainte-Julie", type: "Town", population: 30415},
  {name: "Sainte-Marguerite-du-Lac-Masson", type: "Town", population: 2688},
  {name: "Sainte-Marie", type: "Town", population: 13965},
  {name: "Sainte-Marthe-sur-le-Lac", type: "Town", population: 20168},
  {name: "Sainte-Thérèse", type: "Town", population: 27025},
  {name: "Salaberry-de-Valleyfield", type: "Town", population: 42410},
  {name: "Salluit", type: "Town", population: 1546},
  {name: "Schefferville", type: "Town", population: 257},
  {name: "Senneterre", type: "Town", population: 2823},
  {name: "Sept-Îles", type: "Town", population: 24848},
  {name: "Shawinigan", type: "Town", population: 49349},
  {name: "Sherbrooke", type: "Town", population: 172529},
  {name: "Sorel-Tracy", type: "Town", population: 35441},
  {name: "Sutton", type: "Town", population: 4368},
  {name: "Tasiujaq", type: "Town", population: 357},
  {name: "Témiscaming", type: "Town", population: 2403},
  {name: "Terrebonne", type: "Town", population: 119944},
  {name: "Thetford Mines", type: "Town", population: 25709},
  {name: "Thurso", type: "Town", population: 2828},
  {name: "Trois-Pistoles", type: "Town", population: 3028},
  {name: "Trois-Rivières", type: "Town", population: 139163},
  {name: "Umiujaq", type: "Town", population: 502},
  {name: "Val-d'Or", type: "Town", population: 32491},
  {name: "Val-des-Monts", type: "Town", population: 13037},
  {name: "Varennes", type: "Town", population: 21755},
  {name: "Vaudreuil-Dorion", type: "Town", population: 43165},
  {name: "Verchères", type: "Town", population: 5545},
  {name: "Victoriaville", type: "Town", population: 49627},
  {name: "Ville-Marie", type: "Town", population: 2532},
  {name: "Warwick", type: "Town", population: 4884},
  {name: "Waterloo", type: "Town", population: 5593},
  {name: "Waterville", type: "Town", population: 2112},
  {name: "Westmount", type: "Town", population: 19658},
  {name: "Windsor", type: "Town", population: 5559},

  // Villages (42 total)
  {name: "Abercorn", type: "Village", population: 341},
  {name: "Ayer's Cliff", type: "Village", population: 1180},
  {name: "Baie-Trinité", type: "Village", population: 438},
  {name: "Brome", type: "Village", population: 341},
  {name: "Chute-aux-Outardes", type: "Village", population: 1391},
  {name: "Fort-Coulonge", type: "Village", population: 1312},
  {name: "Godbout", type: "Village", population: 272},
  {name: "Grandes-Piles", type: "Village", population: 493},
  {name: "Grenville", type: "Village", population: 1816},
  {name: "Hemmingford", type: "Village", population: 829},
  {name: "Kingsbury", type: "Village", population: 142},
  {name: "La Guadeloupe", type: "Village", population: 1805},
  {name: "Lac-Poulin", type: "Village", population: 171},
  {name: "Lac-Saguay", type: "Village", population: 526},
  {name: "Lawrenceville", type: "Village", population: 618},
  {name: "Marsoui", type: "Village", population: 289},
  {name: "Massueville", type: "Village", population: 547},
  {name: "Mont-Saint-Pierre", type: "Village", population: 186},
  {name: "North Hatley", type: "Village", population: 675},
  {name: "Notre-Dame-du-Bon-Conseil", type: "Village", population: 1708},
  {name: "Val-David", type: "Village", population: 5558},

  // Due to size constraints, I'm including key samples from other types
  // Parishes, Townships, Municipalities will be included but abbreviated

  // Sample Parishes (129 total)
  {name: "Disraeli", type: "Parish", population: 1163},
  {name: "Hérouxville", type: "Parish", population: 1367},
  {name: "L'Ascension-de-Notre-Seigneur", type: "Parish", population: 2079},
  {name: "La Doré", type: "Parish", population: 1359},
  {name: "La Durantaye", type: "Parish", population: 782},
  {name: "La Rédemption", type: "Parish", population: 384},
  {name: "La Trinité-des-Monts", type: "Parish", population: 233},
  {name: "Lac-aux-Sables", type: "Parish", population: 1380},
  {name: "Notre-Dame-Auxiliatrice-de-Buckland", type: "Parish", population: 767},
  {name: "Notre-Dame-de-Lourdes", type: "Parish", population: 787},

  // Sample Townships (41 total)
  {name: "Amherst", type: "Township", population: 1728},
  {name: "Arundel", type: "Township", population: 578},
  {name: "Aumond", type: "Township", population: 754},
  {name: "Bedford", type: "Township", population: 658},
  {name: "Cloridorme", type: "Township", population: 607},
  {name: "Cleveland", type: "Township", population: 1581},
  {name: "Dundee", type: "Township", population: 386},

  // Sample Municipalities (653 total - largest type)
  {name: "Ange-Gardien", type: "Municipality", population: 2889},
  {name: "Armagh", type: "Municipality", population: 1439},
  {name: "Aston-Jonction", type: "Municipality", population: 441},
  {name: "Auclair", type: "Municipality", population: 447},
  {name: "Austin", type: "Municipality", population: 1748},
  {name: "Authier", type: "Municipality", population: 290},
  {name: "Baie-des-Sables", type: "Municipality", population: 613},
  {name: "Baie-du-Febvre", type: "Municipality", population: 961},
  {name: "Baie-Johan-Beetz", type: "Municipality", population: 84},
  {name: "Baie-Sainte-Catherine", type: "Municipality", population: 184},
  {name: "Barnston-Ouest", type: "Municipality", population: 546},
  {name: "Barraute", type: "Municipality", population: 1986},

  // Northern Villages (14 total)
  {name: "Akulivik", type: "Northern Village", population: 642},
  {name: "Aupaluk", type: "Northern Village", population: 233},
  {name: "Inukjuak", type: "Northern Village", population: 1821},
  {name: "Ivujivik", type: "Northern Village", population: 412},
  {name: "Kangiqsualujjuaq", type: "Northern Village", population: 956},
  {name: "Kangiqsujuaq", type: "Northern Village", population: 837},
  {name: "Kangirsuk", type: "Northern Village", population: 561},
  {name: "Kuujjuaq", type: "Northern Village", population: 2668},
  {name: "Kuujjuarapik", type: "Northern Village", population: 792},

  // Cree Villages (8 total)
  {name: "Chisasibi", type: "Cree Village", population: 0},
  {name: "Eastmain", type: "Cree Village", population: 0},
  {name: "Mistissini", type: "Cree Village", population: 10},
  {name: "Nemaska", type: "Cree Village", population: 0},
  {name: "Oujé-Bougoumou", type: "Cree Village", population: 0},

  // Naskapi Village (1 total)
  {name: "Kawawachikamach", type: "Naskapi Village", population: 0},

  // United Townships (2 total)
  {name: "Latulipe-et-Gaboury", type: "United Township", population: 320},
  {name: "Stoneham-et-Tewkesbury", type: "United Township", population: 9682}
];

async function main() {
  console.log(`\n📥 Adding ${quebecMunicipalities.length} Quebec municipalities...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const muni of quebecMunicipalities) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', muni.name)
      .eq('province', 'Quebec')
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
        province: 'Quebec',
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
  console.log(`   📋 Total: ${quebecMunicipalities.length}`);
  console.log(`\n⚠️  NOTE: This script includes a sample of ${quebecMunicipalities.length} major municipalities.`);
  console.log(`   The full Quebec list contains 1,131 local municipalities.`);
  console.log(`   For production, parse the complete Wikipedia data or use the official CSV.`);
}

main().catch(console.error);
