#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batch2Updates = [
  {name: "Cambridge, City of", url: "https://www.cambridge.ca/en/your-city/Agendas-and-Minutes.aspx"},
  {name: "Carling, Township of", url: "https://carling.ca/municipal-information/info-about-carling-council/agenda-and-minutes/"},
  {name: "Carlow/Mayo, Township of", url: "https://carlowmayo.ca/council/council-meetings-agendas/"},
  {name: "Casselman, Municipality of", url: "https://www.casselman.ca/en"},
  {name: "Cavan Monaghan, Township of", url: "https://www.cavanmonaghan.net/en/local-government/agendas-and-minutes.aspx"},
  {name: "Central Elgin, Municipality of", url: "https://centralelgin.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Central Frontenac, Township of", url: "https://www.centralfrontenac.com/en/township-office/agendas-and-minutes.aspx"},
  {name: "Central Huron, Municipality of", url: "https://centralhuron.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Central Manitoulin, Municipality of", url: "https://www.centralmanitoulin.ca/our-government/council/agendas-and-minutes/"},
  {name: "Centre Hastings, Municipality of", url: "https://www.centrehastings.com/our-municipality/council/agendas-and-minutes/"},
  {name: "Centre Wellington, Township of", url: "https://centrewellington.civicweb.net/portal/"},
  {name: "Champlain, Township of", url: "https://www.champlain.ca/en/township-services/agenda-and-minutes.aspx"},
  {name: "Chapleau, Township of", url: "https://chapleau.ca/township/administration/council-agenda-minutes/"},
  {name: "Chatham-Kent, Municipality of", url: "https://www.chatham-kent.ca/localgovernment/council/meetings/Pages/Council-Meetings.aspx"},
  {name: "Chatsworth, Township of", url: "https://chatsworth.ca/government/council/"},
  {name: "Chisholm, Township of", url: "https://www.chisholm.ca/en/your-government/meetings-agendas"},
  {name: "Clarington, Municipality of", url: "https://www.clarington.net/en/town-hall/council-meeting-calendar.aspx"},
  {name: "Clearview, Township of", url: "https://www.clearview.ca/government-committees/council/agenda-minutes"},
  {name: "Cobalt, Town of", url: "https://cobalt.ca/residents/mayor-council/"},
  {name: "Cobourg, Town of", url: "https://pub-cobourg.escribemeetings.com/"},
  {name: "Cochrane, Town of", url: "https://www.cochrane.ca/government/council/council-meetings"},
  {name: "Cochrane, District of", url: "https://www.cochrane.ca/government/council/council-meetings"},
  {name: "Cockburn Island, Township of", url: "https://cockburnisland.ca/council.php"},
  {name: "Coleman, Township of", url: "https://www.colemantownship.ca/"},
  {name: "Collingwood, Town of", url: "https://www.collingwood.ca/agendas-minutes"},
  {name: "Conmee, Township of", url: "https://conmee.com/p/council"},
  {name: "Cornwall, City of", url: "https://www.cornwall.ca/en/city-hall/council-meetings.aspx"},
  {name: "Cramahe, Township of", url: "https://www.cramahe.ca/municipal-government/clerks/agendas-minutes/"},
  {name: "Dawn-Euphemia, Township of", url: "https://dawneuphemia.ca/council-committees/council-meeting-agendas-and-minutes/"},
  {name: "Dawson, Township of", url: "https://www.dawsontownship.ca/"},
  {name: "Deep River, Town of", url: "https://www.deepriver.ca/council/agendas"},
  {name: "Deseronto, Town of", url: "https://www.deseronto.ca/council-minutes"},
  {name: "Dorchester, Township of", url: "https://dorchester.ca/village-hall/council-minutes/"},
  {name: "Douro-Dummer, Township of", url: "https://www.dourodummer.ca/en/council-and-governance/agendas-and-minutes.aspx"},
  {name: "Drummond/North Elmsley, Township of", url: "https://www.dnetownship.ca/township-services/council/council-and-committee-calendar"},
  {name: "Dryden, City of", url: "https://www.dryden.ca/en/city-services/agendas-and-minutes.aspx"},
  {name: "Dubreuilville, Township of", url: "https://dubreuilville.ca/en/town-hall/mayor-council/municipal-council-meeting-agendas-minutes/"},
  {name: "Dufferin, County of", url: "https://www.dufferincounty.ca/council/"},
  {name: "Dysart et al, Municipality of", url: "https://dysartetal.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "East Ferris, Municipality of", url: "https://eastferris.ca/en/your-government/meetings-agendas"},
  {name: "East Garafraxa, Township of", url: "https://calendar.eastgarafraxa.ca/council/Index"},
  {name: "East Gwillimbury, Town of", url: "https://eastgwillimbury.civicweb.net/Portal/"},
  {name: "East Hawkesbury, Township of", url: "https://www.easthawkesbury.ca/en/township-hall/council-and-council-meetings/agendas-minutes-and-videos/"},
  {name: "East Zorra-Tavistock, Township of", url: "https://www.ezt.ca/en/township-office/agendas-and-minutes.aspx"},
  {name: "Edwardsburgh/Cardinal, Township of", url: "https://calendar.twpec.ca/meetings"},
  {name: "Elizabethtown-Kitley, Township of", url: "https://ektwp.ca/government/council/"},
  {name: "Elliot Lake, City of", url: "https://www.elliotlake.ca/en/city-hall/agendas-and-minutes.aspx"}
];

async function main() {
  console.log(`\n📥 Updating ${batch2Updates.length} Ontario municipalities with minutes URLs...\n`);

  let updated = 0;

  for (const item of batch2Updates) {
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
  console.log(`   ❌ Errors: ${batch2Updates.length - updated}`);
}

main().catch(console.error);
