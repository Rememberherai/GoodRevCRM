#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batch1Updates = [
  {name: "Addington Highlands, Township of", url: "https://addingtonhighlands.civicweb.net/Portal/Welcome.aspx"},
  {name: "Adelaide-Metcalfe, Township of", url: "https://www.adelaidemetcalfe.on.ca/council/council-meetings"},
  {name: "Adjala-Tosorontio, Township of", url: "https://www.adjtos.ca/en/our-government/agends-and-minutes.aspx"},
  {name: "Admaston/Bromley, Township of", url: "https://admastonbromley.com/committee-agendas-minutes/"},
  {name: "Ajax, Town of", url: "https://events.ajax.ca/meetings"},
  {name: "Alberton, Township of", url: "https://alberton.ca/council-minutes/"},
  {name: "Alfred and Plantagenet, Township of", url: "https://www.alfred-plantagenet.com/en/government-administration/council-council-meetings/agenda-minutes-videos"},
  {name: "Algonquin Highlands, Township of", url: "https://www.algonquinhighlands.ca/municipal-services/council/agendas-and-minutes/"},
  {name: "Alnwick/Haldimand, Township of", url: "https://alnwickhaldimand.civicweb.net/Portal/Welcome.aspx"},
  {name: "Amaranth, Township of", url: "https://www.amaranth.ca/municipal-government/council-agenda-minutes/"},
  {name: "Amherstburg, Town of", url: "https://calendar.amherstburg.ca/council"},
  {name: "Armour, Township of", url: "https://www.armourtownship.ca/agenda-and-minutes"},
  {name: "Armstrong, Township of", url: "https://armstrongtownship.com/en/government/council-meetings"},
  {name: "Arnprior, Town of", url: "https://arnprior.ca/town/council/agenda-and-minutes/"},
  {name: "Arran-Elderslie, Municipality of", url: "https://calendar.arran-elderslie.ca/meetings"},
  {name: "Ashfield-Colborne-Wawanosh, Township of", url: "https://acwtownship.ca/government/agendas-minutes"},
  {name: "Asphodel-Norwood, Township of", url: "https://calendar.antownship.ca/council"},
  {name: "Assiginack, Township of", url: "https://www.assiginack.ca/council-meetings/"},
  {name: "Augusta, Township of", url: "https://augusta.ca/clerk-services/"},
  {name: "Aurora, Town of", url: "https://www.aurora.ca/your-government/council-and-committees/agendas-and-minutes/"},
  {name: "Aylmer, Town of", url: "https://aylmer.ca/town-hall/council-agendas-and-minutes/"},
  {name: "Baldwin, Township of", url: "https://baldwin.ca/council-meeting-agendas/"},
  {name: "Bancroft, Town of", url: "https://bancroft.civicweb.net/portal/"},
  {name: "Bayham, Municipality of", url: "https://www.bayham.on.ca/governance/council/agendas-minutes/"},
  {name: "Beckwith, Township of", url: "https://beckwith.ca/local-government/council-committees-meetings/"},
  {name: "Billings, Township of", url: "https://www.billingstwp.ca/townhall/mayor-and-council/agendas-and-minutes/"},
  {name: "Black River-Matheson, Township of", url: "https://www.twpbrm.ca/your-township-government/agendas-minutes-and-recordings/"},
  {name: "Blandford-Blenheim, Township of", url: "https://www.blandfordblenheim.ca/my-government/agendas-and-minutes/"},
  {name: "Blind River, Town of", url: "https://www.blindriver.ca/en/town-hall/agendas-and-minutes.aspx"},
  {name: "Bluewater, Municipality of", url: "https://bluewater.civicweb.net/Portal/"},
  {name: "Bonfield, Township of", url: "https://www.bonfieldtownship.com/your-government/mayor-council/"},
  {name: "Bonnechere Valley, Township of", url: "https://www.bonnecherevalleytwp.com/council-and-staff/agenda/"},
  {name: "Bracebridge, Town of", url: "https://bracebridge.civicweb.net/portal/"},
  {name: "Bradford West Gwillimbury, Town of", url: "https://www.townofbwg.com/en/town-hall/council-meetingsagendasminutes.aspx"},
  {name: "Brant, County of", url: "https://www.brant.ca/en/council-and-council-administration/council-and-committee-calendar.aspx"},
  {name: "Brighton, Municipality of", url: "https://www.brighton.ca/en/municipal-services/agendas-and-minutes.aspx"},
  {name: "Brock, Township of", url: "https://www.townshipofbrock.ca/en/municipal-office/council-calendar.aspx"},
  {name: "Brockton, Municipality of", url: "https://www.brockton.ca/municipal-government/mayor-and-council/agendas-and-minutes/"},
  {name: "Brooke-Alvinston, Municipality of", url: "https://brookealvinston.com/town-hall/2024-council-agendas-minutes/"},
  {name: "Bruce, County of", url: "https://www.brucecounty.on.ca/government/agendas-and-minutes"},
  {name: "Brudenell, Lyndoch and Raglan, Township of", url: "https://blrtownship.ca/article/committee-meetings-agendas-and-minutes/"},
  {name: "Burk's Falls, Village of", url: "https://www.burksfalls.net/townhall/council/agenda-minutes"},
  {name: "Burpee and Mills, Township of", url: "https://www.burpeemills.com/municipality/previous-council-meetings"},
  {name: "Caledon, Town of", url: "https://www.caledon.ca/en/government/agendas-and-minutes.aspx"},
  {name: "Callander, Municipality of", url: "https://www.mycallander.ca/en/local-government/meetings"},
  {name: "Calvin, Municipality of", url: "https://calvintownship.ca/en/council-and-council-business/council/meetings-agendas"},
  {name: "Carleton Place, Town of", url: "https://carletonplace.ca/town/town-council/council-meetings-and-agendas"}
];

async function main() {
  console.log(`\n📥 Updating ${batch1Updates.length} Ontario municipalities with minutes URLs...\n`);

  let updated = 0;
  let notFound = 0;

  for (const item of batch1Updates) {
    const { error } = await supabase
      .from('municipalities')
      .update({
        minutes_url: item.url,
        scan_status: 'pending'
      })
      .eq('name', item.name)
      .eq('province', 'Ontario');

    if (error) {
      console.error(`   ❌ Error updating ${item.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Updated: ${item.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Errors: ${batch1Updates.length - updated}`);
}

main().catch(console.error);
