#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRfps() {
  const projectId = '92352069-9031-4f9c-a89b-e09dc51d2d16';

  // Check for RFPs with municipal source
  const { data: rfps, error } = await supabase
    .from('rfps')
    .select('id, title, organization_id, custom_fields, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error querying RFPs:', error);
    return;
  }

  console.log(`\nTotal RFPs in project (last 20): ${rfps?.length || 0}`);

  if (rfps && rfps.length > 0) {
    console.log('\nRecent RFPs:');
    rfps.forEach((rfp, idx) => {
      const source = (rfp.custom_fields as any)?.source;
      console.log(`${idx + 1}. ${rfp.title}`);
      console.log(`   ID: ${rfp.id}`);
      console.log(`   Source: ${source || 'none'}`);
      console.log(`   Created: ${rfp.created_at}`);
      console.log('');
    });

    // Count municipal RFPs
    const municipalRfps = rfps.filter(r => {
      const source = (r.custom_fields as any)?.source;
      return source === 'municipal_minutes' || source === 'municipal_rfp';
    });
    console.log(`Municipal RFPs: ${municipalRfps.length}`);
  } else {
    console.log('\nNo RFPs found in database!');
    console.log('Checking if project ID is correct...');

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);

    if (projectError) {
      console.error('Error fetching projects:', projectError);
    } else {
      console.log('\nAvailable projects:');
      projects?.forEach(p => console.log(`  ${p.id}: ${p.name}`));
    }
  }
}

checkRfps().catch(console.error);
