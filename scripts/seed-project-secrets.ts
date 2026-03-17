/**
 * Seed project secrets from current environment variables.
 * Run after deploying migration 0086_project_secrets.sql.
 *
 * Usage:
 *   npx tsx scripts/seed-project-secrets.ts
 *
 * This will:
 * 1. Read all current env vars (OPENROUTER_API_KEY, etc.)
 * 2. Find all projects in the database
 * 3. Encrypt and store each env var as a project secret for every project
 * 4. Skip keys that aren't set in the environment
 * 5. Skip projects that already have a value for that key
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Config ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  console.error('Missing or invalid ENCRYPTION_KEY (must be 64-char hex string)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Encryption (mirrors lib/encryption.ts) ---
function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY_HEX!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// --- Key mapping ---
const KEYS_TO_SEED: Array<{ keyName: string; envVar: string }> = [
  { keyName: 'openrouter_api_key', envVar: 'OPENROUTER_API_KEY' },
  { keyName: 'fullenrich_api_key', envVar: 'FULLENRICH_API_KEY' },
  { keyName: 'news_api_key', envVar: 'NEWS_API_KEY' },
  { keyName: 'census_api_key', envVar: 'CENSUS_API_KEY' },
];

async function main() {
  // 1. Get all projects
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug')
    .is('deleted_at', null);

  if (projErr || !projects) {
    console.error('Failed to fetch projects:', projErr?.message);
    process.exit(1);
  }

  console.log(`Found ${projects.length} project(s):`);
  for (const p of projects) {
    console.log(`  - ${p.name} (${p.slug})`);
  }

  // 2. Get existing secrets to avoid overwriting
  const { data: existingSecrets } = await supabase
    .from('project_secrets')
    .select('project_id, key_name');

  const existingSet = new Set(
    (existingSecrets || []).map((s) => `${s.project_id}:${s.key_name}`)
  );

  // 3. Seed each key for each project
  let inserted = 0;
  let skipped = 0;

  for (const project of projects) {
    for (const { keyName, envVar } of KEYS_TO_SEED) {
      const value = process.env[envVar];
      if (!value) {
        console.log(`  [skip] ${envVar} not set in environment`);
        continue;
      }

      const lookupKey = `${project.id}:${keyName}`;
      if (existingSet.has(lookupKey)) {
        console.log(`  [skip] ${project.slug}/${keyName} — already exists`);
        skipped++;
        continue;
      }

      const encrypted = encrypt(value);
      const { error } = await supabase.from('project_secrets').insert({
        project_id: project.id,
        key_name: keyName,
        encrypted_value: encrypted,
      });

      if (error) {
        console.error(`  [ERROR] ${project.slug}/${keyName}: ${error.message}`);
      } else {
        console.log(`  [OK] ${project.slug}/${keyName} — saved`);
        inserted++;
      }
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped (already existed).`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
