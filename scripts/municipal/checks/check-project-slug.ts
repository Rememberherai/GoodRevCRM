#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProject() {
  const projectId = '92352069-9031-4f9c-a89b-e09dc51d2d16';

  // Get the project details
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return;
  }

  console.log('\nProject Details:');
  console.log(`  Name: ${project.name}`);
  console.log(`  Slug: ${project.slug}`);
  console.log(`  ID: ${project.id}`);

  console.log(`\nTo view municipal RFPs, navigate to:`);
  console.log(`  http://localhost:3000/projects/${project.slug}/rfps`);

  // Get count of municipal RFPs
  const { count } = await supabase
    .from('rfps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  console.log(`\nTotal RFPs in this project: ${count}`);

  // Show a municipal RFP example
  const { data: municipalRfp } = await supabase
    .from('rfps')
    .select('id, title, custom_fields')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (municipalRfp) {
    const source = (municipalRfp.custom_fields as any)?.source;
    console.log(`\nMost recent RFP:`);
    console.log(`  Title: ${municipalRfp.title}`);
    console.log(`  Source: ${source}`);
    console.log(`  View at: http://localhost:3000/projects/${project.slug}/rfps/${municipalRfp.id}`);
  }
}

checkProject().catch(console.error);
