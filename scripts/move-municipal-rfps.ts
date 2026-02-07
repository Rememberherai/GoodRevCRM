#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function moveRfps() {
  const oldProjectId = '92352069-9031-4f9c-a89b-e09dc51d2d16'; // Test project
  const newProjectId = '4daa20b1-d1d7-4e14-9718-df2f94865a62'; // Lillianah project

  console.log('\n🔄 Moving municipal RFPs from Test to Lillianah project...\n');

  // Find all municipal RFPs in the Test project
  const { data: rfps } = await supabase
    .from('rfps')
    .select('id, title')
    .eq('project_id', oldProjectId)
    .eq('custom_fields->>source', 'municipal_minutes')
    .is('deleted_at', null);

  if (!rfps || rfps.length === 0) {
    console.log('No municipal RFPs found to move');
    return;
  }

  console.log(`Found ${rfps.length} municipal RFPs to move\n`);

  // Update each RFP's project_id
  const { error } = await supabase
    .from('rfps')
    .update({ project_id: newProjectId })
    .eq('project_id', oldProjectId)
    .eq('custom_fields->>source', 'municipal_minutes')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ Error moving RFPs:', error);
    return;
  }

  console.log(`✅ Successfully moved ${rfps.length} RFPs to Lillianah project`);
  console.log('\n🎉 You can now view them at:');
  console.log('   http://localhost:3000/projects/lillianah/rfps');
  console.log('\nFilter by Source: "Municipal Minutes (Discussions)" to see only these RFPs');
}

moveRfps().catch(console.error);
