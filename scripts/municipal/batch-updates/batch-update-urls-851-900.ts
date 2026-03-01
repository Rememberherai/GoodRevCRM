#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urlUpdates = [
  // Cities 914-935
  { name: 'Minnetonka', province: 'Minnesota', url: 'https://www.minnetonkamn.gov/government/city-meetings' },
  { name: 'Wheaton', province: 'Illinois', url: 'https://www.wheaton.il.us/AgendaCenter' }, // Already in 701-750
  { name: 'West Sacramento', province: 'California', url: 'https://meetings.cityofwestsacramento.org/OnBaseAgendaOnline' }, // Already in 701-750
  { name: 'Casa Grande', province: 'Arizona', url: 'https://www.casagrandeaz.gov/agendacenter' }, // Already in many batches
  { name: 'Normal', province: 'Illinois', url: 'https://www.normalil.gov/96/Agendas-Minutes-Reports' },
  { name: 'San Jacinto', province: 'California', url: 'https://www.sanjacintoca.gov/city_departments/city-clerk/city-council-meetings-and-planning-commission' }, // Already in 701-750
  { name: 'Novato', province: 'California', url: 'https://www.novato.gov/government/city-council/agendas-minutes-videos' }, // Already in 601-700
  { name: 'Pinellas Park', province: 'Florida', url: 'https://www.pinellas-park.com/AgendaCenter' },
  { name: 'Galveston', province: 'Texas', url: 'https://www.galvestontx.gov/AgendaCenter/City-Council-16' }, // Already in 701-750
  { name: 'Edina', province: 'Minnesota', url: 'https://edinamn.portal.civicclerk.com/' },
  { name: 'Herriman', province: 'Utah', url: 'https://www.herriman.gov/agendas-and-minutes' },
  { name: 'Elyria', province: 'Ohio', url: 'https://www.cityofelyria.org/elected-offices/city-council/meeting-dates/' }, // Already in 401-430
  { name: 'Grand Island', province: 'Nebraska', url: 'https://www.grand-island.com/page/city-council-agenda-packets' }, // Already in 601-700
  { name: 'Lacey', province: 'Washington', url: 'https://laceywa.portal.civicclerk.com/' },
  { name: 'Bentonville', province: 'Arkansas', url: 'https://bentonvillear.com/592/Agendas-Minutes' }, // Already in 601-700
  { name: 'Methuen Town', province: 'Massachusetts', url: 'https://www.cityofmethuen.org/government/city-council/agendas-minutes' },
  { name: 'West New York', province: 'New Jersey', url: 'https://www.westnewyorknj.org/meetings/' }, // Already in 601-700
  { name: 'Glendora', province: 'California', url: 'https://meetings.ci.glendora.ca.us/onbaseagendaonline' }, // Already in many batches
  { name: 'Smyrna', province: 'Tennessee', url: 'https://www.townofsmyrna.org/departments/legal/agendas_minutes/index.php' },
  { name: 'Florissant', province: 'Missouri', url: 'https://www.florissantmo.com/meetings/' },
  { name: 'Delano', province: 'California', url: 'https://www.cityofdelano.org/82/Minutes-Agendas' }, // Already in 601-700
  { name: 'Kannapolis', province: 'North Carolina', url: 'https://www.kannapolisnc.gov/government/city-council/agendas-minutes' },
  { name: 'Hoffman Estates', province: 'Illinois', url: 'https://www.hoffmanestates.org/government/agendas-minutes' },
  { name: 'Beaumont', province: 'California', url: 'https://www.ci.beaumont.ca.us/government/city-council/agendas-minutes' },
  { name: 'Placentia', province: 'California', url: 'https://www.placentia.org/agendacenter' }, // Already in many batches
  { name: 'Aliso Viejo', province: 'California', url: 'https://avcity.org/129/Agendas-Minutes' }, // Already in 601-700
  { name: 'Wheaton', province: 'Maryland', url: 'https://www.montgomerycountymd.gov/council/' }, // Wheaton MD is unincorporated
  { name: 'Cathedral City', province: 'California', url: 'https://www.cathedralcity.gov/government/city-council/agendas-minutes' },
  { name: 'Rosemead', province: 'California', url: 'https://www.cityofrosemead.org/government/city-council/agendas-minutes' }, // Already in 701-750
  { name: 'Burien', province: 'Washington', url: 'https://www.burienwa.gov/government/city-council/agendas-minutes' }, // Already in 401-430
  { name: 'Bozeman', province: 'Montana', url: 'https://www.bozeman.net/departments/city-commission' }, // Already in 501-600
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
