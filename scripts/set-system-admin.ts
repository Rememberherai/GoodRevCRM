/**
 * Grant, revoke, or list system admin access.
 *
 * Usage:
 *   npx tsx scripts/set-system-admin.ts grant user@example.com
 *   npx tsx scripts/set-system-admin.ts revoke user@example.com
 *   npx tsx scripts/set-system-admin.ts list
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [command, email] = process.argv.slice(2);

async function grant(email: string) {
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, email, full_name, is_system_admin')
    .eq('email', email.toLowerCase())
    .single();

  if (findError || !user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (user.is_system_admin) {
    console.log(`${user.email} (${user.full_name ?? 'no name'}) is already a system admin.`);
    return;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ is_system_admin: true })
    .eq('id', user.id);

  if (updateError) {
    console.error(`Failed to grant admin: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`Granted system admin to: ${user.email} (${user.full_name ?? 'no name'})`);
}

async function revoke(email: string) {
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, email, full_name, is_system_admin')
    .eq('email', email.toLowerCase())
    .single();

  if (findError || !user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (!user.is_system_admin) {
    console.log(`${user.email} is not a system admin. Nothing to revoke.`);
    return;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ is_system_admin: false })
    .eq('id', user.id);

  if (updateError) {
    console.error(`Failed to revoke admin: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`Revoked system admin from: ${user.email} (${user.full_name ?? 'no name'})`);
}

async function list() {
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, email, full_name, created_at, updated_at')
    .eq('is_system_admin', true)
    .order('email');

  if (error) {
    console.error(`Failed to list admins: ${error.message}`);
    process.exit(1);
  }

  if (!admins || admins.length === 0) {
    console.log('No system admins found.');
    console.log('Grant admin access with: npx tsx scripts/set-system-admin.ts grant user@example.com');
    return;
  }

  console.log(`System admins (${admins.length}):`);
  console.log('─'.repeat(60));
  for (const admin of admins) {
    console.log(`  ${admin.email}  (${admin.full_name ?? 'no name'})  id: ${admin.id}`);
  }
}

async function main() {
  switch (command) {
    case 'grant':
      if (!email) {
        console.error('Usage: npx tsx scripts/set-system-admin.ts grant <email>');
        process.exit(1);
      }
      await grant(email);
      break;
    case 'revoke':
      if (!email) {
        console.error('Usage: npx tsx scripts/set-system-admin.ts revoke <email>');
        process.exit(1);
      }
      await revoke(email);
      break;
    case 'list':
      await list();
      break;
    default:
      console.error('Usage: npx tsx scripts/set-system-admin.ts <grant|revoke|list> [email]');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
