import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt, encrypt, maskApiKey } from '@/lib/encryption';

/**
 * Known secret key names that can be stored per project.
 * Maps to the env var name used as fallback.
 */
export const SECRET_KEYS = {
  openrouter_api_key: {
    envVar: 'OPENROUTER_API_KEY',
    label: 'OpenRouter API Key',
    description: 'AI/LLM provider for chat, research, and AI features',
    placeholder: 'sk-or-v1-...',
  },
  fullenrich_api_key: {
    envVar: 'FULLENRICH_API_KEY',
    label: 'FullEnrich API Key',
    description: 'Contact and company data enrichment',
    placeholder: 'Your FullEnrich API key',
  },
  news_api_key: {
    envVar: 'NEWS_API_KEY',
    label: 'News API Key',
    description: 'News feed and company news monitoring',
    placeholder: 'Your News API key',
  },
  census_api_key: {
    envVar: 'CENSUS_API_KEY',
    label: 'Census API Key',
    description: 'Growth metrics and census data enrichment',
    placeholder: 'Your Census API key',
  },
  cronjob_org_api_key: {
    envVar: 'CRONJOB_ORG_API_KEY',
    label: 'cron-job.org API Key',
    description: 'Manage scheduled cron jobs via cron-job.org REST API',
    placeholder: 'Your cron-job.org API key',
    hidden: true, // Managed via Scheduler settings tab
  },
  cron_secret: {
    envVar: 'CRON_SECRET',
    label: 'Cron Secret',
    description: 'Bearer token used to authenticate cron job callbacks',
    placeholder: 'Auto-generate or enter a secret token',
    hidden: true, // Managed via Scheduler settings tab
  },
  scheduler_base_url: {
    envVar: 'NEXT_PUBLIC_APP_URL',
    label: 'Scheduler Base URL',
    description: 'Public URL of this app (used as callback URL for cron jobs)',
    placeholder: 'https://your-app.vercel.app',
    hidden: true, // Managed via Scheduler settings tab
  },
  scheduler_provider: {
    envVar: 'SCHEDULER_PROVIDER',
    label: 'Scheduler Provider',
    description: 'Cron backend: cronjob_org or supabase_pgcron',
    placeholder: 'cronjob_org',
    hidden: true, // Managed via Scheduler settings tab
  },
} as const;

export type SecretKeyName = keyof typeof SECRET_KEYS;

/**
 * Get a project secret by name. Checks the database first, then falls back
 * to the corresponding environment variable for backward compatibility.
 *
 * No caching — each call hits the DB to ensure fresh values.
 * DB round-trips are fast (~1-5ms) and correctness matters more.
 */
export async function getProjectSecret(
  projectId: string,
  keyName: SecretKeyName
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('project_secrets')
      .select('encrypted_value')
      .eq('project_id', projectId)
      .eq('key_name', keyName)
      .single();

    if (data?.encrypted_value) {
      return decrypt(data.encrypted_value);
    }
  } catch {
    // DB read failed — fall through to env var
  }

  // Fallback to environment variable
  const envVar = SECRET_KEYS[keyName].envVar;
  return process.env[envVar] || null;
}

/**
 * Get multiple project secrets at once, reducing DB round-trips.
 */
export async function getProjectSecrets(
  projectId: string,
  keyNames: SecretKeyName[]
): Promise<Record<SecretKeyName, string | null>> {
  const result = {} as Record<SecretKeyName, string | null>;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('project_secrets')
      .select('key_name, encrypted_value')
      .eq('project_id', projectId)
      .in('key_name', keyNames);

    const dbResults = new Map(
      (data || []).map((row) => [row.key_name, row.encrypted_value])
    );

    for (const key of keyNames) {
      const encrypted = dbResults.get(key);
      let value: string | null = null;

      if (encrypted) {
        try {
          value = decrypt(encrypted);
        } catch {
          // Decryption failed, fall through to env
        }
      }

      if (!value) {
        const envVar = SECRET_KEYS[key].envVar;
        value = process.env[envVar] || null;
      }

      result[key] = value;
    }
  } catch {
    // DB failed — fall back to env vars for all
    for (const key of keyNames) {
      const envVar = SECRET_KEYS[key].envVar;
      result[key] = process.env[envVar] || null;
    }
  }

  return result;
}

/**
 * Upsert an encrypted secret for a project.
 */
export async function setProjectSecret(
  projectId: string,
  keyName: SecretKeyName,
  plainValue: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient();
  const encrypted = encrypt(plainValue);

  const { error } = await supabase
    .from('project_secrets')
    .upsert(
      {
        project_id: projectId,
        key_name: keyName,
        encrypted_value: encrypted,
        updated_by: userId,
      },
      { onConflict: 'project_id,key_name' }
    );

  if (error) {
    throw new Error(`Failed to save secret: ${error.message}`);
  }
}

/**
 * Delete a project secret.
 */
export async function deleteProjectSecret(
  projectId: string,
  keyName: SecretKeyName
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('project_secrets')
    .delete()
    .eq('project_id', projectId)
    .eq('key_name', keyName);

  if (error) {
    throw new Error(`Failed to delete secret: ${error.message}`);
  }
}

/**
 * List all secrets for a project with masked values.
 * Never returns the actual secret values.
 */
export async function listProjectSecrets(
  projectId: string
): Promise<Array<{ key_name: string; masked_value: string; updated_at: string }>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('project_secrets')
    .select('key_name, encrypted_value, updated_at')
    .eq('project_id', projectId)
    .order('key_name');

  if (error) {
    throw new Error(`Failed to list secrets: ${error.message}`);
  }

  return (data || []).map((row) => {
    let masked = '••••••••';
    try {
      const decrypted = decrypt(row.encrypted_value);
      masked = maskApiKey(decrypted);
    } catch {
      // Can't decrypt — show generic mask
    }
    return {
      key_name: row.key_name,
      masked_value: masked,
      updated_at: row.updated_at,
    };
  });
}
