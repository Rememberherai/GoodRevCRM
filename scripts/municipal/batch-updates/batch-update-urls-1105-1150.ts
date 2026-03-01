#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1105-1150
  // Unincorporated: Channelview TX, Linton Hall VA, Woodlawn MD, Annandale VA
  // Maplewood MN, North Fort Myers FL, Coram NY, The Acreage FL, Essex MD

  { name: 'Danville', province: 'Virginia', url: 'http://www.danvilleva.gov/387/Agendas-Minutes' },
  { name: 'Pahrump', province: 'Nevada', url: 'https://pahrumpnv.org/AgendaCenter' },
  { name: 'Belleville', province: 'Illinois', url: 'https://belleville.net/AgendaCenter' },
  { name: 'Beverly', province: 'Massachusetts', url: 'https://www.beverlyma.gov/AgendaCenter' },
  { name: 'Midland', province: 'Michigan', url: 'https://cityofmidlandmi.gov/1462/City-Council-Agendas-Minutes' },
  { name: 'Coppell', province: 'Texas', url: 'https://www.coppelltx.gov/1064/Agendas-Minutes' },
  { name: 'Puyallup', province: 'Washington', url: 'https://www.cityofpuyallup.org/agendacenter' },
  { name: 'Rancho Palos Verdes', province: 'California', url: 'https://www.rpvca.gov/772/City-Meeting-Video-and-Agendas' },
  { name: 'Coachella', province: 'California', url: 'https://www.coachella.org/city-government/city-council/agendas-and-minutes' },
  { name: 'Peachtree Corners', province: 'Georgia', url: 'https://www.peachtreecornersga.gov/AgendaCenter' },
  { name: 'Pine Bluff', province: 'Arkansas', url: 'https://www.cityofpinebluff.com/' },
  { name: 'Spanish Fork', province: 'Utah', url: 'https://go.boarddocs.com/ut/spanishfork/Board.nsf' },
  { name: 'Fitchburg', province: 'Massachusetts', url: 'https://www.fitchburgma.gov/AgendaCenter' },
  { name: 'Kearny', province: 'New Jersey', url: 'https://www.kearnynj.org/council-meeting-agendas/' },
  { name: 'Mableton', province: 'Georgia', url: 'https://mabletonga.portal.civicclerk.com/' },
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
