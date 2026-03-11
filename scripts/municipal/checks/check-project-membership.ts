#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMembership() {
  const projectId = '92352069-9031-4f9c-a89b-e09dc51d2d16';

  // Get project details
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('id', projectId)
    .single();

  console.log('\n📋 Project:', project?.name);
  console.log('🔗 Slug:', project?.slug);
  console.log('🆔 ID:', project?.id);

  // Get all project members
  const { data: members } = await supabase
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', projectId);

  console.log(`\n👥 Project Members: ${members?.length || 0}`);

  if (members && members.length > 0) {
    for (const member of members) {
      // Get user email
      const { data: user } = await supabase.auth.admin.getUserById(member.user_id);
      console.log(`  - ${user?.user?.email || 'Unknown'} (${member.role})`);
    }
  } else {
    console.log('  ⚠️  No members found!');
    console.log('\n❌ This is the problem - the project has no members.');
    console.log('   RLS policies require you to be a project member to see RFPs.');
  }

  // Check total RFPs in project
  const { count } = await supabase
    .from('rfps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null);

  console.log(`\n📊 Total RFPs in project: ${count}`);
}

checkMembership().catch(console.error);
