#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 101-110
  { name: 'Winter Haven', province: 'Florida', url: 'https://www.mywinterhaven.com/AgendaCenter' },
  { name: 'Scottsdale', province: 'Arizona', url: 'https://ww2.scottsdaleaz.gov/council/meeting-information/agendas-minutes' },
  { name: 'Norfolk', province: 'Virginia', url: 'https://www.norfolk.gov/AgendaCenter/City-Council-Agendas-25' },
  { name: 'Killeen', province: 'Texas', url: 'https://killeen.legistar.com/' },
  { name: 'York', province: 'Pennsylvania', url: 'https://www.yorkcity.org/government/city-council/agendas/' },
  { name: 'Atlantic City', province: 'New Jersey', url: 'https://www.acnj.gov/meetings' },
  { name: 'Nashua', province: 'New Hampshire', url: 'https://nashuanh.portal.civicclerk.com/' },
  { name: 'Arlington', province: 'Virginia', url: 'https://www.arlingtonva.us/Government/Departments/County-Board/County-Board-Meetings' },
  { name: 'Brownsville', province: 'Texas', url: 'https://www.brownsvilletx.gov/AgendaCenter' },
  { name: 'Fremont', province: 'California', url: 'https://www.fremont.gov/government/agenda-center/city-council' },

  // Cities 111-125
  { name: 'Gulfport', province: 'Mississippi', url: 'https://gulfportms.portal.civicclerk.com' },
  { name: 'Evansville', province: 'Indiana', url: 'https://www.evansvillegov.org/city/topic/subtopic.php?topicid=644&structureid=16' },
  { name: 'Hialeah', province: 'Florida', url: 'https://www.hialeahfl.gov/AgendaCenter/City-Council-9' },
  { name: 'North Port', province: 'Florida', url: 'https://cityofnorthport.legistar.com/' },
  { name: 'San Bernardino', province: 'California', url: 'https://www.sanbernardino.gov/720/Agendas-Minutes' },
  { name: 'Green Bay', province: 'Wisconsin', url: 'https://www.greenbaywi.gov/129/Meetings-Agendas-Minutes' },
  { name: 'Tacoma', province: 'Washington', url: 'https://tacoma.gov/i-want-to/city-council-agendas-minutes-and-meetings/' },
  { name: 'Gainesville', province: 'Florida', url: 'https://www.gainesvillefl.gov/Government-Pages/Government/Public-Meeting-Participation/New-Agendas-Minutes' },
  { name: 'Yonkers', province: 'New York', url: 'https://www.yonkersny.gov/agendacenter' },
  { name: 'Fontana', province: 'California', url: 'https://fontana.legistar.com/' },
  { name: 'Fargo', province: 'North Dakota', url: 'https://fargond.gov' },
  { name: 'Amarillo', province: 'Texas', url: 'https://www.amarillo.gov' },
  { name: 'Salinas', province: 'California', url: 'https://www.salinas.gov/Your-Government/Meetings-and-Agendas' },
  { name: 'Huntington Beach', province: 'California', url: 'https://huntingtonbeach.legistar.com/' },
  { name: 'Glendale', province: 'California', url: 'https://www.glendaleca.gov/government/public-meeting-portal' },

  // Cities 126-150
  { name: 'Grand Prairie', province: 'Texas', url: 'https://www.gptx.org/Government/Mayor-and-City-Council/City-Council-Meetings' },
  { name: 'Santa Barbara', province: 'California', url: 'https://santabarbaraca.gov/government/mayor-city-council/city-council-meetings' },
  { name: 'Overland Park', province: 'Kansas', url: 'https://www.opkansas.org' },
  { name: 'Deltona', province: 'Florida', url: 'https://www.deltonafl.gov' },
  { name: 'Kalamazoo', province: 'Michigan', url: 'https://www.kalamazoocity.org/Government/Boards-Commissions/Minutes-Agendas' },
  { name: 'Thousand Oaks', province: 'California', url: 'https://toaks.gov/citycouncil' },
  { name: 'Hickory', province: 'North Carolina', url: 'https://www.hickorync.gov' },
  { name: 'Moreno Valley', province: 'California', url: 'https://moval.gov/city_council/agendas.html' },
  { name: 'College Station', province: 'Texas', url: 'http://agenda.cstx.gov/' },
  { name: 'Olympia', province: 'Washington', url: 'https://www.olympiawa.gov/government/agendas_minutes.php' },
  { name: 'Waterbury', province: 'Connecticut', url: 'https://www.waterburyct.org/content/9565/458/4301/default.aspx' },
  { name: 'Norwich', province: 'Connecticut', url: 'https://www.norwichct.gov/AgendaCenter' },
  { name: 'Huntington', province: 'West Virginia', url: 'https://www.huntingtonwv.gov' },
  { name: 'Clarksville', province: 'Tennessee', url: 'https://www.clarksvilletn.gov/AgendaCenter/City-Council-3' },
  { name: 'Sunrise Manor', province: 'Nevada', url: 'https://www.clarkcountynv.gov' },
  { name: 'Hagerstown', province: 'Maryland', url: 'https://hagerstown.novusagenda.com/agendapublic/' },
];

async function batchUpdate() {
  console.log(`\n💾 Batch Updating ${urlUpdates.length} Municipality URLs\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const update of urlUpdates) {
    const { data, error } = await supabase
      .from('municipalities')
      .update({
        minutes_url: update.url,
        scan_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('name', update.name)
      .eq('province', update.province)
      .eq('country', 'USA')
      .select('id');

    if (error) {
      console.error(`❌ ${update.name}, ${update.province}:`, error.message);
      errorCount++;
    } else if (!data || data.length === 0) {
      console.error(`❌ ${update.name}, ${update.province}: Not found in database`);
      errorCount++;
    } else {
      console.log(`✅ ${update.name}, ${update.province}`);
      successCount++;
    }
  }

  console.log(`\n==================================`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`==================================\n`);
}

batchUpdate().catch(console.error);
