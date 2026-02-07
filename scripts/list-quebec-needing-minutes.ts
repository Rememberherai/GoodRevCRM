#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('municipalities')
    .select('name, municipality_type, population')
    .eq('province', 'Quebec')
    .is('minutes_url', null)
    .order('population', { ascending: false });

  console.log(`\nQuebec municipalities needing minutes URLs (${data?.length}):\n`);
  data?.forEach((m, i) => {
    console.log(`${i+1}. ${m.name} (${m.municipality_type}) - Pop: ${m.population || 'N/A'}`);
  });
}

main().catch(console.error);
