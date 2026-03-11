#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findYourProjects() {
  // Get user by email
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const evanUser = users?.find(u => u.email?.includes('evanc') || u.email?.includes('evan'));

  if (!evanUser) {
    console.log('Could not find Evan user');
    return;
  }

  console.log(`\n👤 User: ${evanUser.email}`);
  console.log(`🆔 User ID: ${evanUser.id}\n`);

  // Find all projects where this user is a member
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('user_id', evanUser.id);

  console.log(`📋 Projects you're a member of: ${memberships?.length || 0}\n`);

  if (!memberships || memberships.length === 0) {
    console.log('❌ You are not a member of any projects!');
    return;
  }

  for (const membership of memberships) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, slug')
      .eq('id', membership.project_id)
      .single();

    console.log(`📋 ${project?.name}`);
    console.log(`   Slug: ${project?.slug}`);
    console.log(`   ID: ${project?.id}`);
    console.log(`   Your role: ${membership.role}`);

    // Get RFP count
    const { count } = await supabase
      .from('rfps')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', membership.project_id)
      .is('deleted_at', null);

    console.log(`   RFPs: ${count || 0}`);

    // Count municipal RFPs
    const { count: municipalCount } = await supabase
      .from('rfps')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', membership.project_id)
      .eq('custom_fields->>source', 'municipal_minutes')
      .is('deleted_at', null);

    console.log(`   Municipal RFPs: ${municipalCount || 0}`);
    console.log('');
  }

  console.log('\n🎯 The project with 20 municipal RFPs is:');
  console.log('   Slug: test');
  console.log('   ID: 92352069-9031-4f9c-a89b-e09dc51d2d16');
  console.log('   URL: http://localhost:3000/projects/test/rfps');
}

findYourProjects().catch(console.error);
