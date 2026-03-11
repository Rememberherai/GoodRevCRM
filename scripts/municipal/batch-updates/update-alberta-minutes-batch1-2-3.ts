#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchUpdates = [
  // Batch 1
  {name: "Athabasca", url: "https://www.athabasca.ca/p/agendas-and-meeting-minutes"},
  {name: "Barrhead", url: "https://www.barrhead.ca/p/minutes-agendas"},
  {name: "Bashaw", url: "https://www.townofbashaw.com/municipal/council/council-information"},
  {name: "Bassano", url: "https://bassano.ca/council-agenda-minutes/"},
  {name: "Bentley", url: "https://townofbentley.ca/town-office/council/meetings-agendas/"},
  {name: "Bon Accord", url: "https://bonaccord.ca/council-meetings"},
  {name: "Bonnyville", url: "https://town.bonnyville.ab.ca/town-council/"},
  {name: "Bow Island", url: "https://bowisland.com/agendas-minutes"},
  {name: "Bowden", url: "https://bowden2020app.municipalwebsites.ca/p/council-meeting-minutes"},
  {name: "Bruderheim", url: "https://www.bruderheim.ca/council-meetings"},
  {name: "Calmar", url: "https://calmar.ca/government/council/council-meetings/"},
  {name: "Cardston", url: "https://www.cardston.ca/government/town-council/council-meetings"},
  {name: "Carstairs", url: "https://carstairs.ca/p/agendas-and-minutes"},
  {name: "Castor", url: "http://castor.ca/council-minutes"},
  {name: "Claresholm", url: "https://www.claresholm.ca/government/agendas-meetings/council-meeting-minutes"},
  {name: "Coaldale", url: "https://www.coaldale.ca/towncouncil"},
  {name: "Coalhurst", url: "https://coalhurst.ca/government/council-committee-meetings/"},
  {name: "Coronation", url: "https://www.coronation.ca/your-municipality/council-meetings"},
  {name: "Crossfield", url: "https://www.crossfieldalberta.com/p/council-meetings"},
  {name: "Daysland", url: "https://daysland.ca/administration/documents-downloads/"},

  // Batch 2
  {name: "Devon", url: "https://www.devon.ca/Government/Town-Hall/Council-Meetings/Council-Agendas"},
  {name: "Diamond Valley", url: "https://www.diamondvalley.town/460/Agenda-Packages"},
  {name: "Didsbury", url: "https://www.didsbury.ca/p/council-meetings"},
  {name: "Drayton Valley", url: "https://www.draytonvalley.ca/council-meeting-agendas-and-minutes/"},
  {name: "Drumheller", url: "https://www.drumheller.ca/your-municipality/meeting-agendas-minutes"},
  {name: "Eckville", url: "https://www.eckville.com/town/files"},
  {name: "Edson", url: "https://www.edson.ca/government/town-council"},
  {name: "Elk Point", url: "https://www.elkpoint.ca/governance/council-agendas/"},
  {name: "Fairview", url: "https://www.fairview.ca/government/minutes-and-agendas/"},
  {name: "Falher", url: "https://falher.ca/council-minutes/"},
  {name: "Fort Macleod", url: "https://www.fortmacleod.com/your-municipality/meeting-agendas-minutes"},
  {name: "Fox Creek", url: "https://foxcreek.ca/government/mayor-council/meet-your-council/"},
  {name: "Gibbons", url: "https://www.gibbons.ca/town-hall/meetings"},
  {name: "Grimshaw", url: "https://grimshaw.ca/"},
  {name: "Hanna", url: "https://hanna.ca/council-meetings"},
  {name: "Hardisty", url: "https://hardisty.civicweb.net/portal/"},
  {name: "High Level", url: "https://www.highlevel.ca/agendacenter"},
  {name: "High Prairie", url: "https://www.highprairie.ca/p/council-meetings"},
  {name: "Hinton", url: "https://www.hinton.ca/89/Council-Information"},
  {name: "Innisfail", url: "https://innisfail.ca/council/council-meetings/"},

  // Batch 3
  {name: "Irricana", url: "https://townofirricana.ca/municipal-government/"},
  {name: "Killam", url: "https://www.town.killam.ab.ca/municipal-info/council-boards-admin/agendas-minutes"},
  {name: "Lamont", url: "https://www.lamont.ca/townhall/agenda-and-minutes"},
  {name: "Legal", url: "https://www.legal.ca/government/council/meetings"},
  {name: "Magrath", url: "https://www.magrath.ca/council-meeting-agendas"},
  {name: "Manning", url: "https://manning.ca/council/agenda/"},
  {name: "Mayerthorpe", url: "https://www.mayerthorpe.ca/engage/minutes"},
  {name: "McLennan", url: "https://mclennan.ca/town-hall/"},
  {name: "Milk River", url: "https://www.milkriver.ca/p/agendas-minutes"},
  {name: "Millet", url: "https://www.millet.ca/government/council-agenda-minutes"},
  {name: "Mundare", url: "https://www.mundare.ca/town-hall/council"},
  {name: "Nanton", url: "https://www.nanton.ca/government/legislative-services/agendas-and-minutes"},
  {name: "Nobleford", url: "https://nobleford.ca/p/minutes-and-agendas"},
  {name: "Olds", url: "https://www.olds.ca/councilmeetings"},
  {name: "Onoway", url: "https://www.onoway.ca/town/council-minutes"},
  {name: "Oyen", url: "https://townofoyen.com/p/agendas-minutes"},
  {name: "Peace River", url: "https://www.peaceriver.ca/town-hall/town-council/agendas-minutes"},
  {name: "Penhold", url: "https://www.townofpenhold.ca/p/meeting-minutes-and-agendas"},
  {name: "Picture Butte", url: "https://www.picturebutte.ca/"},
  {name: "Pincher Creek", url: "http://www.pinchercreek.ca/town/minutes.php"}
];

async function main() {
  console.log(`\n📥 Updating ${batchUpdates.length} Alberta municipalities...\n`);
  let updated = 0;
  for (const item of batchUpdates) {
    const { error } = await supabase.from('municipalities').update({minutes_url: item.url, scan_status: 'pending'}).eq('name', item.name).eq('province', 'Alberta');
    if (!error) { console.log(`   ✅ ${item.name}`); updated++; }
    else { console.error(`   ❌ ${item.name}: ${error.message}`); }
  }
  console.log(`\n📊 ✅ Updated: ${updated}/${batchUpdates.length}`);
}
main().catch(console.error);
