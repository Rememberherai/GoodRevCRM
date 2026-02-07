#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 7
  {name: "Sainte-Anne-de-Sorel", url: "https://msads.ca/municipalite/maire-et-conseillers/"},
  {name: "Saint-Ambroise", url: "https://st-ambroise.qc.ca/organisation-municipale/conseil-municipal/"},
  {name: "Pierreville", url: "https://pierreville.net/proces-verbaux/"},
  {name: "Schefferville", url: "https://schefferville.ca/administration/ordonnances-reglements/"},
  {name: "Lebel-sur-Quévillon", url: "https://www.lsq.quebec/fr/ma-ville/conseil-municipal/proces-verbaux.html"},
  {name: "Gore", url: "https://www.cantondegore.qc.ca/fr/publications/proces-verbaux"},
  {name: "Adstock", url: "https://www.adstock.ca/vie-municipale/seances-du-conseil/"},
  {name: "Châteauguay", url: "https://ville.chateauguay.qc.ca/affaires-municipales/seances-du-conseil/"},
  {name: "Saint-Félix-de-Valois", url: "https://st-felix-de-valois.com/municipalite/vie-democratique/proces-verbaux/"},
  {name: "Sainte-Victoire-de-Sorel", url: "http://saintevictoiredesorel.qc.ca/municipalite/index.php/municipalite/conseil-municipal.html"},
  {name: "Léry", url: "https://lery.ca/la-ville/conseil-municipal"},
  {name: "Sainte-Clotilde-de-Horton", url: "https://steclotildehorton.ca/conseil-municipal/"},
  {name: "Saint-Joseph-de-Sorel", url: "https://vsjs.ca/conseil-municipal-1.php"},
  {name: "Maria", url: "https://www.mariaquebec.com/"},
  {name: "Havre-Saint-Pierre", url: "https://havresaintpierre.com/municipalite/conseil-municipal/"},
  {name: "Deschambault-Grondines", url: "https://deschambault-grondines.com/municipalite/proces-verbaux-et-donnees-financieres/"},
  {name: "Batiscan", url: "https://www.batiscan.ca/fr/municipalite/conseil-municipal/"},
  {name: "Sainte-Martine", url: "https://sainte-martine.ca/municipalite/democratie/seances-du-conseil-municipal/"},
  {name: "Disraeli", url: "https://www.villededisraeli.ca/fr/municipalite/vie-municipale/assemblees-du-conseil/"},
  {name: "Sainte-Hélène-de-Bagot", url: "https://www.saintehelenedebagot.com/fr/administration-municipale/conseil-municipal/proces-verbaux-et-videoconferences/"},
  {name: "Saint-Félix-de-Kingsey", url: "https://www.saintfelixdekingsey.ca/seances"},
  {name: "L'Avenir", url: "https://www.municipalitelavenir.qc.ca/administration/seances-et-proces-verbaux"},
  {name: "Sainte-Angèle-de-Monnoir", url: "https://www.sainte-angele-de-monnoir.ca/conseil-municipal/seances-du-conseil/"},
  {name: "Venise-en-Québec", url: "https://www.veniseenquebec.ca/"},
  {name: "Sainte-Madeleine", url: "https://www.stemadeleine.quebec/proces-verbaux.html"},
  {name: "Saint-Joseph-du-Lac", url: "https://sjdl.qc.ca/services-municipaux/vie-democratique/conseil-municipal/seances-du-conseil/"},
  {name: "Lacolle", url: "https://lacolle.com/documentation/proces-verbaux/"},
  {name: "Delson", url: "https://ville.delson.qc.ca/la-ville/vie-democratique/seances-du-conseil-et-proces-verbaux-2025/"},
  {name: "Saint-Urbain-Premier", url: "https://www.saint-urbain-premier.com/fr/municipalite/vie-democratique/conseil-municipal/"},
  {name: "Saint-Placide", url: "https://saintplacide.ca/votre-mairie/seances-du-conseil/proces-verbaux/"},
  {name: "Pointe-des-Cascades", url: "https://www.pointe-des-cascades.com/"},
  {name: "Saint-Polycarpe", url: "https://stpolycarpe.ca/proces-verbaux/"},
  {name: "Noyan", url: "https://www.ville.noyan.qc.ca/proces-verbaux-2/"},
  {name: "Saint-Chrysostome", url: "https://www.mun-sc.ca/services-aux-citoyens/greffe-et-administration/proces-verbaux/"},
  {name: "Sainte-Barbe", url: "https://www.ste-barbe.com/seances-du-conseil/"},

  // Batch 8
  {name: "Hinchinbrooke", url: "https://hinchinbrooke.com/en/council-meetings/"},
  {name: "Hemmingford", url: "https://www.villagedehemmingford.ca/en/council-and-administration/municipal-council/"},
  {name: "Howick", url: "http://villagehowick.com/"},
  {name: "Ormstown", url: "https://www.ormstown.ca/en/meetings-and-minutes-of-meetings/"},
  {name: "Très-Saint-Rédempteur", url: "https://tressaintredempteur.ca/administration-municipale/proces-verbaux-ordres-du-jour-et-avis-publics/proces-verbaux/"},
  {name: "Saint-Stanislas-de-Kostka", url: "https://st-stanislas-de-kostka.ca/municipalite/administration/seances-conseil"},
  {name: "Godmanchester", url: "https://godmanchester.ca/municipalite/proces-verbaux/"},
  {name: "Havelock", url: "https://mun-havelock.ca/"},
  {name: "Franklin", url: "https://municipalitedefranklin.ca/"},
  {name: "Saint-Anicet", url: "https://stanicet.com/en/proces-verbaux"},
  {name: "Elgin", url: "https://municipalites-du-quebec.com/elgin/"},
  {name: "Dundee", url: "https://www.cantondundee.ca/"},
  {name: "Lefebvre", url: "https://municipalites-du-quebec.ca/lefebvre/"},
  {name: "Durham-Sud", url: "https://www.durham-sud.com/"},
  {name: "Wickham", url: "https://www.wickham.ca/administration-municipale/seances-du-conseil/"},
  {name: "Saint-Germain-de-Grantham", url: "https://st-germain.info/"},
  {name: "Saint-Lucien", url: "https://www.saint-lucien.ca/"},
  {name: "Notre-Dame-du-Bon-Conseil", url: "https://villagebonconseil.ca/"},
  {name: "Sainte-Brigitte-des-Saults", url: "https://www.saintebrigittedessaults.ca/seances-du-conseil"},
  {name: "Saint-Pie-de-Guire", url: "https://www.stpiedeguire.ca/"},
  {name: "Saint-Célestin", url: "https://www.village-st-celestin.net/"},
  {name: "Yamachiche", url: "https://www.yamachiche.ca/calendrier-sceances-du-conseil/"},
  {name: "Saint-Barnabé", url: "https://saint-barnabe.ca/la-municipalite/vie-municipale/seances-du-conseil-proces-verbaux-ordres-du-jour-baladodiffusions/"},
  {name: "Saint-Étienne-des-Grès", url: "https://mun-stedg.qc.ca/calendrier-des-seances-ordinaires-et-proces-verbaux/"},
  {name: "Saint-Mathieu-du-Parc", url: "https://www.saint-mathieu-du-parc.ca/"},
  {name: "Sainte-Ursule", url: "https://www.sainte-ursule.ca/"},
  {name: "Saint-Justin", url: "https://www.saint-justin.ca/"},
  {name: "Saint-Édouard-de-Maskinongé", url: "https://municipalites-du-quebec.com/st-edouard-de-maskinonge/"},
  {name: "Saint-Alexis", url: "https://www.saint-alexis-des-monts.ca/"},
  {name: "Saint-Thomas-de-Caxton", url: "https://www.saintthomas.qc.ca/municipalite/vie-democratique/ordre-du-jour-et-enregistrement-des-seances-du-conseil"},
  {name: "Petite-Vallée", url: "https://petitevallee.ca/"},
  {name: "Cloridorme", url: "https://municipalitecloridorme.ca/administration-municipale/conseil-municipal/"},
  {name: "Murdochville", url: "https://murdochville.com/"},

  // Batch 9
  {name: "Marsoui", url: "https://municipalites-du-quebec.com/marsoui/"},
  {name: "Mont-Saint-Pierre", url: "https://municipalites-du-quebec.com/mont-st-pierre/"},
  {name: "La Martre", url: "https://www.la-martre.ca/"},
  {name: "Cap-Chat", url: "https://ville.cap-chat.ca/"},
  {name: "Sainte-Maxime-du-Mont-Louis", url: "https://st-maxime.qc.ca/"},
  {name: "Rivière-à-Claude", url: "https://municipalites-du-quebec.com/riviere-a-claude/"},
  {name: "Sainte-Madeleine-de-la-Rivière-Madeleine", url: "https://stemadeleine.ca/"},
  {name: "Saint-Vianney", url: "https://www.saint-vianney.net/"},
  {name: "Sayabec", url: "https://municipalitesayabec.com/mairie/seances-budgets-proces-verbaux.html"},
  {name: "Les Méchins", url: "https://lesmechins.com/"},
  {name: "Grosses-Roches", url: "https://municipalite.grossesroches.ca/"},
  {name: "Saint-René-de-Matane", url: "https://st-rene-matane.qc.ca/"},
  {name: "Saint-Léandre", url: "https://www.st-leandre.ca/"},
  {name: "Saint-Jean-de-Cherbourg", url: "https://www.st-jeandecherbourg.ca/conseil-municipal.html"},
  {name: "Sainte-Jeanne-d'Arc", url: "https://www.municipalite.sainte-jeanne-darc.qc.ca/"},
  {name: "Sainte-Félicité", url: "https://ste-felicite.ca/"},
  {name: "Les Hauteurs", url: "https://municipalites-du-quebec.com/les-hauteurs/"},
  {name: "Padoue", url: "https://www.municipalite.padoue.qc.ca/"},
  {name: "Sainte-Angèle-de-Mérici", url: "https://municipalitesam.ca/"},
  {name: "Saint-Médard", url: "https://municipalites-du-quebec.ca/st-medard/"},
  {name: "Saint-Elzéar", url: "https://saintelzear.ca/"},
  {name: "Sainte-Irène", url: "https://sainteirene.com/conseil-municipal.html"},
  {name: "Sainte-Rita", url: "https://municipalites-du-quebec.ca/ste-rita/"},
  {name: "Saint-Gabriel-de-Rimouski", url: "https://www.municipalite.saint-gabriel-de-rimouski.qc.ca/"},
  {name: "Saint-Narcisse-de-Rimouski", url: "https://saintnarcisse.net/municipalite/conseil-municipal.html"},
  {name: "Saint-Valérien", url: "https://municipalite.saint-valerien.qc.ca/"},
  {name: "Saint-Anaclet-de-Lessard", url: "https://stanaclet.qc.ca/"},
  {name: "Sainte-Blandine", url: "https://rimouski.ca/ville/democratie/proces-verbaux"},
  {name: "Rimouski-Neigette", url: "https://www.mrcrimouskineigette.qc.ca/la-mrc/proces-verbaux/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 7-8-9)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 309/1000 Quebec municipalities (30.9%)`);
}
main().catch(console.error);
