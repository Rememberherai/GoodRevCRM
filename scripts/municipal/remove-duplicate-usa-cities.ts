#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function removeDuplicates() {
  console.log('\n🗑️  Removing Duplicate USA Cities');
  console.log('====================================\n');

  // Find duplicate USA cities (same name + province + country)
  // Fetch all records by using a large limit
  const { data: cities } = await supabase
    .from('municipalities')
    .select('id, name, province, country, created_at')
    .eq('country', 'USA')
    .order('name')
    .order('province')
    .order('created_at')
    .limit(50000);

  if (!cities) {
    console.log('No cities found');
    return;
  }

  console.log(`Total cities fetched: ${cities.length}\n`);

  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const city of cities) {
    const key = `${city.name}|${city.province}`;
    const existing = seen.get(key);

    if (existing) {
      // Delete current record (keep first seen)
      duplicates.push(city.id);
      console.log(`  Duplicate: ${city.name}, ${city.province}`);
    } else {
      seen.set(key, city.id);
    }
  }

  console.log(`\nFound ${duplicates.length} duplicates to remove\n`);

  if (duplicates.length > 0) {
    const { error } = await supabase
      .from('municipalities')
      .delete()
      .in('id', duplicates);

    if (error) {
      console.error('❌ Failed to delete duplicates:', error);
    } else {
      console.log(`✅ Deleted ${duplicates.length} duplicate cities\n`);
    }
  } else {
    console.log('No duplicates found!\n');
  }
}

removeDuplicates().catch(console.error);
