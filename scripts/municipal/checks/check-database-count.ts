#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDatabase() {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id, name, province, minutes_url')
    .eq('country', 'USA')
    .not('minutes_url', 'is', null)
    .order('population', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n✅ Total USA municipalities with URLs: ${data.length}\n`);
}

checkDatabase();
