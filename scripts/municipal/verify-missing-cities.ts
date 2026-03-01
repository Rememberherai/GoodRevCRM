#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import all batch files to check which cities were supposed to be uploaded
const batch401_430 = [
  { name: 'Rancho Cordova', province: 'California' },
  { name: 'Santa Maria', province: 'California' },
  { name: 'Georgetown', province: 'Texas' },
  { name: 'St. Charles', province: 'Missouri' },
  { name: 'Lake Havasu City', province: 'Arizona' },
  { name: 'Alameda', province: 'California' },
  { name: 'Burien', province: 'Washington' },
  { name: 'Jupiter', province: 'Florida' },
  { name: 'Tigard', province: 'Oregon' },
  { name: 'Danbury', province: 'Connecticut' },
  { name: 'Dunwoody', province: 'Georgia' },
  { name: 'Jurupa Valley', province: 'California' },
  { name: 'Berwyn', province: 'Illinois' },
  { name: 'Morgan Hill', province: 'California' },
  { name: 'Calexico', province: 'California' },
  { name: 'Dubuque', province: 'Iowa' },
  { name: 'East Orange', province: 'New Jersey' },
  { name: 'Blaine', province: 'Minnesota' },
  { name: 'Huntington Park', province: 'California' },
  { name: 'North Port', province: 'Florida' },
  { name: 'Royal Oak', province: 'Michigan' },
  { name: 'Paramount', province: 'California' },
  { name: 'Elyria', province: 'Ohio' },
  { name: 'Norwich', province: 'Connecticut' },
  { name: 'Coachella', province: 'California' },
  { name: 'Cedar Rapids', province: 'Iowa' },
  { name: 'Olympia', province: 'Washington' },
  { name: 'Brookfield', province: 'Wisconsin' },
  { name: 'Prescott Valley', province: 'Arizona' },
  { name: 'Bell', province: 'California' },
];

const batch431_460 = [
  { name: 'Everett', province: 'Massachusetts' },
  { name: 'Mishawaka', province: 'Indiana' },
  { name: 'Apple Valley', province: 'California' },
  { name: 'Summerville', province: 'South Carolina' },
  { name: 'Sheboygan', province: 'Wisconsin' },
  { name: 'West Haven', province: 'Connecticut' },
  { name: 'Iowa City', province: 'Iowa' },
  { name: 'Perth Amboy', province: 'New Jersey' },
  { name: 'Woodland', province: 'California' },
  { name: 'North Little Rock', province: 'Arkansas' },
  { name: 'Weymouth', province: 'Massachusetts' },
  { name: 'Battle Creek', province: 'Michigan' },
  { name: 'Auburn', province: 'Alabama' },
  { name: 'Rocky Hill', province: 'Connecticut' },
  { name: 'East Lansing', province: 'Michigan' },
  { name: 'Glendora', province: 'California' },
  { name: 'Portage', province: 'Michigan' },
  { name: 'Wheaton', province: 'Illinois' },
  { name: 'Bartlett', province: 'Tennessee' },
  { name: 'Revere', province: 'Massachusetts' },
  { name: 'Apopka', province: 'Florida' },
  { name: 'Bowie', province: 'Maryland' },
  { name: 'Grove City', province: 'Ohio' },
  { name: 'Coon Rapids', province: 'Minnesota' },
  { name: 'Hallandale Beach', province: 'Florida' },
  { name: 'Passaic', province: 'New Jersey' },
  { name: 'Elkhart', province: 'Indiana' },
  { name: 'Linden', province: 'New Jersey' },
  { name: 'Madera', province: 'California' },
  { name: 'Shelton', province: 'Connecticut' },
];

async function checkMissingCities() {
  const allBatches = [...batch401_430, ...batch431_460];

  console.log(`\n🔍 Checking ${allBatches.length} cities from batches 401-460...\n`);

  const missing = [];
  const found = [];

  for (const city of allBatches) {
    const { data, error } = await supabase
      .from('municipalities')
      .select('name, province, minutes_url')
      .eq('name', city.name)
      .eq('province', city.province)
      .eq('country', 'USA')
      .maybeSingle();

    if (error) {
      console.error(`Error checking ${city.name}, ${city.province}:`, error);
      continue;
    }

    if (!data) {
      missing.push(city);
      console.log(`❌ NOT FOUND: ${city.name}, ${city.province}`);
    } else if (data.minutes_url) {
      found.push({ ...city, hasUrl: true });
    } else {
      found.push({ ...city, hasUrl: false });
      console.log(`⚠️  FOUND BUT NO URL: ${city.name}, ${city.province}`);
    }
  }

  console.log(`\n📊 Summary for batches 401-460:`);
  console.log(`================================`);
  console.log(`Total cities in batches: ${allBatches.length}`);
  console.log(`Found in database: ${found.length}`);
  console.log(`  - With URLs: ${found.filter(c => c.hasUrl).length}`);
  console.log(`  - Without URLs: ${found.filter(c => !c.hasUrl).length}`);
  console.log(`Not found in database: ${missing.length}`);
  console.log(`================================\n`);

  if (missing.length > 0) {
    console.log(`\n❌ Cities not found in database:`);
    missing.forEach(c => console.log(`   - ${c.name}, ${c.province}`));
  }
}

checkMissingCities().catch(console.error);
