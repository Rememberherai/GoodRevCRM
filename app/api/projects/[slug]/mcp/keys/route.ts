import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/mcp/auth';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';
import { COMMUNITY_MCP_ROLES, STANDARD_MCP_ROLES } from '@/types/mcp';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(STANDARD_MCP_ROLES).default('member'),
  expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
});

const createCommunityKeySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(COMMUNITY_MCP_ROLES).default('staff'),
  expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
});

// GET /api/projects/[slug]/mcp/keys - List API keys
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Check membership (admin/owner only)
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP tables not yet in generated types
    const db = supabase as any;
    const { data: keys, error } = await db
      .from('mcp_api_keys')
      .select('id, name, key_prefix, role, scopes, created_by, expires_at, last_used_at, revoked_at, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 });

    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/mcp/keys - Create new API key
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Check membership (admin/owner only)
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
    }

    const body = await request.json();
    const validation = (
      project.project_type === 'community' ? createCommunityKeySchema : createKeySchema
    ).safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { name, role, expires_in_days } = validation.data;
    const { key, prefix, hash } = generateApiKey();

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString()
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP tables not yet in generated types
    const db = supabase as any;
    const { data: apiKey, error } = await db
      .from('mcp_api_keys')
      .insert({
        project_id: project.id,
        name,
        key_hash: hash,
        key_prefix: prefix,
        key_encrypted: encrypt(key),
        role,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select('id, name, key_prefix, role, expires_at, created_at')
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });

    // Return the full key only on creation — it cannot be retrieved later
    return NextResponse.json({
      key: apiKey,
      secret: key,
      warning: 'Save this key now. It cannot be retrieved after this response.',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/mcp/keys - Revoke a key
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');
    if (!keyId) return NextResponse.json({ error: 'Key ID required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP tables not yet in generated types
    const db = supabase as any;
    const { error } = await db
      .from('mcp_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('project_id', project.id)
      .is('revoked_at', null);

    if (error) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });

    return NextResponse.json({ revoked: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
