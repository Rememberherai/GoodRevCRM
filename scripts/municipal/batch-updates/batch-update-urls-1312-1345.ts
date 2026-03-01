#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 1312-1345
  // Unincorporated: Oakville MO, San Luis AZ, Owings Mills MD, Kaneohe HI, Montgomery Village MD
  // Fruit Cove FL, Fair Oaks VA, Dakota Ridge CO, Oildale CA, Prairieville LA, New City NY
  // Huntington Station NY, Merritt Island FL, Golden Glades FL

  { name: 'San Juan Capistrano', province: 'California', url: 'https://www.sanjuancapistrano.org/189/Public-Meetings' },
  { name: 'Midvale', province: 'Utah', url: 'https://www.midvalecity.org/agendas-minutes/' },
  { name: 'Brunswick', province: 'Ohio', url: 'https://www.brunswick.oh.us/city-council/' },
  { name: 'Salisbury', province: 'North Carolina', url: 'https://salisburync.gov/Government/City-Council/Minutes-and-Agendas' },
  { name: 'Tooele', province: 'Utah', url: 'https://tooelecity.org/our-government/city-council/agendas-minutes/' },
  { name: 'Watertown Town', province: 'Massachusetts', url: 'https://watertown-ma.gov/547/Agendas-Minutes' },
  { name: 'Greer', province: 'South Carolina', url: 'https://www.cityofgreer.org/page/council' },
  { name: 'Lake Stevens', province: 'Washington', url: 'https://www.lakestevenswa.gov/329/Agendas-Packets' },
  { name: 'Northbrook', province: 'Illinois', url: 'https://www.northbrook.il.us/480/Agendas-Minutes' },
  { name: 'College Park', province: 'Maryland', url: 'https://www.collegeparkmd.gov/agendacenter' },
  { name: 'University City', province: 'Missouri', url: 'https://www.ucitymo.org/28/City-Council-and-City-Clerk' },
  { name: 'North Ridgeville', province: 'Ohio', url: 'https://www.nridgeville.org/CityCouncil.aspx' },
  { name: 'Del Rio', province: 'Texas', url: 'https://www.cityofdelrio.com/government/city-council/agendas-minutes' },
  { name: 'Fair Lawn', province: 'New Jersey', url: 'https://www.fairlawn.org/meeting-schedule' },
  { name: 'Long Beach', province: 'New York', url: 'https://www.longbeachny.gov/councilmeetings' },
  { name: 'Goshen', province: 'Indiana', url: 'https://goshenindiana.org/government/city-council/' },
  { name: 'San Dimas', province: 'California', url: 'http://www.cityofsandimas.com/' },
  { name: 'Springville', province: 'Utah', url: 'https://www.springville.org/agendas-minutes/' },
  { name: 'Benton', province: 'Arkansas', url: 'https://www.bentonar.org/meetings' },
  { name: 'Hinesville', province: 'Georgia', url: 'https://www.cityofhinesville.org/106/Council-Meeting-Items' },
  { name: 'Socorro', province: 'Texas', url: 'https://www.soccorrotexas.org/' },
  { name: 'Richmond', province: 'Kentucky', url: 'https://www.richmond.ky.us/' },
  { name: 'Pleasant Hill', province: 'California', url: 'https://www.pleasanthillca.org/' },
  { name: 'University Place', province: 'Washington', url: 'https://www.upwa.gov/' },
  { name: 'Stow', province: 'Ohio', url: 'https://www.stowohio.gov/' },
  { name: 'Douglasville', province: 'Georgia', url: 'https://www.douglasvillega.gov/' },
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
