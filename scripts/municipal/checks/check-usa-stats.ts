#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDatabase() {
  // Get total USA municipalities
  const { count: totalCount, error: totalError } = await supabase
    .from('municipalities')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'USA');

  if (totalError) {
    console.error('Error getting total count:', totalError);
    return;
  }

  // Get USA municipalities with URLs
  const { count: urlCount, error: urlError } = await supabase
    .from('municipalities')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'USA')
    .not('minutes_url', 'is', null);

  if (urlError) {
    console.error('Error getting URL count:', urlError);
    return;
  }

  // Get USA municipalities without URLs
  const { count: noUrlCount, error: noUrlError } = await supabase
    .from('municipalities')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'USA')
    .is('minutes_url', null);

  console.log('\n📊 USA Municipality Statistics:');
  console.log('================================');
  console.log(`Total USA municipalities: ${totalCount}`);
  console.log(`With minutes URLs: ${urlCount}`);
  console.log(`Without URLs: ${noUrlCount}`);
  console.log('================================\n');

  // Get first 10 cities by population to verify
  const { data: topCities, error: topError } = await supabase
    .from('municipalities')
    .select('name, province, population, minutes_url')
    .eq('country', 'USA')
    .order('population', { ascending: false })
    .limit(10);

  if (topError) {
    console.error('Error getting top cities:', topError);
    return;
  }

  console.log('Top 10 USA cities by population:');
  console.log('================================');
  topCities?.forEach((city, i) => {
    const hasUrl = city.minutes_url ? '✅' : '❌';
    console.log(`${i + 1}. ${city.name}, ${city.province} (${city.population?.toLocaleString()}) ${hasUrl}`);
  });
}

checkDatabase().catch(console.error);
