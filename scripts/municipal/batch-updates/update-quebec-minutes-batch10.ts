#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  {name: "Lac-Simon", url: "https://www.lac-simon.ca/"},
  {name: "Compton", url: "https://www.compton.ca/"},
  {name: "Saint-Denis-de-Brompton", url: "https://www.saint-denis-de-brompton.com/"},
  {name: "Ascot Corner", url: "https://www.ascotcorner.com/"},
  {name: "Stoke", url: "https://www.stoke.ca/"},
  {name: "Waterville", url: "https://www.waterville.ca/"},
  {name: "Barnston-Ouest", url: "https://www.barnston-ouest.qc.ca/"},
  {name: "Weedon", url: "https://municipalite.weedon.qc.ca/"},
  {name: "Bury", url: "https://www.municipalitedebury.ca/"},
  {name: "Sainte-Edwidge-de-Clifton", url: "https://municipalites-du-quebec.com/ste-edwidge/"},
  {name: "East Angus", url: "https://www.ville.eastangus.qc.ca/"},
  {name: "Cookshire-Eaton", url: "https://www.cookshire-eaton.com/"},
  {name: "Scotstown", url: "https://www.scotstown.ca/"},
  {name: "Racine", url: "https://www.racine.ca/"},
  {name: "Martinville", url: "https://martinville.ca/"},
  {name: "La Patrie", url: "https://www.lapatrie.qc.ca/"},
  {name: "Westbury", url: "https://www.westbury.ca/"},
  {name: "Newport", url: "https://municipalites-du-quebec.ca/newport/"},
  {name: "Lingwick", url: "https://www.lingwick.ca/"},
  {name: "Bishopton", url: "https://www.bishopton.ca/"},
  {name: "Kingsey Falls", url: "https://www.ville.kingsey-falls.qc.ca/"},
  {name: "Warwick", url: "https://www.villedewarwick.com/"},
  {name: "Tingwick", url: "https://www.tingwick.ca/"},
  {name: "Sainte-Séraphine", url: "https://municipalites-du-quebec.ca/ste-seraphine/"},
  {name: "Chesterville", url: "https://www.chesterville.ca/"},
  {name: "Sainte-Clotilde-de-Horton", url: "https://steclotildehorton.ca/"},
  {name: "Ham-Sud", url: "https://www.ham-sud.ca/"},
  {name: "Saint-Rémi-de-Tingwick", url: "https://www.saint-remi-de-tingwick.ca/"},
  {name: "Saint-Samuel", url: "https://www.saintsamuel.ca/"},
  {name: "Princeville", url: "https://www.ville.princeville.qc.ca/"},
  {name: "Plessisville", url: "https://www.ville.plessisville.qc.ca/"},
  {name: "Lyster", url: "https://www.municipalitelyster.ca/"},
  {name: "Sainte-Sophie-de-Lévrard", url: "https://www.saintesophiedelevrard.com/"},
  {name: "Manseau", url: "https://www.manseau.ca/"},
  {name: "Actonvale", url: "https://ville.actonvale.qc.ca/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batch 10)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 344/1000 Quebec municipalities (34.4%)`);
}
main().catch(console.error);
