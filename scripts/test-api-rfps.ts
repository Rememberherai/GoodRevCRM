#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Use anon key like the web app
);

async function testApiQuery() {
  const projectId = '92352069-9031-4f9c-a89b-e09dc51d2d16';

  console.log('\n🔍 Testing RFP query with ANON key (like the web app)...\n');

  // Query RFPs exactly like the API route does
  const { data: rfps, error, count } = await supabase
    .from('rfps')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(0, 49);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Total RFPs found: ${count}`);
  console.log(`📦 RFPs returned: ${rfps?.length || 0}\n`);

  if (rfps && rfps.length > 0) {
    console.log('Recent RFPs:');
    rfps.slice(0, 5).forEach((rfp, idx) => {
      const source = (rfp.custom_fields as any)?.source || 'unknown';
      console.log(`  ${idx + 1}. ${rfp.title}`);
      console.log(`     Source: ${source}`);
      console.log(`     Created: ${rfp.created_at}`);
    });
  } else {
    console.log('⚠️  No RFPs found with ANON key!');
    console.log('\nThis means RLS policies are blocking access.');
    console.log('The user needs to be authenticated or RLS policies need updating.');
  }
}

testApiQuery().catch(console.error);
