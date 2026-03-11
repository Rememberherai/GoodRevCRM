#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMunicipalRfps() {
  // Find all RFPs with municipal source
  const { data: municipalRfps, error } = await supabase
    .from('rfps')
    .select('id, title, project_id, created_at, custom_fields')
    .or('custom_fields->>source.eq.municipal_minutes,custom_fields->>source.eq.municipal_rfp')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!municipalRfps || municipalRfps.length === 0) {
    console.log('No municipal RFPs found!');
    return;
  }

  console.log(`\nFound ${municipalRfps.length} municipal RFPs\n`);

  // Group by project
  const byProject = new Map<string, any[]>();
  for (const rfp of municipalRfps) {
    const existing = byProject.get(rfp.project_id) || [];
    existing.push(rfp);
    byProject.set(rfp.project_id, existing);
  }

  // Get project details for each
  for (const [projectId, rfps] of byProject.entries()) {
    const { data: project } = await supabase
      .from('projects')
      .select('name, slug')
      .eq('id', projectId)
      .single();

    console.log(`Project: ${project?.name || 'Unknown'} (slug: ${project?.slug || 'unknown'})`);
    console.log(`  Municipal RFPs: ${rfps.length}`);
    console.log(`  URL: http://localhost:3000/projects/${project?.slug}/rfps`);
    console.log('');

    // Show first 5 RFPs
    console.log('  Recent RFPs:');
    rfps.slice(0, 5).forEach((rfp, idx) => {
      console.log(`    ${idx + 1}. ${rfp.title}`);
      console.log(`       Created: ${rfp.created_at}`);
    });
    console.log('');
  }
}

findMunicipalRfps().catch(console.error);
