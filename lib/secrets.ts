import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt, encrypt, maskApiKey } from '@/lib/encryption';
import { getSystemSetting } from '@/lib/admin/queries';
import { NextResponse } from 'next/server';

/**
 * Thrown when a required API key is not configured and fallback is blocked.
 * Callers can catch this specifically to return a user-friendly response.
 */
export class ApiKeyMissingError extends Error {
  public readonly keyName: string;
  public readonly keyLabel: string;

  constructor(keyName: string, keyLabel: string) {
    super(`${keyLabel} is not configured for this project. Please add it in Project Settings → API Keys.`);
    this.name = 'ApiKeyMissingError';
    this.keyName = keyName;
    this.keyLabel = keyLabel;
  }
}

/**
 * Check if an error is an ApiKeyMissingError (or a legacy "not configured" error).
 */
export function isApiKeyMissingError(err: unknown): err is ApiKeyMissingError {
  if (err instanceof ApiKeyMissingError) return true;
  if (err instanceof Error && err.message.includes('not configured for this project')) return true;
  return false;
}

/**
 * Return a user-friendly 422 JSON response for missing API keys.
 * Use in API route catch blocks: `if (isApiKeyMissingError(err)) return apiKeyMissingResponse(err);`
 */
export function apiKeyMissingResponse(err: unknown): NextResponse {
  const message =
    err instanceof ApiKeyMissingError
      ? err.message
      : err instanceof Error
        ? err.message
        : 'A required API key is not configured for this project.';

  return NextResponse.json(
    {
      error: message,
      code: 'API_KEY_MISSING',
    },
    { status: 422 }
  );
}

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
  quickbooks_access_token: {
    envVar: 'QUICKBOOKS_ACCESS_TOKEN',
    label: 'QuickBooks Access Token',
    description: 'OAuth access token for QuickBooks Online',
    placeholder: 'QuickBooks access token',
    hidden: true,
  },
  quickbooks_refresh_token: {
    envVar: 'QUICKBOOKS_REFRESH_TOKEN',
    label: 'QuickBooks Refresh Token',
    description: 'OAuth refresh token for QuickBooks Online',
    placeholder: 'QuickBooks refresh token',
    hidden: true,
  },
  quickbooks_realm_id: {
    envVar: 'QUICKBOOKS_REALM_ID',
    label: 'QuickBooks Realm ID',
    description: 'QuickBooks company identifier',
    placeholder: '1234567890',
    hidden: true,
  },
  quickbooks_token_expires_at: {
    envVar: 'QUICKBOOKS_TOKEN_EXPIRES_AT',
    label: 'QuickBooks Token Expiry',
    description: 'ISO timestamp for QuickBooks token expiration',
    placeholder: '2026-03-20T12:00:00.000Z',
    hidden: true,
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
    description: 'Cron backend: cronjob_org, supabase_pgcron, or browser',
    placeholder: 'cronjob_org',
    hidden: true, // Managed via Scheduler settings tab
  },
  browser_scheduler_config: {
    envVar: 'BROWSER_SCHEDULER_CONFIG',
    label: 'Browser Scheduler Config',
    description: 'JSON config blob for browser-based cron scheduler',
    placeholder: '{}',
    hidden: true, // Managed via Scheduler settings tab
  },
} as const;

export type SecretKeyName = keyof typeof SECRET_KEYS;

/**
 * Fetch the fallback policy once and return a checker function.
 * Avoids repeated DB queries when resolving multiple keys.
 */
async function loadFallbackPolicy(): Promise<Record<string, boolean> | null> {
  try {
    const setting = await getSystemSetting('require_project_api_keys');
    if (setting && typeof setting === 'object' && !Array.isArray(setting)) {
      return setting as Record<string, boolean>;
    }
  } catch {
    // Setting fetch failed — default to allowing fallback
  }
  return null;
}

/**
 * Check whether env-var fallback is allowed for a given secret key.
 *
 * The admin setting `require_project_api_keys` is a JSONB object.
 * - If `"all"` is `true`, fallback is blocked for every key.
 * - Per-key overrides (e.g. `"openrouter": true`) block fallback for that
 *   specific key even when `"all"` is not set.
 *
 * Accepts an optional pre-fetched policy to avoid redundant DB calls
 * when checking multiple keys in a loop.
 *
 * Fallback is allowed by default (setting absent or `false`).
 */
function checkFallbackAllowed(
  keyName: SecretKeyName,
  policy: Record<string, boolean> | null
): boolean {
  if (!policy) return true;

  // Global kill-switch — applies to every key
  if (policy.all === true) {
    return false;
  }

  // Per-key override (e.g. openrouter_api_key → "openrouter")
  const policyKey = keyName.replace(/_api_key$/, '');
  if (policy[policyKey] === true) {
    return false;
  }

  return true;
}

/**
 * Get a project secret by name. Checks the database first, then falls back
 * to the corresponding environment variable for backward compatibility.
 *
 * If the admin setting `require_project_api_keys` blocks fallback for the
 * given key, returns null instead of the env var.
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

  // Check if env-var fallback is allowed by admin policy
  const policy = await loadFallbackPolicy();
  if (!checkFallbackAllowed(keyName, policy)) return null;

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

    // Fetch fallback policy once for all keys
    const policy = await loadFallbackPolicy();

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
        if (checkFallbackAllowed(key, policy)) {
          const envVar = SECRET_KEYS[key].envVar;
          value = process.env[envVar] || null;
        }
      }

      result[key] = value;
    }
  } catch {
    // DB failed — load policy separately and fall back to env vars if allowed
    const policy = await loadFallbackPolicy();
    for (const key of keyNames) {
      if (checkFallbackAllowed(key, policy)) {
        const envVar = SECRET_KEYS[key].envVar;
        result[key] = process.env[envVar] || null;
      } else {
        result[key] = null;
      }
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
  userId?: string | null
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
        updated_by: userId ?? null,
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
 * Copy secrets from one project to another.
 * Only copies non-hidden, user-facing keys that exist in the source project.
 * Decrypts from source, re-encrypts for target.
 * Returns the list of key names that were copied.
 */
export async function copyProjectSecrets(
  sourceProjectId: string,
  targetProjectId: string,
  userId: string,
  keyNames?: SecretKeyName[]
): Promise<SecretKeyName[]> {
  const supabase = createAdminClient();

  // Fetch all secrets from source project
  const { data: sourceSecrets, error } = await supabase
    .from('project_secrets')
    .select('key_name, encrypted_value')
    .eq('project_id', sourceProjectId);

  if (error) {
    throw new Error(`Failed to read source project secrets: ${error.message}`);
  }

  if (!sourceSecrets || sourceSecrets.length === 0) {
    return [];
  }

  // Filter to only non-hidden keys (unless specific keys requested)
  const hiddenKeys = new Set(
    (Object.entries(SECRET_KEYS) as [SecretKeyName, (typeof SECRET_KEYS)[SecretKeyName]][])
      .filter(([, meta]) => 'hidden' in meta && meta.hidden)
      .map(([key]) => key)
  );

  const toCopy = sourceSecrets.filter((s) => {
    if (!(s.key_name in SECRET_KEYS)) return false;
    if (keyNames) return keyNames.includes(s.key_name as SecretKeyName);
    return !hiddenKeys.has(s.key_name as SecretKeyName);
  });

  const copied: SecretKeyName[] = [];
  for (const secret of toCopy) {
    try {
      const decrypted = decrypt(secret.encrypted_value);
      await setProjectSecret(targetProjectId, secret.key_name as SecretKeyName, decrypted, userId);
      copied.push(secret.key_name as SecretKeyName);
    } catch {
      // Skip secrets that can't be decrypted
      console.error(`Failed to copy secret ${secret.key_name}`);
    }
  }

  return copied;
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
