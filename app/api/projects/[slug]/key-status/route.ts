import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { SECRET_KEYS, type SecretKeyName } from '@/lib/secrets';
import { getSystemSetting } from '@/lib/admin/queries';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/** Non-hidden, user-facing keys that projects are expected to configure. */
const USER_FACING_KEYS: SecretKeyName[] = (
  Object.entries(SECRET_KEYS) as [SecretKeyName, (typeof SECRET_KEYS)[SecretKeyName]][]
)
  .filter(([, meta]) => !('hidden' in meta && meta.hidden))
  .map(([key]) => key);

/**
 * GET /api/projects/[slug]/key-status
 *
 * Returns whether the project is missing required API keys and the admin
 * fallback policy is blocking env-var fallback.
 * Used by the header to decide whether to show the "keys required" indicator.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Load fallback policy
    const setting = await getSystemSetting('require_project_api_keys');
    const policy =
      setting && typeof setting === 'object' && !Array.isArray(setting)
        ? (setting as Record<string, boolean>)
        : null;

    // If fallback is fully allowed (no policy or all false), no warning needed
    if (!policy) {
      return NextResponse.json({ keys_required: false, missing_keys: [] });
    }

    const allBlocked = policy.all === true;

    // Determine which user-facing keys have fallback blocked
    const blockedKeys = USER_FACING_KEYS.filter((key) => {
      if (allBlocked) return true;
      const policyKey = key.replace(/_api_key$/, '');
      return policy[policyKey] === true;
    });

    if (blockedKeys.length === 0) {
      return NextResponse.json({ keys_required: false, missing_keys: [] });
    }

    // Check which blocked keys are NOT configured for this project
    const adminClient = createAdminClient();
    const { data: projectSecrets } = await adminClient
      .from('project_secrets')
      .select('key_name')
      .eq('project_id', project.id)
      .in('key_name', blockedKeys);

    const configuredKeys = new Set(
      (projectSecrets ?? []).map((s) => s.key_name)
    );

    const missingKeys = blockedKeys.filter((k) => !configuredKeys.has(k));

    return NextResponse.json({
      keys_required: missingKeys.length > 0,
      missing_keys: missingKeys.map((k) => ({
        key_name: k,
        label: SECRET_KEYS[k].label,
      })),
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/key-status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
