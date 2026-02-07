#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: pei } = await supabase
    .from('municipalities')
    .select('*')
    .eq('province', 'Prince Edward Island');

  const { data: sask } = await supabase
    .from('municipalities')
    .select('*')
    .eq('province', 'Saskatchewan');

  console.log('\n📊 Current Database Status:\n');
  console.log('Prince Edward Island:', pei?.length || 0, 'municipalities');
  console.log('Saskatchewan:', sask?.length || 0, 'municipalities\n');
}

main().catch(console.error);
