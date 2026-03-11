#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 17
  {name: "Saint-Léonard-de-Portneuf", url: "https://st-leonard.com/municipalite/seances-du-conseil/ordres-du-jour"},
  {name: "Saint-Bruno-de-Guigues", url: "http://www.guigues.ca/document-category/procesverbal/"},
  {name: "Saint-Wenceslas", url: "https://www.municipalitestwenceslas.com/administration/avis-publics/"},
  {name: "Notre-Dame-des-Bois", url: "https://www.notredamedesbois.qc.ca/fr/administration/conseil-municipal/"},
  {name: "Saint-Félix-d'Otis", url: "https://st-felix-dotis.qc.ca/calendrier-des-seancesavis-publics/"},
  {name: "Plaisance", url: "https://ville.plaisance.qc.ca/"},
  {name: "Saint-Janvier-de-Joly", url: "https://www.municipalitedejoly.com/"},
  {name: "Lac-Bouchette", url: "https://municipalites-du-quebec.ca/lac-bouchette/proces-verbaux.php"},
  {name: "Saint-Pierre-les-Becquets", url: "https://st-pierre-les-becquets.qc.ca/municipalite/assemblees-proces-verbaux/"},
  {name: "Mont-Carmel", url: "https://www.mont-carmel.ca/mot-du-maire/calendrier-des-seances-et-proces-verbaux/"},
  {name: "Saint-Valère", url: "https://www.msvalere.qc.ca/seances-du-conseil"},
  {name: "Saint-Eugène", url: "https://www.saint-eugene.ca/fr/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Aimé-des-Lacs", url: "https://www.saintaimedeslacs.ca/conseil-municipal"},
  {name: "Charette", url: "http://www.municipalite-charette.ca/documentation/"},
  {name: "Saint-Modeste", url: "http://www.municipalite.saint-modeste.qc.ca/"},
  {name: "Frelighsburg", url: "https://frelighsburg.ca/municipalite/proces-verbaux/"},
  {name: "Saint-Frédéric", url: "https://www.st-frederic.com/proces-verbaux-videos"},
  {name: "Saint-Claude", url: "https://www.municipalite.st-claude.ca/"},
  {name: "Bristol", url: "https://bristolmunicipality.ca/fr/municipalite/"},
  {name: "Notre-Dame-de-la-Merci", url: "http://www.mun-ndm.ca/municipalite/conseil-municipal"},
  {name: "Chute-Saint-Philippe", url: "https://www.chute-saint-philippe.ca/fr/vie-municipale/proces-verbaux-et-ordres-du-jour/"},
  {name: "Saint-Étienne-de-Beauharnois", url: "https://www.st-etiennedebeauharnois.qc.ca/seances-du-conseil-et-proces-verbaux/"},
  {name: "Notre-Dame-des-Neiges", url: "https://www.notredamedesneiges.qc.ca/"},
  {name: "Saint-Norbert", url: "https://saint-norbert.net/affaires-municipales/proces-verbaux"},
  {name: "Sainte-Geneviève-de-Batiscan", url: "https://www.stegenevieve.ca/"},
  {name: "La Macaza", url: "https://www.munilamacaza.ca/proces-verbaux"},
  {name: "Melbourne", url: "https://melbournecanton.ca/en/council-minutes/"},
  {name: "Saint-Siméon", url: "https://www.saintsimeon.ca/nos-proces-verbaux/"},
  {name: "Entrelacs", url: "https://www.entrelacs.com/municipal/administration-generale/seances-du-conseil-proces-verbaux-et-ordre-du-jour"},
  {name: "Petite-Rivière-Saint-François", url: "https://www.petiteriviere.com/municipalite/proces-verbaux/"},
  {name: "Saint-Ludger", url: "https://st-ludger.qc.ca/proces-verbaux/"},
  {name: "Notre-Dame-du-Nord", url: "https://www.nddn.ca/"},
  {name: "Blanc-Sablon", url: "https://www.municipality-canada.com/en/municipalite-blanc-sablon.html"},
  {name: "Saint-Cyprien", url: "https://www.st-cyprien.qc.ca/pages/seance-du-conseil"},
  {name: "Valcourt", url: "https://valcourt.ca/"},

  // Batch 18
  {name: "Saint-Patrice-de-Beaurivage", url: "https://www.spdb.ca/"},
  {name: "Saint-Bonaventure", url: "https://www.saint-bonaventure.ca/"},
  {name: "Kazabazua", url: "https://www.kazabazua.ca/index.php/en/city-hall/municipal-council"},
  {name: "La Romaine", url: "https://mcngsl.ca/la-romaine/?lang=en"},
  {name: "L'Isle-aux-Coudres", url: "https://www.municipaliteiac.ca/fr/calendrier-des-seances-du-conseil/"},
  {name: "Val-Alain", url: "https://www.val-alain.com/"},
  {name: "Lac-Drolet", url: "https://lacdrolet.ca/proces-verbaux/"},
  {name: "Saint-Sylvestre", url: "https://www.st-sylvestre.org/?page=proces-verbaux"},
  {name: "Saint-Louis-de-Blandford", url: "https://www.saint-louis-de-blandford.ca/"},
  {name: "Low", url: "https://www.lowquebec.ca/en/municipality/municipal-life/public-notices/"},
  {name: "Sainte-Marthe", url: "http://www.sainte-marthe.ca/conseil-municipal/"},
  {name: "Stratford", url: "https://stratford.quebec/vie-municipale/seancesduconseil/"},
  {name: "Whapmagoostui", url: "https://www.whapmagoostui.ca/"},
  {name: "Saint-Michel-du-Squatec", url: "https://www.squatec.qc.ca/municipalite/conseil-municipal-1/proces-verbaux"},
  {name: "Lochaber-Partie-Ouest", url: "http://www.lochaber-ouest.ca/"},
  {name: "Girardville", url: "https://villegirardville.ca/"},
  {name: "Sainte-Agathe-de-Lotbinière", url: "https://www.steagathedelotbiniere.com/"},
  {name: "Saint-Georges-de-Windsor", url: "https://www.st-georges-de-windsor.org/municipal-proces-verbaux.php"},
  {name: "Saint-Maxime-du-Mont-Louis", url: "https://st-maxime.qc.ca/"},
  {name: "Saint-René", url: "https://www.st-rene.ca/pages/proces-verbaux-et-publications"},
  {name: "Saint-Léon-de-Standon", url: "https://www.st-leon-de-standon.com/"},
  {name: "Kangiqsualujjuaq", url: "https://www.municipality-canada.com/en/reserve-indienne-kangiqsualujjuaq.html"},
  {name: "Val-des-Bois", url: "https://val-des-bois.ca/la-municipalite/document-municipaux/proces-verbaux/proces-2021/"},
  {name: "Saint-Fabien-de-Panet", url: "https://www.saintfabiendepanet.com/la-ville/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Vallier", url: "https://www.stvallierbellechasse.qc.ca/pages/affaires-ordre-du-jour-proces"},
  {name: "Saint-Jean-de-l'Île-d'Orléans", url: "http://st-jean.iledorleans.com/"},
  {name: "Brébeuf", url: "https://brebeuf.ca/proces-verbaux/"},
  {name: "Rivière-Ouelle", url: "https://riviereouelle.ca/"},
  {name: "Sainte-Thérèse-de-Gaspé", url: "https://saintetheresedegaspe.com/"},
  {name: "Sainte-Pétronille", url: "http://ste-petronille.iledorleans.com/fra/conseil-municipal/proces-verbaux-seances-du-conseil.asp"},
  {name: "Sainte-Justine-de-Newton", url: "https://www.sainte-justine-de-newton.ca/proces-verbaux"},
  {name: "Montebello", url: "https://www.montebello.ca/"},
  {name: "Cayamant", url: "https://www.cayamant.ca/"},
  {name: "L'Ascension", url: "https://www.municipalite-lascension.qc.ca/proces-verbaux/"},
  {name: "Laverlochère-Angliers", url: "https://laverlochere-angliers.org/"},

  // Batch 19
  {name: "Otter Lake", url: "https://www.otterlakequebec.ca/file-share"},
  {name: "Harrington", url: "https://harrington.ca/conseil-municipal/"},
  {name: "Ham-Nord", url: "https://www.ham-nord.ca/seances"},
  {name: "Lantier", url: "https://lantier.quebec/proces-verbaux/"},
  {name: "Inverness", url: "https://www.invernessquebec.ca/fr/ma-municipalite/vie-municipale/seances-du-conseil/"},
  {name: "Preissac", url: "https://preissac.com/proces-verbaux"},
  {name: "Eastmain", url: "https://eastmain.ca/council/"},
  {name: "Sainte-Perpétue", url: "https://www.sainteperpetue.com/"},
  {name: "Beaulac-Garthby", url: "https://www.beaulac-garthby.com/fr/municipalite/vie-municipale/proces-verbaux/"},
  {name: "Chénéville", url: "https://www.ville-cheneville.com/proces-verbaux"},
  {name: "Dupuy", url: "https://dupuy.ao.ca/fr/"},
  {name: "Sainte-Hedwidge", url: "https://municipalites-du-quebec.ca/ste-hedwidge/conseil-municipal.php"},
  {name: "Sainte-Germaine-Boulé", url: "https://saintegermaineboule.com/conseil-municipal/seances/"},
  {name: "Duhamel-Ouest", url: "https://municipalites-du-quebec.ca/duhamel-ouest/proces-verbaux.php"},
  {name: "Val-Brillant", url: "https://municipalites-du-quebec.ca/val-brillant/proces-verbaux.php"},
  {name: "Natashquan", url: "https://www.natashquan.org/seances-municipales/"},
  {name: "Saint-Rosaire", url: "https://www.strosaire.ca/fr/vie-municipale/conseil-municipal/proces-verbaux-et-ordres-du-jour/"},
  {name: "Saint-Roch-des-Aulnaies", url: "https://www.saintrochdesaulnaies.ca/pages/proces-verbaux"},
  {name: "Sainte-Flavie", url: "https://www.sainte-flavie.net/ma-municipalite/conseil-municipal.html"},
  {name: "Saint-Adelphe", url: "https://www.st-adelphe.qc.ca/accueil/municipalite/communication/proces-verbaux/"},
  {name: "Saint-Pierre-de-Broughton", url: "https://www.saintpierredebroughton.ca/fr/vie-municipale/conseil-municipal/calendrier-des-seances/"},
  {name: "Dosquet", url: "https://www.municipalitedosquet.com/ma-municipalite/services-en-ligne/"},
  {name: "Irlande", url: "https://www.mundirlande.qc.ca/pages/seances-conseil-proces-verbaux"},
  {name: "Saint-Nazaire-d'Acton", url: "https://stnazairedacton.ca/seances-du-conseil/"},
  {name: "Saint-Marc-de-Figuery", url: "https://www.saint-marc-de-figuery.org/fr/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Taschereau", url: "https://taschereau.ao.ca/fr/page/index.cfm?PageID=1250"},
  {name: "Sainte-Cécile-de-Whitton", url: "https://www.stececiledewhitton.qc.ca/pages/version-audio-des-seances"},
  {name: "Sainte-Aurélie", url: "https://www.ste-aurelie.qc.ca/pages/le-conseil"},
  {name: "Notre-Dame-du-Sacré-Coeur-d'Issoudun", url: "https://www.issoudun.qc.ca/"},
  {name: "Landrienne", url: "https://www.landrienne.com/municipalite/conseil-municipal"},
  {name: "Lotbinière", url: "https://www.municipalite-lotbiniere.com/"},
  {name: "Sainte-Hélène-de-Kamouraska", url: "https://sainte-helene.net/municipalite/conseil-municipal/"},
  {name: "Notre-Dame-de-Pontmain", url: "https://munpontmain.qc.ca/"},
  {name: "Bégin", url: "https://begin.ca/"},
  {name: "Longue-Rive", url: "https://www.longuerive.ca/fr/vie-municipale/seances-du-conseil/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 17-18-19)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 650/1000 Quebec municipalities (65.0%)`);
}
main().catch(console.error);
