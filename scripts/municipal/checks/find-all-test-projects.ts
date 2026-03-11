#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findAllProjects() {
  console.log('\n🔍 Searching for all projects with "test" in the name...\n');

  // Find all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, slug')
    .ilike('name', '%test%')
    .is('deleted_at', null);

  if (!projects || projects.length === 0) {
    console.log('No projects found with "test" in name');
    return;
  }

  for (const project of projects) {
    console.log(`📋 Project: ${project.name}`);
    console.log(`   Slug: ${project.slug}`);
    console.log(`   ID: ${project.id}`);

    // Get member count
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', project.id);

    console.log(`   👥 Members: ${members?.length || 0}`);

    // Get RFP count
    const { count } = await supabase
      .from('rfps')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    console.log(`   📊 RFPs: ${count || 0}`);

    // Count municipal RFPs
    const { count: municipalCount } = await supabase
      .from('rfps')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('custom_fields->>source', 'municipal_minutes')
      .is('deleted_at', null);

    console.log(`   🏛️  Municipal RFPs: ${municipalCount || 0}`);
    console.log('');
  }

  console.log('\n🎯 The scanner config uses project ID:');
  console.log(`   ${process.env.SCANNER_PROJECT_ID || '92352069-9031-4f9c-a89b-e09dc51d2d16'}`);
}

findAllProjects().catch(console.error);
