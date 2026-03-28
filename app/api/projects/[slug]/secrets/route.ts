import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SECRET_KEYS,
  type SecretKeyName,
  listProjectSecrets,
  setProjectSecret,
  deleteProjectSecret,
} from '@/lib/secrets';
import { getSystemSetting } from '@/lib/admin/queries';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const upsertSchema = z.object({
  key_name: z.string().refine((k) => k in SECRET_KEYS, { message: 'Invalid secret key name' }),
  value: z.string().min(1, 'Value cannot be empty'),
});

const deleteSchema = z.object({
  key_name: z.string().refine((k) => k in SECRET_KEYS, { message: 'Invalid secret key name' }),
});

async function resolveProjectAndCheckAdmin(slug: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  // Check admin/owner role
  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  const isOwner = project.owner_id === user.id;
  const memberRole = (membership as { role?: string } | null)?.role;
  const isAdmin = memberRole === 'admin';

  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) };
  }

  return { project, user };
}

// GET /api/projects/[slug]/secrets — list all secrets (masked)
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const secrets = await listProjectSecrets(result.project.id);

    // Load admin fallback policy to determine if env-var fallback is actually allowed
    const setting = await getSystemSetting('require_project_api_keys');
    const policy =
      setting && typeof setting === 'object' && !Array.isArray(setting)
        ? (setting as Record<string, boolean>)
        : null;
    const allBlocked = policy?.all === true;

    // Include metadata about all available keys
    // The `hidden` query param controls whether to include hidden keys (used by Scheduler panel)
    const url = new URL(_request.url);
    const includeHidden = url.searchParams.get('include_hidden') === 'true';

    const allKeys = Object.entries(SECRET_KEYS)
      .filter(([, meta]) => includeHidden || !('hidden' in meta && meta.hidden))
      .map(([key, meta]) => {
        const stored = secrets.find((s) => s.key_name === key);
        const envVarExists = !!process.env[meta.envVar];
        // Check if admin has blocked fallback for this specific key
        const policyKey = key.replace(/_api_key$/, '');
        const fallbackBlocked = allBlocked || (policy?.[policyKey] === true);
        return {
          key_name: key,
          label: meta.label,
          description: meta.description,
          placeholder: meta.placeholder,
          is_set: !!stored,
          masked_value: stored?.masked_value || '',
          updated_at: stored?.updated_at || null,
          has_server_default: envVarExists && !fallbackBlocked,
          fallback_blocked: envVarExists && fallbackBlocked,
        };
      });

    return NextResponse.json({ secrets: allKeys });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[slug]/secrets — upsert a secret
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const body = await request.json();
    const validation = upsertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await setProjectSecret(
      result.project.id,
      validation.data.key_name as SecretKeyName,
      validation.data.value,
      result.user.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/projects/[slug]/secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/secrets — delete a secret
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const body = await request.json();
    const validation = deleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await deleteProjectSecret(
      result.project.id,
      validation.data.key_name as SecretKeyName
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
