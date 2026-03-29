import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/settings - Get project settings
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

    // Get project settings
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ settings: project.settings });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/settings - Update project settings (merge)
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json().catch(() => null);

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Allowlist settable keys to prevent arbitrary JSONB injection
    const ALLOWED_KEYS = new Set(['risk_index_enabled', 'risk_index_weights', 'contact_providers', 'customRoles']);
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (ALLOWED_KEYS.has(key)) body[key] = value;
    }

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No valid settings keys provided' }, { status: 400 });
    }

    if ('risk_index_enabled' in body && typeof body.risk_index_enabled !== 'boolean') {
      return NextResponse.json({ error: 'risk_index_enabled must be a boolean' }, { status: 400 });
    }

    // Get current project + verify membership with admin/owner role
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentSettings = (project.settings as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, ...body };

    const { error: updateError } = await supabase
      .from('projects')
      .update({ settings: updatedSettings as unknown as Database['public']['Tables']['projects']['Row']['settings'] })
      .eq('id', project.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
