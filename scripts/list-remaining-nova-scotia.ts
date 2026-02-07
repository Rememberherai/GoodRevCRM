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
    .select('name')
    .eq('province', 'Nova Scotia')
    .is('minutes_url', null)
    .order('name');

  console.log(`\nNova Scotia municipalities without minutes URLs (${data?.length}):\n`);
  data?.forEach((m, i) => console.log(`${i+1}. ${m.name}`));
}

main().catch(console.error);
