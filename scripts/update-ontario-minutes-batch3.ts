#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batch3Updates = [
  {name: "Englehart, Town of", url: "http://www.englehart.ca/p/englehart-municipal-council"},
  {name: "Erin, Town of", url: "https://www.erin.ca/town-hall/town-council/meetings-and-agendas"},
  {name: "Essa, Township of", url: "https://www.essatownship.on.ca/council-administration/agendas-and-minutes/"},
  {name: "Essex, Town of", url: "http://www.essex.ca/en/town-hall/agendasandminutes.aspx"},
  {name: "Faraday, Township of", url: "https://faraday.ca/council/minutes/"},
  {name: "Fort Frances, Town of", url: "https://fortfrances.civicweb.net/Portal/MeetingInformation.aspx?Id=2068"},
  {name: "French River, Municipality of", url: "http://www.frenchriver.ca/p/council-minutes-agendas"},
  {name: "Frontenac Islands, Township of", url: "https://frontenacislands.community-ca.diligentoneplatform.com"},
  {name: "Gananoque, Town of", url: "http://www.gananoque.ca/town-hall/town-council/council-meetings"},
  {name: "Georgian Bay, Township of", url: "http://www.gbtownship.ca/en/township-hall/agendas-and-minutes.aspx"},
  {name: "Georgian Bluffs, Township of", url: "https://events.georgianbluffs.ca/council"},
  {name: "Gore Bay, Town of", url: "https://gorebay.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Grand Valley, Town of", url: "http://www.townofgrandvalley.ca/municipal-government/mayor-and-council/council-and-committee-calendar/"},
  {name: "Gravenhurst, Town of", url: "https://events.gravenhurst.ca/meetings/"},
  {name: "Greater Madawaska, Township of", url: "https://www.greatermadawaska.com/township/agendas-and-minutes/"},
  {name: "Greater Napanee, Town of", url: "https://greaternapanee.civicweb.net/Portal/?_mid_=10535"},
  {name: "Greater Sudbury, City of", url: "https://www.greatersudbury.ca/agendas"},
  {name: "Greenstone, Municipality of", url: "https://greenstone.civicweb.net/Portal/"},
  {name: "Grey, County of", url: "http://www.grey.ca/government/council-meetings-administration/agendas-and-minutes"},
  {name: "Grey Highlands, Municipality of", url: "https://greyhighlands.civicweb.net/Portal/"},
  {name: "Grimsby, Town of", url: "http://www.grimsby.ca/town-hall/agendas-and-minutes/"},
  {name: "Guelph, City of", url: "http://www.guelph.ca/city-hall/mayor-and-council/city-council/agendas-and-minutes/"},
  {name: "Guelph/Eramosa, Township of", url: "http://www.get.on.ca/township-services/committee/mayor-and-council/meetings"},
  {name: "Haliburton, County of", url: "http://www.haliburtoncounty.ca/en/council/agendas-and-minutes.aspx"},
  {name: "Hamilton, City of", url: "https://pub-hamilton.escribemeetings.com/"},
  {name: "Hamilton, Township of", url: "https://www.hamiltontownship.ca/your-municipal-government/agendas-minutes-and-meetings/"},
  {name: "Hanover, Town of", url: "http://www.hanover.ca/council-government/mayor-council/council-and-committee-meetings"},
  {name: "Hastings Highlands, Municipality of", url: "https://hastingshighlands.civicweb.net/Portal/"},
  {name: "Head, Clara and Maria, Township of", url: "https://www.headclaramaria.ca/council-and-staff/agenda-reports-to-council/"},
  {name: "Hearst, Town of", url: "https://www.hearst.ca/en/town-hall/municipal-council/meeting-documentation/"},
  {name: "Highlands East, Municipality of", url: "https://highlandseast.civicweb.net/Portal/MeetingTypeList.aspx"},
  {name: "Hilton, Township of", url: "https://www.hiltontownship.ca/agendas/"},
  {name: "Howick, Township of", url: "https://www.howick.ca/agendas-minutes"},
  {name: "Huntsville, Town of", url: "https://events.huntsville.ca/meetings"},
  {name: "Huron East, Municipality of", url: "http://www.huroneast.com/your-government/agendas-and-minutes/"},
  {name: "Huron Shores, Municipality of", url: "https://huronshores.ca/your-government/council/escribe-minutes-calendar/"},
  {name: "Huron-Kinloss, Township of", url: "https://events.huronkinloss.com/meetings"},
  {name: "Ignace, Township of", url: "https://ignace.civicweb.net/Portal/Default.aspx"},
  {name: "Ingersoll, Town of", url: "http://www.ingersoll.ca/town-hall/council-agendas-and-minutes/"},
  {name: "Johnson, Township of", url: "https://johnsontownship.ca/council/council-meetings/"},
  {name: "Kapuskasing, Town of", url: "http://www.kapuskasing.ca/council-administration/agendas-and-minutes/"},
  {name: "Kenora, City of", url: "http://www.kenora.ca/your-government/agenda-and-minutes/"},
  {name: "Killarney, Municipality of", url: "http://www.killarney.ca/p/meeting-minutes"},
  {name: "Kincardine, Municipality of", url: "https://www.kincardine.ca/our-services/council-and-meetings/"},
  {name: "King, Township of", url: "http://www.king.ca/meetings"},
  {name: "Kingsville, Town of", url: "https://calendar.kingsville.ca/council"},
  {name: "Lambton, County of", url: "https://calendar.lambtononline.ca/meetings"},
  {name: "Lanark Highlands, Township of", url: "http://www.lanarkhighlands.ca/lh-town-hall/agendas-minutes/agendas-and-minutes-2022-present"},
  {name: "Larder Lake, Township of", url: "https://www.larderlake.ca/government/meetings-and-agendas/"},
  {name: "Latchford, Town of", url: "https://www.latchford.ca/upcoming-council-agenda/"},
  {name: "Leamington, Municipality of", url: "https://events.leamington.ca/meetings"},
  {name: "Leeds and Grenville, United Counties of", url: "https://www.leedsgrenville.com/en/government/agendas-minutes-and-video.aspx"},
  {name: "Lincoln, Town of", url: "http://www.lincoln.ca/meetings"},
  {name: "London, City of", url: "http://london.ca/government/council-civic-administration/council-committee-meetings"},
  {name: "Loyalist, Township of", url: "https://www.loyalist.ca/council-and-administration/agendas-and-minutes/"}
];

async function main() {
  console.log(`\n📥 Updating ${batch3Updates.length} Ontario municipalities with minutes URLs...\n`);

  let updated = 0;

  for (const item of batch3Updates) {
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
}

main().catch(console.error);
