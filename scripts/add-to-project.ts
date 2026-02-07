#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addToProject() {
  const projectId = '92352069-9031-4f9c-a89b-e09dc51d2d16';

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  console.log('\n👤 Available Users:');
  users?.forEach((user, idx) => {
    console.log(`  ${idx + 1}. ${user.email} (ID: ${user.id})`);
  });

  if (!users || users.length === 0) {
    console.log('❌ No users found!');
    return;
  }

  // Use the first user (assuming it's you)
  const userId = users[0].id;
  const userEmail = users[0].email;

  console.log(`\n✅ Adding ${userEmail} to Test Project...`);

  // Add user as project member
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
      role: 'owner', // Give owner role for full access
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('⚠️  User is already a member of this project!');
    } else {
      console.error('❌ Error:', error);
    }
    return;
  }

  console.log('✅ Successfully added to project!');
  console.log('\n🎉 You should now be able to see all 20 municipal RFPs in the web UI.');
  console.log('   Refresh the page: http://localhost:3000/projects/test/rfps');
}

addToProject().catch(console.error);
