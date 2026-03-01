#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getTop1000() {
  const { data: cities } = await supabase
    .from('municipalities')
    .select('name, province, population')
    .eq('country', 'USA')
    .not('population', 'is', null)
    .order('population', { ascending: false })
    .limit(1000);

  if (!cities || cities.length === 0) {
    console.log('No cities found');
    return;
  }

  console.log('\nTop 1000 USA Cities by Population');
  console.log('==================================\n');
  console.log('Top 20:');
  cities.slice(0, 20).forEach((city, i) => {
    console.log(`${i + 1}. ${city.name}, ${city.province} - ${city.population!.toLocaleString()}`);
  });

  console.log(`\n...\n`);
  console.log('Cities 980-1000:');
  cities.slice(979, 1000).forEach((city, i) => {
    console.log(`${980 + i}. ${city.name}, ${city.province} - ${city.population!.toLocaleString()}`);
  });

  console.log(`\n==================================`);
  console.log(`Total cities with population data: ${cities.length}`);
  console.log(`Largest: ${cities[0].name}, ${cities[0].province} (${cities[0].population!.toLocaleString()})`);
  if (cities.length >= 1000) {
    console.log(`#1000: ${cities[999].name}, ${cities[999].province} (${cities[999].population!.toLocaleString()})`);
  }
}

getTop1000().catch(console.error);
