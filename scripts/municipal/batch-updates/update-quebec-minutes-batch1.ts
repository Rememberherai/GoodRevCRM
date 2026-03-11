#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  {name: "Côte-Saint-Luc", url: "https://cotesaintluc.org/city-government/council-meetings/"},
  {name: "Pointe-Claire", url: "https://www.pointe-claire.ca/democratie-et-participation-citoyenne/avis-publics-et-proces-verbaux"},
  {name: "Sorel-Tracy", url: "https://www.ville.sorel-tracy.qc.ca/ville/vos-elus/proces-verbaux"},
  {name: "Saint-Georges", url: "https://www.saint-georges.ca/ville/vie-democratique/seances-du-conseil"},
  {name: "Val-d'Or", url: "https://www.ville.valdor.qc.ca/la-ville/democratie/seances-et-proces-verbaux"},
  {name: "Saint-Constant", url: "https://saint-constant.ca/fr/seances-du-conseil-et-documents-publics"},
  {name: "Chambly", url: "https://chambly.ca/ville/vie-democratique/assemblees-du-conseil"},
  {name: "Sainte-Julie", url: "https://www.ville.sainte-julie.qc.ca/administration/seances-publiques"},
  {name: "Alma", url: "https://www.ville.alma.qc.ca/seances-du-conseil-municipal/"},
  {name: "Magog", url: "https://www.ville.magog.qc.ca/category/proces-verbaux/"},
  {name: "Boisbriand", url: "https://www.ville.boisbriand.qc.ca/conseil/proces-verbaux"},
  {name: "Sainte-Thérèse", url: "https://www.sainte-therese.ca/ville/democratie/seances-du-conseil"},
  {name: "La Prairie", url: "https://www.ville.laprairie.qc.ca/ville/democratie/seances-du-conseil/"},
  {name: "Thetford Mines", url: "https://www.villethetford.ca/vie-municipale/seances-publiques/"},
  {name: "Saint-Bruno-de-Montarville", url: "https://www.ville.saint-bruno.qc.ca/vie-municipale/seance-du-conseil/"},
  {name: "Saint-Lin--Laurentides", url: "https://www.saint-lin-laurentides.com/decouvrir/votre-conseil/seances-du-conseil-et-proces-verbaux"},
  {name: "Beloeil", url: "https://beloeil.ca/interagir/conseil-municipal/seances-du-conseil/"},
  {name: "L'Assomption", url: "https://www.ville.lassomption.qc.ca/seances-conseil/"},
  {name: "Candiac", url: "https://candiac.ca/la-ville/vie-democratique/seances-publiques"},
  {name: "Sept-Îles", url: "https://www.septiles.ca/fr/seances-publiques_97/"},
  {name: "Saint-Lambert", url: "https://www.saint-lambert.ca/fr/seances-du-conseil"},
  {name: "Saint-Lazare", url: "https://ville.saint-lazare.qc.ca/seances/"},
  {name: "Mont-Royal", url: "https://www.ville.mont-royal.qc.ca/storage/app/media/ma-ville/vie-democratique/proces-verbaux/"},
  {name: "Joliette", url: "https://www.joliette.ca/la-ville/democratie/seances-ordres-du-jour-et-proces-verbaux"},
  {name: "Sainte-Marthe-sur-le-Lac", url: "https://vsmsll.ca/ville/vie-democratique/seances-du-conseil"},
  {name: "Varennes", url: "https://www.ville.varennes.qc.ca/la-ville/vie-democratique/seances-et-proces-verbaux"},
  {name: "Dorval", url: "https://www.ville.dorval.qc.ca/fr/la-cite/page/seances-du-conseil-municipal"},
  {name: "Saint-Augustin-de-Desmaures", url: "https://vsad.ca/seances"},
  {name: "Rivière-du-Loup", url: "https://villerdl.ca/fr/ville/vie-democratique/seances-du-conseil-24"},
  {name: "Baie-Comeau", url: "https://www.ville.baie-comeau.qc.ca/ville/vie-democratique/seances-du-conseil-municipal/"},
  {name: "Westmount", url: "https://westmount.org/seances-du-conseil-2/"},
  {name: "Kirkland", url: "https://www.ville.kirkland.qc.ca/municipal-profile/municipal-council/council-meetings"},
  {name: "Mont-Saint-Hilaire", url: "https://www.villemsh.ca/ville/conseil-municipal/seances-du-conseil/"},
  {name: "Sainte-Sophie", url: "https://www.stesophie.ca/Conseil-municipal"},
  {name: "Beaconsfield", url: "https://www.beaconsfield.ca/storage/app/media/ma-ville/votre-conseil/seances-du-conseil-et-proces-verbaux/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batch 1)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 35/1000 Quebec municipalities (3.5%)`);
}
main().catch(console.error);
