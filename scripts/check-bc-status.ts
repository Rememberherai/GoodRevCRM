#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { count: total } = await supabase
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .eq('province', 'British Columbia');

  const { count: withMinutes } = await supabase
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .eq('province', 'British Columbia')
    .not('minutes_url', 'is', null);

  const { count: needMinutes } = await supabase
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .eq('province', 'British Columbia')
    .is('minutes_url', null);

  console.log(`\n📊 British Columbia Status:`);
  console.log(`   Total: ${total}`);
  console.log(`   ✅ With minutes: ${withMinutes}`);
  console.log(`   ❌ Need minutes: ${needMinutes}`);
}

main().catch(console.error);
