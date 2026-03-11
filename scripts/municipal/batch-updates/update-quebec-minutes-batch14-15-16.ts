#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 14
  {name: "Lac-Supérieur", url: "https://muni.lacsuperieur.qc.ca/espace-citoyens/proces-verbaux-et-ordre-du-jour/"},
  {name: "Saint-Barthélemy", url: "https://www.saint-barthelemy.ca/"},
  {name: "Mashteuiatsh", url: "https://www.mashteuiatsh.ca/katakuhimatsheta-conseil-des-elus/"},
  {name: "Saint-Ferdinand", url: "https://www.stferdinand.ca/seances-du-conseil"},
  {name: "Saint-Élie-de-Caxton", url: "https://www.st-elie-de-caxton.ca/notre-municipalite/proces-verbaux"},
  {name: "Vallée-Jonction", url: "https://valleejonction.qc.ca/pages/seances-du-conseil"},
  {name: "Saint-Patrice-de-Sherrington", url: "https://st-patrice-sherrington.com/historique-seances/ordre-du-jour-de-la-seance-ordinaire-du-14-mars-2023/"},
  {name: "Caplan", url: "https://municipalitecaplan.com/documents/"},
  {name: "Sainte-Marcelline-de-Kildare", url: "https://ste-marcelline.com/municipalite/conseil-municipal/seances-du-conseil"},
  {name: "Notre-Dame-des-Pins", url: "https://notredamedespins.qc.ca/"},
  {name: "La Guadeloupe", url: "https://www.munlaguadeloupe.qc.ca/pages/proces-verbaux"},
  {name: "Saint-François-du-Lac", url: "https://www.saintfrancoisdulac.ca/"},
  {name: "Barraute", url: "https://www.municipalitedebarraute.com/proces-verbaux-2"},
  {name: "Saint-Joseph-de-Coleraine", url: "https://www.coleraine.qc.ca/pages/proces-verbaux"},
  {name: "Notre-Dame-du-Laus", url: "https://www.notre-dame-du-laus.ca/"},
  {name: "Saint-Jacques-le-Mineur", url: "https://www.saint-jacques-le-mineur.ca/seances-du-conseil/"},
  {name: "Saint-Michel-de-Bellechasse", url: "https://www.stmicheldebellechasse.ca/la-municipalite/proces-verbaux/"},
  {name: "Grenville", url: "https://www.gslr.ca/en/my-municipality/democratic-life/council-meetings/"},
  {name: "Mille-Isles", url: "https://mille-isles.ca/conseil-municipal/proces-verbaux/"},
  {name: "Terrasse-Vaudreuil", url: "https://www.terrasse-vaudreuil.ca/proces-verbaux/"},
  {name: "Saint-Antoine-sur-Richelieu", url: "https://saint-antoine-sur-richelieu.ca/publications/proces-verbaux/"},
  {name: "Saint-Fabien", url: "https://www.saint-fabien.ca/proces-verbaux/"},
  {name: "Saint-Charles-sur-Richelieu", url: "https://www.saint-charles-sur-richelieu.ca/fr/municipalite/seances-du-conseil"},
  {name: "Sainte-Émélie-de-l'Énergie", url: "https://ste-emelie-de-lenergie.qc.ca/documents/?c=37"},
  {name: "Frontenac", url: "https://municipalitefrontenac.qc.ca/proces-verbaux/"},
  {name: "Ripon", url: "https://www.ripon.ca/fr/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Waswanipi", url: "https://waswanipi.com/chief-council/"},
  {name: "Saint-Narcisse", url: "https://www.saint-narcisse.com/info-citoyen/proces-verbaux-des-rencontres-du-conseil/"},
  {name: "Dudswell", url: "http://municipalitededudswell.ca/proces-verbaux/"},
  {name: "Saint-Damien-de-Buckland", url: "https://saint-damien.com/conseilmunicipal/"},
  {name: "Sainte-Justine", url: "https://www.stejustine.net/conseil-municipal/"},
  {name: "Berthier-sur-Mer", url: "https://berthiersurmer.ca/municipalite/conseil-municipal/"},
  {name: "Nouvelle", url: "https://www.nouvellegaspesie.com/"},
  {name: "Wentworth-Nord", url: "https://wentworth-nord.ca/mairie/proces-verbaux/"},

  // Batch 15
  {name: "Chambord", url: "https://chambord.ca/"},
  {name: "Saint-Clet", url: "https://st-clet.com/"},
  {name: "Pointe-Lebel", url: "https://pointe-lebel.com/"},
  {name: "Saint-Cyprien-de-Napierville", url: "https://www.st-cypriendenapierville.com/fr/municipalite/conseil-municipal/calendrier-des-seances/"},
  {name: "Saint-Antoine-de-Tilly", url: "https://apps.gestionweblex.ca/doc-list/"},
  {name: "Les Escoumins", url: "https://www.escoumins.ca/citoyens/proces-verbaux/"},
  {name: "Saint-Malachie", url: "https://www.st-malachie.qc.ca/pages/ordre-du-jour"},
  {name: "Val-Joli", url: "https://www.val-joli.ca/fr/municipalite/conseil-municipal/proces-verbaux-et-ordres-du-jour/"},
  {name: "Saint-Albert", url: "https://www.munstalbert.ca/"},
  {name: "Larouche", url: "https://www.larouche.ca/documentation/proces-verbaux"},
  {name: "Lambton", url: "https://www.lambton.ca/"},
  {name: "Saint-Laurent-de-l'Île-d'Orléans", url: "https://saintlaurentio.com/proces-verbaux-et-videos/"},
  {name: "Saint-Jean-de-Dieu", url: "https://saintjeandedieu.ca/"},
  {name: "Saint-Zacharie", url: "https://www.st-zacharie.qc.ca/pages/proces-verbaux"},
  {name: "La Conception", url: "https://municipalite.laconception.qc.ca/ordre-du-jour-et-proces-verbaux/"},
  {name: "Messines", url: "https://messines.ca/fr/conseil/seances-du-conseil/proces-verbaux"},
  {name: "Uashat", url: "https://www.itum.qc.ca/"},
  {name: "Sacré-Coeur", url: "https://www.sacre-coeur.ca/fr/vie-municipale/conseil-municipal/seances-du-conseil/"},
  {name: "Saint-Flavien", url: "https://www.st-flavien.com/pages/municipalite-proces-verbaux"},
  {name: "Maliotenam", url: "https://www.itum.qc.ca/"},
  {name: "Henryville", url: "http://henryville.ca/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Théodore-d'Acton", url: "https://st-theodore.com/communications/proces-verbaux-seances/"},
  {name: "Saint-Benoît-Labre", url: "https://saintbenoitlabre.com/proces-verbal/"},
  {name: "Saint-Ulric", url: "https://st-ulric.ca/"},
  {name: "Sainte-Lucie-des-Laurentides", url: "https://vplus-documents.s3.ca-central-1.amazonaws.com/sainte-lucie-des-laurentides/"},
  {name: "Saint-Bernard-de-Lacolle", url: "https://www.municipalite-de-saint-bernard-de-lacolle.ca/dates-des-sessions/"},
  {name: "Listuguj", url: "https://listuguj.ca/"},
  {name: "Saint-Pierre-de-l'Île-d'Orléans", url: "https://st-pierre.iledorleans.com/"},
  {name: "Tring-Jonction", url: "https://apps.gestionweblex.ca/doc-list/"},
  {name: "Cleveland", url: "https://cleveland.ca/wp-content/uploads/2020/07/"},
  {name: "Les Éboulements", url: "https://leseboulements.com/vie-municipale/municipalite/seances-du-conseil-et-proces-verbaux/"},
  {name: "Saint-Honoré-de-Shenley", url: "https://sthonoredeshenley.com/"},
  {name: "Saint-Tite-des-Caps", url: "https://sainttitedescaps.com/"},
  {name: "Saint-Ubalde", url: "https://saintubalde.com/vie-democratique/"},

  // Batch 16
  {name: "Hérouxville", url: "https://www.municipalite.herouxville.qc.ca/gestion-municipale/conseil-municipal/"},
  {name: "Sainte-Hénédine", url: "https://www.ste-henedine.com/"},
  {name: "Saint-François-de-la-Rivière-du-Sud", url: "https://www.stfrancois.ca/"},
  {name: "Rivière-Héva", url: "https://riviere-heva.com/municipalite/conseil-municipal"},
  {name: "Saint-Pacôme", url: "https://st-pacome.ca/pv/"},
  {name: "Saint-Casimir", url: "https://www.saint-casimir.com/default.asp?no=16"},
  {name: "Saint-Guillaume", url: "https://www.saintguillaume.ca/fr/vie-municipale/conseil-municipal/seances-du-conseil/"},
  {name: "La Minerve", url: "https://municipalite.laminerve.qc.ca/proces-verbaux/"},
  {name: "Lac-au-Saumon", url: "https://municipalites-du-quebec.ca/lac-au-saumon/conseil-municipal.php"},
  {name: "Sainte-Élisabeth", url: "https://ste-elisabeth.qc.ca/seance-du-conseil-et-proces-verbaux/"},
  {name: "Saint-Hubert-de-Rivière-du-Loup", url: "http://www.municipalite.saint-hubert-de-riviere-du-loup.qc.ca/pv/"},
  {name: "Saint-Odilon-de-Cranbourne", url: "https://www.saint-odilon.qc.ca/"},
  {name: "Lac-aux-Sables", url: "https://lac-aux-sables.qc.ca/proces-verbaux-disponibles-en-ligne/"},
  {name: "Wotton", url: "https://wotton.ca/espace-du-conseil/"},
  {name: "Clarendon", url: "https://clarendon.ca/municipality/"},
  {name: "Saint-Zénon", url: "https://www.saint-zenon.com/"},
  {name: "Armagh", url: "https://armagh.ca/"},
  {name: "Saint-Urbain", url: "https://www.sainturbain.qc.ca/fr/"},
  {name: "Saint-Édouard", url: "https://www.saintedouard.ca/municipalite/vie-democratique/proces-verbaux"},
  {name: "L'Isle-Verte", url: "http://www.municipalite.lisle-verte.qc.ca/pv/"},
  {name: "Palmarolle", url: "https://palmarolle.ao.ca/fr/"},
  {name: "Saint-Joachim", url: "https://saintjoachim.qc.ca/administration-municipale/elus-municipaux/"},
  {name: "Pointe-aux-Outardes", url: "https://pointe-aux-outardes.ca/municipalite/greffe-et-administration/"},
  {name: "Nantes", url: "https://municipalites-du-quebec.ca/nantes/proces-verbaux.php"},
  {name: "L'Isle-aux-Allumettes", url: "https://pontiacouest.ca/en/allumettes/council-meeting-minutes/"},
  {name: "La Doré", url: "https://www.ladore.ca/la-municipalite/le-conseil"},
  {name: "Saint-Aubert", url: "https://saint-aubert.net/fr/ma-municipalite/conseil-municipal/seances-du-conseil"},
  {name: "Chute-aux-Outardes", url: "https://www.municipalitecao.ca/"},
  {name: "Chapais", url: "http://villedechapais.com/vie-municipale/assembl%C3%A9e-publique"},
  {name: "Frampton", url: "https://www.frampton.ca/conseil-municipal/"},
  {name: "Saint-Majorique-de-Grantham", url: "https://www.st-majoriquedegrantham.qc.ca/"},
  {name: "Saints-Anges", url: "https://www.mamh.gouv.qc.ca/repertoire-des-municipalites/fiche/municipalite/26010/"},
  {name: "Labrecque", url: "https://ville.labrecque.qc.ca/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 14-15-16)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 545/1000 Quebec municipalities (54.5%)`);
}
main().catch(console.error);
