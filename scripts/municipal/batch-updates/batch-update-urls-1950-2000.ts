#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1850-1900
  // Unincorporated/CDPs: Socastee SC, Carolina Forest SC, North Lynnwood WA,
  // Landover MD, Bailey's Crossroads VA, Fish Hawk FL, North Potomac MD,
  // Rosemont CA, North Laurel MD, Westchase FL, Elkridge MD

  { name: 'Zion', province: 'Illinois', url: 'https://www.cityofzion.com/city-clerk/meetings/' },
  { name: 'Collinsville', province: 'Illinois', url: 'https://www.collinsvilleil.org/government/city-council' },
  { name: 'Greenbelt', province: 'Maryland', url: 'https://www.greenbeltmd.gov/129/Agendas-Minutes' },
  { name: 'Sugar Hill', province: 'Georgia', url: 'https://cityofsugarhill.com/agendas-and-minutes/' },
  { name: 'Corsicana', province: 'Texas', url: 'https://www.cityofcorsicana.com/agendacenter' },
  { name: 'Herndon', province: 'Virginia', url: 'https://www.herndon-va.gov/departments/town-clerk/agendas-minutes-webcasts' },
  { name: 'Bainbridge Island', province: 'Washington', url: 'https://www.bainbridgewa.gov/1101/City-Council-Agendas' },
  { name: 'Selma', province: 'California', url: 'https://www.cityofselma.com/government/city_council/council_meetings___agendas.php' },
  { name: 'Avon', province: 'Ohio', url: 'https://www.cityofavon.com/AgendaCenter' },
  { name: 'White Bear Lake', province: 'Minnesota', url: 'https://www.whitebearlake.org/meetings/recent?boards-commissions=98' },
  { name: 'Elmwood Park', province: 'Illinois', url: 'https://elmwoodpark.org/129/Board-Meetings' },
  { name: 'Athens', province: 'Ohio', url: 'https://www.ci.athens.oh.us/612/Meetings-Agendas-Minutes' },
  { name: 'Ponca City', province: 'Oklahoma', url: 'https://poncacityok.gov/94/City-Commission' },
  { name: 'Paris', province: 'Texas', url: 'https://www.paristexas.gov/AgendaCenter' },
  { name: 'Decatur', province: 'Georgia', url: 'https://www.decaturga.com/citycommission/page/city-commission-agendasminutes' },
  { name: 'Ridgeland', province: 'Mississippi', url: 'https://www.ridgelandms.org/meetings-and-minutes/' },
  { name: 'Palmetto Bay', province: 'Florida', url: 'https://www.palmettobay-fl.gov/1419/Meeting-Central-Agendas-Minutes-Videos' },
  { name: 'Denison', province: 'Texas', url: 'https://www.denisontx.gov/352/Agendas-Minutes' },
  { name: 'Faribault', province: 'Minnesota', url: 'https://www.ci.faribault.mn.us/408/Meeting-Materials-and-Videos' },
  { name: 'Rolling Meadows', province: 'Illinois', url: 'https://www.cityrm.org/AgendaCenter' },
  { name: 'Centerville', province: 'Ohio', url: 'https://www.centervilleohio.gov/418/Agendas-Minutes-Legislation' },
  { name: 'Oak Harbor', province: 'Washington', url: 'https://www.oakharbor.org/clerk/page/presentations-proclamations' },
  { name: 'Kalispell', province: 'Montana', url: 'https://www.kalispell.com/AgendaCenter' },
  { name: 'South Plainfield', province: 'New Jersey', url: 'https://www.southplainfieldnj.com/spnj/Council%20Agendas/' },
  { name: 'Benbrook', province: 'Texas', url: 'https://benbrook-tx.gov/AgendaCenter' },
  { name: 'Auburn Hills', province: 'Michigan', url: 'https://www.auburnhills.org/government/mayor-city-council/meeting-minutes-agendas/' },
  { name: 'Burlington', province: 'Iowa', url: 'https://www.burlingtoniowa.org/2361/Meeting-Videos-Agendas-Minutes' },
  { name: 'Pelham', province: 'Alabama', url: 'https://pelhamonline.com/city-government/boards-committees/' },
  { name: 'Freeport', province: 'Illinois', url: 'https://cityoffreeport.org/events/city-council-meeting/' },
  { name: 'San Fernando', province: 'California', url: 'https://ci.san-fernando.ca.us/city-council/city-council-archive-agendas-minutes/' },
  { name: 'Kerrville', province: 'Texas', url: 'https://www.kerrvilletx.gov/1035/Agendas-and-Minutes' },
  { name: 'Solon', province: 'Ohio', url: 'https://www.solonohio.org/Archive.aspx?AMID=36' },
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
