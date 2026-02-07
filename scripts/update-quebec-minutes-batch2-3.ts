#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 2
  {name: "Saint-Colomban", url: "https://st-colomban.qc.ca/evenements"},
  {name: "Deux-Montagnes", url: "https://ville.deux-montagnes.qc.ca/conseil-municipal/proces-verbaux-des-seances-du-conseil"},
  {name: "L'Ancienne-Lorette", url: "https://lancienne-lorette.org/"},
  {name: "Sainte-Catherine", url: "https://www.ville.sainte-catherine.qc.ca/ville/conseil-municipal/seances-publiques/"},
  {name: "Cowansville", url: "https://www.cowansville.ca/vie-municipale/democratie/seances-du-conseil"},
  {name: "Saint-Basile-le-Grand", url: "https://www.villesblg.ca/ville/democratie/seances-du-conseil/"},
  {name: "Saint-Charles-Borromée", url: "https://www.vivrescb.com/"},
  {name: "Mercier", url: "https://montreal.ca/conseils-decisionnels/conseil-darrondissement-de-mercier-hochelaga-maisonneuve"},
  {name: "Lavaltrie", url: "https://www.ville.lavaltrie.qc.ca/conseil-municipal/seances-du-conseil-et-proces-verbaux"},
  {name: "Sainte-Anne-des-Plaines", url: "https://www.villesadp.ca/"},
  {name: "Lachute", url: "https://lachute.ca/proces-verbaux/"},
  {name: "Gaspé", url: "https://ville.gaspe.qc.ca/mairie-et-conseil-municipal/seances-du-conseil-municipal"},
  {name: "Beauharnois", url: "https://ville.beauharnois.qc.ca/seances-du-conseil-et-ordre-du-jour/"},
  {name: "Sainte-Adèle", url: "https://ville.sainte-adele.qc.ca/seances-conseil.php"},
  {name: "Pincourt", url: "https://www.villepincourt.qc.ca/fr/la-ville/administration/seances-et-proces-verbaux"},
  {name: "Bécancour", url: "https://www.becancour.net/vie-municipale/conseil-municipal/proces-verbaux/"},
  {name: "Mont-Laurier", url: "https://www.villemontlaurier.qc.ca/vie-municipale/seances-conseil"},
  {name: "Val-des-Monts", url: "https://www.val-des-monts.net/"},
  {name: "Prévost", url: "https://www.ville.prevost.qc.ca/guichet-citoyen/informations/seances-du-conseil"},
  {name: "Rosemère", url: "https://www.ville.rosemere.qc.ca/seances-conseil/"},
  {name: "Matane", url: "https://www.ville.matane.qc.ca/ma-ville/vie-democratique/seances-du-conseil/"},
  {name: "Saint-Amable", url: "https://www.st-amable.qc.ca/proces-verbaux"},
  {name: "Sainte-Marie", url: "https://www.sainte-marie.ca/gestion-municipale/conseil-municipal/"},
  {name: "Amos", url: "https://amos.quebec/decouvrir-amos/vie-democratique/ordres-du-jour-et-proces-verbaux"},
  {name: "Dolbeau-Mistassini", url: "https://www.ville.dolbeau-mistassini.qc.ca/ma-ville/vie-democratique/conseil-municipal/"},
  {name: "Rawdon", url: "https://rawdon.ca/"},
  {name: "Sainte-Julienne", url: "https://www.sainte-julienne.com/municipalite/seance-du-conseil/"},
  {name: "Carignan", url: "https://www.carignan.quebec/ma-ville/democratie/proces-verbaux/"},
  {name: "Saint-Hippolyte", url: "https://saint-hippolyte.ca/proces-verbaux/"},
  {name: "Les Îles-de-la-Madeleine", url: "https://www.muniles.ca/affaires-municipales/conseil-municipal/proces-verbaux/"},
  {name: "Bromont", url: "https://www.bromont.net/administration-municipale/proces-verbaux/"},
  {name: "Cantley", url: "https://cantley.ca/municipalite/conseil-municipal/seances-du-conseil/"},
  {name: "Sainte-Agathe-des-Monts", url: "https://vsadm.ca/notre-ville/seances-conseil-municipal/"},
  {name: "Saint-Sauveur", url: "https://www.vss.ca/ville/vie-democratique/seances-du-conseil-municipal"},
  {name: "Mont-Tremblant", url: "https://www.villedemont-tremblant.qc.ca/fr/ville/conseil-de-ville/seances-des-conseils-municipal-et-dagglomeration/ordres-du-jour-et-pv"},

  // Batch 3
  {name: "Saint-Raymond", url: "https://villesaintraymond.com/a-propos-de-la-ville/conseil-municipal/ordres-du-jour-et-proces-verbaux"},
  {name: "Marieville", url: "https://www.ville.marieville.qc.ca/fr/la-ville/conseil-municipal/seances-du-conseil"},
  {name: "L'Île-Perrot", url: "https://www.ile-perrot.qc.ca/la-ville/democratie/conseil-municipal"},
  {name: "Notre-Dame-de-l'Île-Perrot", url: "https://www.ndip.org/seances-du-conseil"},
  {name: "Pont-Rouge", url: "https://www.ville.pontrouge.qc.ca/vie-municipale/vie-democratique/conseil-municipal/seances-du-conseil-municipal/"},
  {name: "Farnham", url: "https://ville.farnham.qc.ca/ville/democratie/seances-du-conseil/seances-du-conseil-2025/"},
  {name: "L'Épiphanie", url: "https://www.lepiphanie.ca"},
  {name: "Acton Vale", url: "https://ville.actonvale.qc.ca/ville/conseil-municipal/"},
  {name: "Rimouski", url: "https://rimouski.ca/ville/democratie/proces-verbaux"},
  {name: "Sainte-Catherine-de-la-Jacques-Cartier", url: "https://www.villescjc.com/vie-municipale/vie-democratique/seances-du-conseil"},
  {name: "Chelsea", url: "https://www.chelsea.ca/fr/votre-municipalite/conseil-municipal-et-comites"},
  {name: "Donnacona", url: "https://villededonnacona.com/fr/municipalite/conseil-municipal/seances-du-conseil"},
  {name: "Saint-Félicien", url: "https://ville.stfelicien.qc.ca/fr/document/proces-verbaux/"},
  {name: "Amqui", url: "https://www.ville.amqui.qc.ca/services-municipaux/greffe/proces-verbaux.html"},
  {name: "Coaticook", url: "https://www.coaticook.ca/fr/ville/seances-publiques.php"},
  {name: "Saint-Jérôme", url: "https://www.vsj.ca/conseil-municipal-et-comite-executif/proces-verbaux/"},
  {name: "Otterburn Park", url: "https://www.opark.ca/ville/seances-publiques/"},
  {name: "Saint-Rémi", url: "https://www.saint-remi.ca/ville/vie-municipale/seances-du-conseil/"},
  {name: "Lorraine", url: "https://lorraine.ca"},
  {name: "Notre-Dame-des-Prairies", url: "https://www.notredamedesprairies.com/notre-ville/conseils/"},
  {name: "Bois-des-Filion", url: "https://villebdf.ca/seances"},
  {name: "Huntingdon", url: "https://www.ville.huntingdon.qc.ca"},
  {name: "Rougemont", url: "https://rougemont.ca"},
  {name: "Montmagny", url: "https://www.ville.montmagny.qc.ca/fr/ville/vie-democratique/seances-du-conseil/"},
  {name: "Nicolet", url: "https://nicolet.ca/fr/seances-du-conseil"},
  {name: "La Pêche", url: "https://www.villelapeche.qc.ca/municipalite/vie-democratique/conseil-municipal/"},
  {name: "Louiseville", url: "https://louiseville.ca/seance-ordinaire-du-conseil-municipal/"},
  {name: "Saint-Pie", url: "https://villest-pie.ca/ville/conseil-municipal/calendrier-des-seances-du-conseil-et-proces-verbaux/"},
  {name: "Charlemagne", url: "https://www.charlemagne.ca/la-ville/vie-democratique/seances-du-conseil"},
  {name: "Desbiens", url: "https://www.ville.desbiens.qc.ca/le-conseil-municipal"},
  {name: "Saint-Joseph-de-Beauce", url: "https://vsjb.ca/la-ville/proces-verbaux/"},
  {name: "Lac-Brome", url: "http://ville.lac-brome.qc.ca/vie-municipale/seances-du-conseil/"},
  {name: "McMasterville", url: "https://www.mcmasterville.ca/la-municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Bedford", url: "https://ville.bedford.qc.ca/"},
  {name: "Verchères", url: "https://ville.vercheres.qc.ca/municipalite/seances-et-proces-verbaux/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 2-3)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 105/1000 Quebec municipalities (10.5%)`);
}
main().catch(console.error);
