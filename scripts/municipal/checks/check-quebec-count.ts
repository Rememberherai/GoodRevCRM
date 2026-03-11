#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, count } = await supabase
    .from('municipalities')
    .select('*', { count: 'exact' })
    .eq('province', 'Quebec');

  console.log(`\nTotal Quebec municipalities: ${count}`);
  console.log(`\nFirst 10 samples:`);
  data?.slice(0, 10).forEach(m => {
    console.log(`  - ${m.name} (${m.municipality_type})`);
  });
}

main().catch(console.error);
