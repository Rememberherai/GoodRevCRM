#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('name, address_city, address_state, description')
    .ilike('description', '%Municipal government%')
    .order('name');

  console.log('\n🏛️  Municipal Organizations Created by Scanner:\n');
  if (orgs && orgs.length > 0) {
    orgs.forEach(org => {
      console.log(`   • ${org.name} (${org.address_city}, ${org.address_state})`);
    });
    console.log(`\n   Total: ${orgs.length} municipal organizations`);
  } else {
    console.log('   ⚠️  No municipal organizations found');
    console.log('   This means the scanner hasn\'t created any organizations yet.');
    console.log('   Organizations are only created when RFPs are found and inserted.');
  }

  // Also check RFPs from municipal sources
  const { data: rfps, count } = await supabase
    .from('rfps')
    .select('id, title, organization_id, custom_fields', { count: 'exact' })
    .or('custom_fields->>source.eq.municipal_rfp,custom_fields->>source.eq.municipal_minutes')
    .limit(5);

  console.log('\n\n📋 RFPs from Municipal Sources:\n');
  if (rfps && rfps.length > 0) {
    rfps.forEach(rfp => {
      const fields = rfp.custom_fields as any;
      console.log(`   • ${rfp.title}`);
      console.log(`     Source: ${fields?.source || 'unknown'}`);
      console.log(`     Region: ${fields?.region || 'unknown'}`);
      console.log(`     Org ID: ${rfp.organization_id}`);
    });
    console.log(`\n   Total municipal RFPs: ${count}`);
  } else {
    console.log('   ⚠️  No municipal RFPs found');
    console.log('   Run the scanner first: npm run scan-municipalities');
  }
}

main().catch(console.error);
