#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 11
  {name: "La Tuque", url: "https://www.ville.latuque.qc.ca/"},
  {name: "Kahnawake", url: "http://www.kahnawake.com/org/pubdocs.asp"},
  {name: "Boischatel", url: "https://www.boischatel.ca/ma-ville/vie-democratique/seance-du-conseil"},
  {name: "Saint-Apollinaire", url: "https://www.st-apollinaire.com/ma-municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Philippe", url: "https://ville.saintphilippe.quebec/seances-du-conseil-2025/"},
  {name: "La Malbaie", url: "https://www.ville.lamalbaie.qc.ca/ville-menu/"},
  {name: "Shefford", url: "https://cantonshefford.qc.ca/la-municipalite/conseil-municipal/ordres-du-jour-et-pv/"},
  {name: "Saint-Calixte", url: "https://saint-calixte.ca/municipalite/mairie/seances-du-conseil"},
  {name: "Saint-Lambert-de-Lauzon", url: "https://mun-sldl.ca/proces-verbaux"},
  {name: "Chibougamau", url: "https://www.ville.chibougamau.qc.ca/vie-municipale/seances-du-conseil"},
  {name: "Saint-Paul", url: "https://saintpaul.quebec/municipalite/vie-democratique/seances-du-conseil-ordres-du-jour-et-proces-verbaux"},
  {name: "La Sarre", url: "https://www.lasarre.ca/ma-ville/seances-du-conseil/"},
  {name: "Shannon", url: "https://shannon.ca/en/municipal-life/minutes/"},
  {name: "Saint-Honoré", url: "https://www.ville.sthonore.qc.ca/seances-du-conseil/"},
  {name: "Notre-Dame-du-Mont-Carmel", url: "https://www.mont-carmel.org/proces-verbaux"},
  {name: "Pontiac", url: "https://mrcpontiac.qc.ca/la-mrc/proces-verbaux-du-conseil/"},
  {name: "Pointe-Calumet", url: "https://www.pointe-calumet.ca/la-municipalite/seances-du-conseil-municipal/"},
  {name: "La Pocatière", url: "https://www.lapocatiere.ca/la-ville/seances-du-conseil/"},
  {name: "Oka", url: "https://municipalite.oka.qc.ca/mairie/seances-publiques-du-conseil-municipal/"},
  {name: "Saint-Henri", url: "https://www.saint-henri.ca/conseil/"},
  {name: "Val-David", url: "https://valdavid.com/organisation-municipale/val-david-vous-informe/proces-verbaux-seances-publiques/"},
  {name: "Lanoraie", url: "https://www.lanoraie.ca/municipalite/vie-democratique/seances-du-conseil"},
  {name: "Saint-Roch-de-l'Achigan", url: "https://sra.quebec/seances-du-conseil"},
  {name: "Chertsey", url: "https://chertsey.ca/municipalite/vie-democratique/proces-verbaux"},
  {name: "Orford", url: "https://canton.orford.qc.ca/municipalite/seances-du-conseil/"},
  {name: "Saint-Jean-de-Matha", url: "https://municipalitestjeandematha.qc.ca/municipalite/vie-democratique/seances-du-conseil"},
  {name: "Saint-Boniface", url: "https://saint-bo.ca/"},
  {name: "Saint-Cyrille-de-Wendover", url: "https://www.stcyrille.qc.ca/proces-verbaux-reunions-du-conseil"},
  {name: "Montréal-Ouest", url: "https://montreal-ouest.ca/en/our-town/town-council/public-meetings/"},
  {name: "Saint-Denis-de-Brompton", url: "https://www.sddb.ca"},
  {name: "Morin-Heights", url: "http://morinheights.com/Reunions-du-conseil"},
  {name: "Montréal-Est", url: "https://ville.montreal-est.qc.ca/vie-democratique/proces-verbaux/"},
  {name: "Saint-Jacques", url: "https://www.st-jacques.org/municipalite/vie-democratique/seances-du-conseil"},
  {name: "Saint-Agapit", url: "https://st-agapit.qc.ca/"},
  {name: "Saint-Mathias-sur-Richelieu", url: "https://www.saint-mathias-sur-richelieu.org/seances-du-conseil"},

  // Batch 12
  {name: "Saint-Ambroise-de-Kildare", url: "https://www.saintambroise.ca/vie-democratique/proces-verbaux/"},
  {name: "Baie-D'Urfé", url: "https://www.baie-durfe.qc.ca/en/democratic-life/page/municipal-council-meetings"},
  {name: "Senneville", url: "https://www.senneville.ca/municipalite/vie-democratique/ordres-du-jour-proces-verbaux-et-visioconference/"},
  {name: "Portneuf", url: "https://villedeportneuf.com/fr/ma-ville/conseil-municipal/seances-du-conseil"},
  {name: "Cap-Santé", url: "https://capsante.qc.ca/séances-du-conseil"},
  {name: "Notre-Dame-de-la-Salette", url: "http://muni-ndsalette.qc.ca/conseil/"},
  {name: "Très-Saint-Sacrement", url: "http://www.tres-st-sacrement.ca/"},
  {name: "Saint-Gédéon", url: "https://www.st-gedeon.qc.ca/"},
  {name: "Sainte-Anne-des-Monts", url: "https://villesadm.net/proces-verbaux/"},
  {name: "Amherst", url: "https://municipalite.amherst.qc.ca/conseil-municipal/"},
  {name: "Stanstead", url: "https://www.cantonstanstead.ca/en/the-municipality/council-meetings/"},
  {name: "Saint-Armand", url: "http://www.municipalite.saint-armand.qc.ca/conseil-municipal/"},
  {name: "Sutton", url: "https://sutton.ca/category/proces-verbaux/"},
  {name: "Bolton-Est", url: "https://www.boltonest.ca/fr"},
  {name: "Mansonville", url: "https://potton.ca/en/municipality/municipal-affairs/"},
  {name: "Potton", url: "https://potton.ca/en/municipality/municipal-affairs/"},
  {name: "Austin", url: "https://municipalite.austin.qc.ca/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Stukely-Sud", url: "https://stukely-sud.com/proces-verbaux/"},
  {name: "Eastman", url: "https://eastman.quebec/seances-du-conseil"},
  {name: "Stanstead-Est", url: "https://www.stansteadest.ca/"},
  {name: "Ogden", url: "https://en.munogden.ca/"},
  {name: "Roxton Pond", url: "https://www.roxtonpond.ca/municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Joachim-de-Shefford", url: "https://st-joachim.ca/municipalite/administration-et-finance/seances-du-conseil/"},
  {name: "Sainte-Cécile-de-Milton", url: "https://www.miltonqc.ca/municipalite/proces-verbaux/"},
  {name: "Granby", url: "https://www.granby.ca/fr/ville/seances-du-conseil-municipal-2026"},
  {name: "Waterloo", url: "https://ville.waterloo.qc.ca/seances-du-conseil/"},
  {name: "Warden", url: "https://municipalites-du-quebec.ca/warden/proces-verbaux.php"},
  {name: "Saint-Étienne-de-Bolton", url: "https://www.sedb.qc.ca/fr/pv-ass.htm"},
  {name: "Bolton-Ouest", url: "https://www.bolton-ouest.ca/en/municipality/municipal-life/minutes/"},
  {name: "Brome", url: "https://ville.lac-brome.qc.ca/"},
  {name: "Abercorn", url: "https://municipalites-du-quebec.com/abercorn/"},
  {name: "Brigham", url: "https://brigham.ca/proces-verbaux/"},
  {name: "Sainte-Sabine", url: "https://municipalites-du-quebec.com/sainte-sabine/"},
  {name: "Saint-Alphonse-de-Granby", url: "https://st-alphonse.qc.ca/mairie/"},

  // Batch 13
  {name: "Roxton", url: "https://cantonderoxton.qc.ca/ville/conseil-municipal/proces-verbaux/"},
  {name: "Roxton Falls", url: "https://roxtonfalls.ca/proces-verbalseances-du-conseil/"},
  {name: "Upton", url: "https://www.upton.ca/dates-des-seances-du-conseil-et-proces-verbaux/"},
  {name: "Saint-Liboire", url: "https://www.st-liboire.ca/fr/ma-municipalite/conseil-municipal/proces-verbaux/"},
  {name: "Saint-Simon", url: "https://www.saint-simon.ca/proces-verbaux.html"},
  {name: "Saint-Valérien-de-Milton", url: "https://www.st-valerien-de-milton.qc.ca/proces-verbaux/"},
  {name: "Saint-Damase", url: "https://www.st-damase.qc.ca/proces-verbaux/"},
  {name: "Saint-Dominique", url: "https://www.municipalite.saint-dominique.qc.ca/"},
  {name: "Saint-Hugues", url: "https://www.saint-hugues.com/"},
  {name: "Saint-Barnabé-Sud", url: "https://saintbarnabesud.ca/Conseil-municipal/proces-verbaux/"},
  {name: "Maska", url: "https://www.mrcmaskoutains.qc.ca/odj-pv-conseil"},
  {name: "Saint-Jude", url: "https://www.saint-jude.ca/proces-verbaux.html"},
  {name: "Saint-Louis", url: "https://www.saint-louis.ca/"},
  {name: "Sainte-Marie-Madeleine", url: "https://sainte-marie-madeleine.ca/conseil-municipal/"},
  {name: "La Présentation", url: "https://www.municipalitelapresentation.qc.ca/proces-verbaux/"},
  {name: "Saint-Robert", url: "https://www.saintrobert.qc.ca/"},
  {name: "Saint-Aimé", url: "https://www.saintaime.qc.ca/"},
  {name: "Massueville", url: "http://massueville.net/"},
  {name: "Saint-Gérard-Majella", url: "https://saintgerardmajella.ca/?page=cons-proc"},
  {name: "Yamaska", url: "https://www.yamaska.ca/fr/municipalite/seances-du-conseil"},
  {name: "Saint-David", url: "https://www.stdavid.qc.ca/municipalite/seances-du-conseil-et-proces-verbaux/"},
  {name: "Saint-Michel-d'Yamaska", url: "https://www.yamaska.ca/fr/municipalite/seances-du-conseil"},
  {name: "Saint-Zéphirin-de-Courval", url: "https://www.saint-zephirin.ca/"},
  {name: "Baie-du-Febvre", url: "https://baie-du-febvre.net/"},
  {name: "Sainte-Monique", url: "https://www.sainte-monique.ca/"},
  {name: "Sainte-Eulalie", url: "https://www.municipalite.sainte-eulalie.qc.ca/pv/"},
  {name: "Fortierville", url: "https://www.fortierville.com/show.php?id=3222/seances_du_conseil"},
  {name: "Lemieux", url: "https://www.municipalitelemieux.ca/"},
  {name: "Sainte-Françoise", url: "https://ste-francoise.com/administration/proces-verbaux/"},
  {name: "Deschaillons-sur-Saint-Laurent", url: "https://www.deschaillons.ca/ordre-du-jour-et-proces-verbaux/"},
  {name: "Parisville", url: "https://www.municipalite.parisville.qc.ca/"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Quebec municipalities (batches 11-12-13)...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Quebec');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
  console.log(`\n🎯 Progress: 446/1000 Quebec municipalities (44.6%)`);
}
main().catch(console.error);
