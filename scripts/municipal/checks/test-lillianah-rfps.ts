#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testLillianahRfps() {
  const lillianahProjectId = '4daa20b1-d1d7-4e14-9718-df2f94865a62';

  console.log('\n🔍 Checking Lillianah project RFPs...\n');

  // Test 1: Check total RFPs
  const { data: allRfps, error: allError, count: totalCount } = await supabase
    .from('rfps')
    .select('*', { count: 'exact' })
    .eq('project_id', lillianahProjectId)
    .is('deleted_at', null);

  console.log(`Total RFPs in Lillianah: ${totalCount}`);
  if (allError) {
    console.log('Error fetching all RFPs:', allError);
  }

  // Test 2: Check municipal RFPs
  const { data: municipalRfps, error: municipalError, count: municipalCount } = await supabase
    .from('rfps')
    .select('*', { count: 'exact' })
    .eq('project_id', lillianahProjectId)
    .eq('custom_fields->>source', 'municipal_minutes')
    .is('deleted_at', null);

  console.log(`Municipal RFPs: ${municipalCount}\n`);
  if (municipalError) {
    console.log('Error fetching municipal RFPs:', municipalError);
  }

  // Test 3: Show sample RFPs
  if (municipalRfps && municipalRfps.length > 0) {
    console.log('Sample RFPs:');
    municipalRfps.slice(0, 5).forEach((rfp, idx) => {
      console.log(`  ${idx + 1}. ${rfp.title}`);
      console.log(`     ID: ${rfp.id}`);
      console.log(`     Source: ${(rfp.custom_fields as any)?.source}`);
    });
  }

  // Test 4: Test with ANON key (like the web app)
  console.log('\n🌐 Testing with ANON key (like web app)...');
  const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: anonRfps, error: anonError, count: anonCount } = await anonSupabase
    .from('rfps')
    .select('*', { count: 'exact' })
    .eq('project_id', lillianahProjectId)
    .is('deleted_at', null);

  if (anonError) {
    console.log('❌ ANON key error:', anonError);
  } else {
    console.log(`✅ ANON key can see ${anonCount} RFPs`);
  }

  // Test 5: Check project exists
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('id', lillianahProjectId)
    .single();

  console.log('\n📋 Project details:');
  console.log(`   Name: ${project?.name}`);
  console.log(`   Slug: ${project?.slug}`);
  console.log(`   URL: http://localhost:3000/projects/${project?.slug}/rfps`);
}

testLillianahRfps().catch(console.error);
