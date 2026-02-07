#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 20
  {name: "Rivière-à-Pierre", url: "https://riviereapierre.com/la-municipalite/conseil-municipal"},
  {name: "Les Bergeronnes", url: "https://bergeronnes.com/procès-verbaux-1"},
  {name: "Saint-François-de-Sales", url: "https://municipalites-du-quebec.ca/saint-francois-de-sales"},
  {name: "La Bostonnais", url: "https://labostonnais.ca/"},
  {name: "Colombier", url: "https://municipalites-du-quebec.ca/colombier/proces-verbaux.php"},
  {name: "Hope", url: "https://municipalitedehope.ca/"},
  {name: "Kamouraska", url: "https://www.kamouraska.ca/documentation"},
  {name: "Packington", url: "https://packington.org/greffes/proces-verbaux"},
  {name: "Escuminac", url: "https://www.escuminac.org/"},
  {name: "Sainte-Sophie-d'Halifax", url: "https://www.saintesophiedhalifax.com/vie-municipale"},
  {name: "Baie-des-Sables", url: "https://municipalite.baiedessables.ca/"},
  {name: "Denholm", url: "https://www.denholm.ca/fr/vie-municipale/conseil-municipal/proces-verbaux/"},
  {name: "Sainte-Anne-de-la-Rochelle", url: "https://steannedelarochelle.ca/f-pv-2025.php"},
  {name: "Arundel", url: "https://arundel.ca/publications/proces-verbaux/"},
  {name: "Lac-Saguay", url: "https://www.lacsaguay.qc.ca/index.php/hotel-de-ville/proces-verbaux"},
  {name: "Mont-Saint-Michel", url: "https://www.montsaintmichel.ca/proces-verbaux"},
  {name: "Lac-des-Aigles", url: "https://lacdesaigles.ca/municipal/administration/conseil-municipal/proces-verbaux"},
  {name: "Kangirsuk", url: "https://www.ekuanitshit.com/conseil"},
  {name: "Laforce", url: "https://laforce.ca"},
  {name: "Péribonka", url: "https://peribonka.ca/"},
  {name: "Portneuf-sur-Mer", url: "https://www.portneuf-sur-mer.ca/"},
  {name: "Saint-Joseph-de-Lepage", url: "https://municipalite.saint-joseph-de-lepage.qc.ca/"},
  {name: "Saint-Eusèbe", url: "https://www.sainteusebe.ca/"},
  {name: "Matapédia", url: "https://matapedialesplateaux.com/citoyens/matapedia/"},
  {name: "Sacré-Coeur-de-Jésus", url: "https://municipalites-du-quebec.com/sacre-coeur-de-jesus/f-pv-2021.php"},
  {name: "Sainte-Clotilde-de-Beauce", url: "https://www.ste-clotilde.com/pages/proces-verbaux"},
  {name: "Duhamel", url: "https://www.municipalite.duhamel.qc.ca/"},
  {name: "Saint-Camille", url: "https://www.saint-camille.net/pages/proces-verbaux"},
  {name: "Mingan", url: "https://www.ekuanitshit.com/conseil"},
  {name: "Sainte-Anne-du-Lac", url: "https://www.steannedulac.ca/index.php/hotel-de-ville/proces-verbaux"},
  {name: "Saint-Luc-de-Vincennes", url: "https://stlucdevincennes.com/municipalite/httpstlucdevincennes-comwp-contentuploads201708pv-juillet-2017-pdf/"},
  {name: "Saint-Adrien", url: "https://www.stadriendirlande.ca/"},
  {name: "Tourville", url: "https://www.muntourville.qc.ca/pages/proces-verbaux"},
  {name: "Lac-Saint-Paul", url: "https://lac-saint-paul.ca/"},
  {name: "Saint-Damase-de-L'Islet", url: "https://saintdamasedelislet.com/municipalite/organisation-municipale-et-conseil/"},

  // Batch 21
  {name: "Thorne", url: "https://www.thorneque.ca/file-share"},
  {name: "Saint-Alfred", url: "https://www.st-alfred.qc.ca/pages/proces-verbaux"},
  {name: "Pikogan", url: "https://pikogan.com/"},
  {name: "Saint-Sixte", url: "https://saintsixte.ca/conseil-municipal/"},
  {name: "Lac-des-Plages", url: "https://lacdesplages.com/municipalite/seances-du-conseil"},
  {name: "Saint-Jules", url: "https://www.st-jules.qc.ca/pages/proces-verbaux"},
  {name: "Berry", url: "https://municipalites-du-quebec.com/berry/"},
  {name: "Saint-Malo", url: "https://www.saint-malo.ca/"},
  {name: "Sainte-Thérèse-de-la-Gatineau", url: "https://www.sainte-therese-de-la-gatineau.ca/fr/conseil-municipal/calendrier-des-seances/"},
  {name: "Saint-Juste-du-Lac", url: "https://www.municipality-canada.com/en/municipalite-saint-juste-du-lac.html"},
  {name: "Stornoway", url: "https://www.munstornoway.qc.ca/"},
  {name: "Sainte-Apolline-de-Patton", url: "https://www.sainteapollinedepatton.ca/"},
  {name: "Saint-Émile-de-Suffolk", url: "https://www.st-emile-de-suffolk.com/"},
  {name: "Egan-Sud", url: "https://www.egan-sud.ca/images/proces-verbaux/"},
  {name: "Timiskaming", url: "https://www.temiscaming.net/upload/seances-du-conseil/"},
  {name: "Saint-François-de-l'Île-d'Orléans", url: "https://msfio.ca/"},
  {name: "Saint-Moïse", url: "https://st-moise.com/"},
  {name: "Calixa-Lavallée", url: "https://calixa-lavallee.ca/"},
  {name: "La Motte", url: "https://municipalitedelamotte.ca/affaires-municipales/proces-verbaux/"},
  {name: "Saint-Robert-Bellarmin", url: "https://www.st-robertbellarmin.qc.ca/pages/agenda-des-seances"},
  {name: "Lamarche", url: "https://www.municipality-canada.com/en/municipalite-lamarche.html"},
  {name: "Mulgrave-et-Derry", url: "http://www.mulgrave-derry.ca/"},
  {name: "Litchfield", url: "https://litchfield-qc.ca/"},
  {name: "Odanak", url: "https://caodanak.com/en/"},
  {name: "Villeroy", url: "https://municipalitevilleroy.ca/affaires-municipales/proces-verbaux/"},
  {name: "Saint-Bruno-de-Kamouraska", url: "https://www.stbrunokamouraska.ca/"},
  {name: "Saint-Alexis-de-Matapédia", url: "https://www.municipality-canada.com/en/municipalite-saint-alexis-de-matapedia.html"},
  {name: "Leclercville", url: "https://www.munleclercville.qc.ca/pages/agenda-des-seances"},
  {name: "Saint-Octave-de-Métis", url: "https://municipalites-du-quebec.com/st-octave-de-metis/"},
  {name: "Lochaber", url: "https://www.cantonlochaber.ca/"},
  {name: "Pike River", url: "https://www.pikeriver.com/"},
  {name: "Saint-Clément", url: "https://www.st-clement.ca/"},
  {name: "Gallichan", url: "https://www.municipality-canada.com/en/municipalite-gallichan.html"},
  {name: "Sainte-Rose-du-Nord", url: "https://www.ste-rosedunord.qc.ca/la-municipalite/seance-du-conseil/"},
  {name: "Lac-du-Cerf", url: "https://www.lacducerf.ca/vie-municipale/seances-du-conseil/"},

  // Batch 22
  {name: "Saint-Denis-De La Bouteillerie", url: "https://munstdenis.com/municipalite/seance-du-conseil/"},
  {name: "Saint-Marcel-de-Richelieu", url: "https://saintmarcelderichelieu.ca/"},
  {name: "Saint-Eugène-d'Argentenay", url: "https://www.saint-eugene.ca/fr/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Maricourt", url: "https://maricourt.ca/conseil-municipal/"},
  {name: "Fassett", url: "http://www.village-fassett.com/proces-verbaux-2023/"},
  {name: "Saint-Adelme", url: "http://municipalite.st-adelme.ca/publications-proces-verbaux.html"},
  {name: "Saint-Luc-de-Bellechasse", url: "https://www.st-luc-bellechasse.qc.ca/"},
  {name: "Saint-Prosper-de-Champlain", url: "https://www.st-prosper.ca/"},
  {name: "Saint-Simon-de-Rimouski", url: "http://www.st-simon.qc.ca/pv/"},
  {name: "Saint-André-du-Lac-Saint-Jean", url: "http://www.standredulac.qc.ca/"},
  {name: "Sainte-Marie-de-Blandford", url: "https://municipalites-du-quebec.com/sainte-marie-de-blandford/"},
  {name: "Saint-Adalbert", url: "https://www.saintadalbert.qc.ca/"},
  {name: "Grand-Saint-Esprit", url: "https://www.grandsaintesprit.qc.ca/fr/municipalite/conseil-municipal"},
  {name: "Quaqtaq", url: "https://www.krg.ca/"},
  {name: "Saint-Valentin", url: "https://municipalite.saint-valentin.qc.ca/proces-verbaux"},
  {name: "Auclair", url: "https://www.municipaliteauclair.ca/citoyens/administration-municipale/conseil-municipal"},
  {name: "Grosse-Île", url: "https://www.muniles.ca/affaires-municipales/conseil-municipal/proces-verbaux/"},
  {name: "Ulverton", url: "https://municipaliteulverton.com/seance-du-conseil-et-proces-verbaux/"},
  {name: "Saint-Marcel", url: "https://www.saintmarcel.qc.ca/pages/proces-verbaux"},
  {name: "Saint-Eugène-de-Guigues", url: "https://www.guigues.ca/wp-content/uploads/2021/02/PROCES-VERBAUX-2020.pdf"},
  {name: "Saint-Dominique-du-Rosaire", url: "https://municipalites-du-quebec.com/st-dominique-du-rosaire/"},
  {name: "Trois-Rives", url: "https://trois-rives.com/proces-verbaux/"},
  {name: "Rivière-Éternité", url: "https://riviere-eternite.com/"},
  {name: "Maddington Falls", url: "https://www.maddington.ca/seances-du-conseil"},
  {name: "Aston-Jonction", url: "https://www.aston-jonction.ca/membres-conseil-municipal/"},
  {name: "Biencourt", url: "https://biencourt.ca/municipalite/conseil-municipal/procès-verbaux"},
  {name: "Saint-Marcellin", url: "http://st-marcellin.qc.ca/services/?id=51"},
  {name: "Notre-Dame-du-Rosaire", url: "https://notredamedurosaire.com/?m=permalink&s=affaires-municipales&x=reglements"},
  {name: "Longue-Pointe-de-Mingan", url: "http://www.longuepointedemingan.ca/affaires-municipales/conseil-municipal"},
  {name: "Bois-Franc", url: "https://bois-franc.ca/"},
  {name: "Piopolis", url: "https://www.piopolis.quebec/fr/vie-municipale/conseil-municipal/proces-verbaux-et-ordres-du-jour/"},
  {name: "Kinnear's Mills", url: "https://kinnearsmills.com/fr/vie-communautaire/proces-verbeaux"},
  {name: "Saint-Eugène-de-Ladrière", url: "https://ladriere.ca/conseil-municipal/"},
  {name: "Kipawa", url: "https://kipawa.ca/services/?id=4"},
  {name: "Boileau", url: "https://boileau.ca/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 20-21-22)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 755/1000 Quebec municipalities (75.5%)`);
}
main().catch(console.error);
