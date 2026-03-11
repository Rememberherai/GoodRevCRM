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
  {name: "Pohénégamook", url: "https://pohenegamook.net/proces-verbaux/"},
  {name: "Saint-Ours", url: "https://saintours.qc.ca/wp-content/uploads/2024/08/20240708-Proces-verbal-seance-ordinaire-version-web.pdf"},
  {name: "Sainte-Anne-de-Bellevue", url: "https://ville.sainte-anne-de-bellevue.qc.ca/citizens/democratic-life/council-meetings"},
  {name: "Rigaud", url: "https://www.ville.rigaud.qc.ca/services-aux-citoyens/service-administratifs/ordre-du-jour-et-proces-verbaux/"},
  {name: "Kingsey Falls", url: "https://www.kingseyfalls.ca/fr/municipalite/conseil-municipal/proces-verbaux-et-ordres-du-jour/visualiser/88/"},
  {name: "Saint-Césaire", url: "https://www.villesaintcesaire.com/ma-ville/ordres-du-jour-et-proces-verbaux/"},
  {name: "Cookshire-Eaton", url: "https://cookshire-eaton.qc.ca/ville/la-ville/proces-verbaux/"},
  {name: "Danville", url: "https://danville.ca/vie-municipale/conseil-municipal/proces-verbaux-ordre-du-jour-et-diffusion-des-seances/"},
  {name: "Neuville", url: "https://www.ville.neuville.qc.ca/ma-ville/vie-democratique/ordres-du-jour-et-proces-verbaux"},
  {name: "Daveluyville", url: "https://www.ville.daveluyville.qc.ca/seances-du-conseil"},
  {name: "Saint-Marc-des-Carrières", url: "https://st-marc-des-carrieres.qc.ca/ville/proces-verbaux-calendrier-des-seances-conseil"},
  {name: "Thurso", url: "https://www.ville.thurso.qc.ca/?id=43&mode=pr&module=CMS&newlang=fra"},
  {name: "Témiscaming", url: "https://www.temiscaming.net/"},
  {name: "Brownsburg-Chatham", url: "https://brownsburgchatham.ca/ma-ville/vie-democratique/seances-du-conseil/"},
  {name: "Richelieu", url: "https://ville.richelieu.qc.ca/a-propos/democratie-et-participation-citoyenne/seances-du-conseil-municipal/"},
  {name: "Berthierville", url: "https://www.ville.berthierville.qc.ca/ville/vie-democratique/seances-du-conseil-et-proces-verbaux"},
  {name: "Cap-Santé", url: "https://capsante.qc.ca/séances-du-conseil"},
  {name: "Coteau-du-Lac", url: "https://coteau-du-lac.com/seances-du-conseil/"},
  {name: "Les Cèdres", url: "https://www.ville.lescedres.qc.ca/fr/services-aux-citoyens/greffe/proces-verbaux-ordres-du-jour"},
  {name: "Warwick", url: "https://villedewarwick.quebec/seances-du-conseil-municipal/"},
  {name: "Sainte-Marguerite-du-Lac-Masson", url: "https://lacmasson.com/ma-ville/seances-du-conseil"},
  {name: "Richmond", url: "https://www.richmond.quebec/wp-content/uploads/2023/03/pv-2023-02-06.pdf"},
  {name: "Saint-Antonin", url: "http://ville.saint-antonin.qc.ca/pv/"},
  {name: "Waterloo", url: "https://ville.waterloo.qc.ca/seances-du-conseil/"},
  {name: "Sainte-Anne-des-Monts", url: "https://villesadm.net/proces-verbaux/"},
  {name: "Princeville", url: "https://princeville.quebec/proces-verbaux/"},
  {name: "Sainte-Anne-de-Beaupré", url: "https://www.sainteannedebeaupre.com/pages/proces-verbaux"},
  {name: "Baie-Saint-Paul", url: "https://www.baiesaintpaul.com/ville/administration-et-finances/equipe-et-services"},
  {name: "Windsor", url: "https://www.villedewindsor.qc.ca/seances-ordinaires/"},
  {name: "Sutton", url: "https://sutton.ca/category/proces-verbaux/"},
  {name: "Dunham", url: "https://www.ville.dunham.qc.ca/fr/proces-verbaux/"},
  {name: "Price", url: "https://www.ville.quebec.qc.ca/apropos/gouvernance/conseil-municipal/proces_verbaux.aspx"},
  {name: "Beaupré", url: "https://www.villedebeaupre.com/pages/ordre-du-jour-des-seances-du-conseil"},
  {name: "Hampstead", url: "https://www.hampstead.qc.ca/wp-content/uploads/2025/07/06RCM09JUIN2025FR.pdf"},
  {name: "Roberval", url: "https://www.roberval.ca/documentation/proces-verbaux"},

  // Batch 5
  {name: "Portneuf", url: "https://villedeportneuf.com/fr/ma-ville/conseil-municipal/seances-du-conseil"},
  {name: "Les Coteaux", url: "https://les-coteaux.qc.ca/services-aux-citoyens/conseil-municipal/"},
  {name: "Sainte-Brigitte-de-Laval", url: "https://sbdl.net/notre-ville/conseil-municipal/"},
  {name: "Fossambault-sur-le-Lac", url: "https://fossambault-sur-le-lac.com/ville/democratie/diffusion-des-seances-du-conseil/"},
  {name: "East Angus", url: "https://eastangus.ca/citoyens/services-aux-citoyens/cour-municipale/"},
  {name: "Lac-Beauport", url: "https://lac-beauport.quebec/la-municipalite/conseil-municipal/"},
  {name: "Beauceville", url: "https://ville.beauceville.qc.ca/municipalite/conseil-municipal/"},
  {name: "Sainte-Mélanie", url: "https://www.sainte-melanie.ca/municipalite/vie-democratique/seance-du-conseil"},
  {name: "Saint-Gabriel", url: "https://www.ville.stgabriel.qc.ca/ville/democratie/seances-du-conseil"},
  {name: "Chandler", url: "https://www.villedechandler.com/citoyens/mairie-administration-services-municipaux/assemblees-municipales/"},
  {name: "Trois-Pistoles", url: "https://www.ville-trois-pistoles.ca/page/seances-du-conseil-municipal"},
  {name: "Waterville", url: "http://www.waterville.ca/fr/affaires_municipales/assemblee.shtml"},
  {name: "Lac-Etchemin", url: "https://lac-etchemin.ca/municipalite/seances-du-conseil-municipal/"},
  {name: "Gracefield", url: "http://www.foretdelaigle.ca/conseil_gracefield"},
  {name: "Hudson", url: "https://hudson.quebec/en/councillors/agenda-and-minutes/"},
  {name: "Témiscouata-sur-le-Lac", url: "https://temiscouatasurlelac.ca/notre-ville/vie-democratique/les-seances-du-conseil-municipal"},
  {name: "Saint-Pamphile", url: "https://saintpamphile.ca/proces-verbaux"},
  {name: "Métabetchouan--Lac-à-la-Croix", url: "https://ville.metabetchouan.qc.ca/ville-et-citoyen/le-conseil/membres-du-conseil/"},
  {name: "Déléage", url: "https://www.deleage.ca/index.php/hotel-de-ville/conseil-municipal/proces-verbaux"},
  {name: "Saint-Pascal", url: "https://villesaintpascal.com/proces-verbaux"},
  {name: "Grande-Rivière", url: "https://villegranderiviere.ca/municipalite/vie-democratique/proces-verbaux-ordre-du-jour-des-seances/"},
  {name: "Château-Richer", url: "https://www.chateauricher.qc.ca/pages/proces-verbaux"},
  {name: "Causapscal", url: "https://www.causapscal.net/municipalite/vie-municipale/seance-du-conseil.html"},
  {name: "Port-Cartier", url: "https://villeport-cartier.com/ville/conseil-municipal/"},
  {name: "Maniwaki", url: "https://www.ville.maniwaki.qc.ca/index.php/hotel-de-ville/proces-verbaux"},
  {name: "Ville-Marie", url: "https://www.villevillemarie.org/seances-du-conseil/"},
  {name: "Rivière-Rouge", url: "https://www.riviere-rouge.ca/membres-du-conseil"},
  {name: "Bedford", url: "http://www.cantondebedford.ca/conseil/"},
  {name: "Stoneham-et-Tewkesbury", url: "https://www.villestoneham.com/ma-municipalite/democratie/seances-du-conseil"},
  {name: "Val-des-Sources", url: "https://valdessources.ca/a-propos-de-la-ville/vie-democratique/conseil-municipal/"},
  {name: "New Richmond", url: "https://villenewrichmond.com/la-ville/vie-democratique/proces-verbaux/"},
  {name: "Percé", url: "https://ville.perce.qc.ca/en/municipal-council/city-council-meetings-agenda-and-minutes/"},
  {name: "Forestville", url: "https://ville.forestville.ca/services-aux-citoyens/seance-du-conseil/"},
  {name: "Crabtree", url: "https://crabtree.quebec/municipalite/communications/proces-verbaux/"},
  {name: "Saint-Tite", url: "https://villest-tite.com/la-ville/administration/seances-conseil-proces-verbaux/"},

  // Batch 6
  {name: "Contrecoeur", url: "https://www.ville.contrecoeur.qc.ca/ville/democratie/proces-verbaux"},
  {name: "Laurier-Station", url: "https://laurierstation.ca/municipalite/vie-democratique/conseil-municipal"},
  {name: "Fermont", url: "https://www.villedefermont.qc.ca/conseil-municipal/"},
  {name: "Maskinongé", url: "https://mrcmaskinonge.ca/conseil/proces-verbaux/"},
  {name: "Senneterre", url: "https://www.ville.senneterre.qc.ca/upload/seances-du-conseil/proces-verbaux/"},
  {name: "Normandin", url: "https://ville.normandin.qc.ca/fonctionnement"},
  {name: "Sainte-Béatrix", url: "https://www.sainte-beatrix.com/municipalite/vie-municipale/seances-du-conseil"},
  {name: "Grande-Vallée", url: "https://grandevallee.ca/"},
  {name: "Scotstown", url: "https://scotstown.net/administration-finances/"},
  {name: "Granby", url: "https://www.granby.ca/fr/ville/ville/conseil-municipal-de-granby/proces-verbaux-et-videos-des-annees-anterieures"},
  {name: "Sainte-Luce", url: "https://sainteluce.ca/municipale/conseil.php"},
  {name: "Roxton Pond", url: "https://www.roxtonpond.ca/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Plessisville", url: "https://plessisville.quebec/organisation-municipale/seances-du-conseil/proces-verbaux-des-reunions-du-conseil-municipal/"},
  {name: "Ange-Gardien", url: "https://www.municipalite.ange-gardien.qc.ca/ma-municipalite/conseil-municipal/ordres-du-jour"},
  {name: "Labelle", url: "https://municipalite.labelle.qc.ca/municipalite/vie-democratique/seances-du-conseil-et-proces-verbaux"},
  {name: "Saint-Alexis-des-Monts", url: "https://www.saint-alexis-des-monts.ca/fr/la-municipalite/conseil-municipal"},
  {name: "Saint-Donat", url: "https://www.saint-donat.ca/la-municipalite/vie-democratique/seances-du-conseil/"},
  {name: "Lac-Mégantic", url: "https://www.ville.lac-megantic.qc.ca/fr/la-ville/conseil-municipal/ordres-du-jour-et-proces-verbaux"},
  {name: "Saint-Paulin", url: "https://saint-paulin.ca/images/administration.generale/proces-verbaux/"},
  {name: "Hébertville", url: "https://www.hebertville.qc.ca/"},
  {name: "Métis-sur-Mer", url: "https://www.ville.metis-sur-mer.qc.ca/fr/municipalite/proces-verbaux"},
  {name: "Mont-Joli", url: "https://ville.mont-joli.qc.ca/seances-du-conseil-municipal/"},
  {name: "Napierville", url: "https://www.napierville.ca/fr/municipalite/vie-municipale/proces-verbaux/"},
  {name: "Sainte-Croix", url: "https://saintecroix.ca/municipalite/vie-democratique/seances-du-conseil"},
  {name: "Saint-Zotique", url: "https://st-zotique.com/seances-proces-verbaux/"},
  {name: "Sainte-Brigide-d'Iberville", url: "https://www.sainte-brigide.qc.ca/fr/municipalite/conseil-municipal/seances-du-conseil/"},
  {name: "Shawville", url: "https://shawville.ca/municipality-of-shawville/council-minutes/"},
  {name: "Boucherville", url: "https://www.boucherville.ca/mairie-conseil/seances-du-conseil/"},
  {name: "L'Ange-Gardien", url: "https://municipalitedelangegardien.com/votre-conseil-municipal/"},
  {name: "Saint-Cuthbert", url: "https://st-cuthbert.qc.ca/municipalite/"},
  {name: "Ferme-Neuve", url: "https://municipalite.ferme-neuve.qc.ca/seances-du-conseil/"},
  {name: "Sainte-Anne-de-la-Pérade", url: "https://sadlp.ca/fr/municipalite/conseil-municipal/seances-du-conseil"},
  {name: "Champlain", url: "https://www.municipalite.champlain.qc.ca/upload/seances-du-conseil/proces-verbaux/"},
  {name: "Carleton-sur-Mer", url: "https://carletonsurmer.com/gouvernance-municipale/seances-conseil-municipal/"},
  {name: "Clermont", url: "http://www.ville.clermont.qc.ca/fr/ville/conseil-de-ville/proces-verbaux"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 4-5-6)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 210/1000 Quebec municipalities (21%)`);
}
main().catch(console.error);
