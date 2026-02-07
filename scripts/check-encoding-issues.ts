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
    .select('id, name')
    .eq('province', 'Ontario')
    .is('minutes_url', null);

  console.log(`\nRemaining ${data?.length} municipalities:\n`);
  data?.forEach((m, i) => {
    console.log(`${i+1}. [${m.name}] (ID: ${m.id})`);
    console.log(`   Bytes: ${JSON.stringify([...m.name].map(c => c.charCodeAt(0)))}\n`);
  });
}

main().catch(console.error);
