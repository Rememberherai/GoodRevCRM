import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ProjectSettings } from '@/types/project';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const addRoleSchema = z.object({
  role: z.string().min(1).max(100),
});

// POST /api/projects/[slug]/settings/custom-roles - Add a custom role to project defaults
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check if user is admin or owner
    const { data: membership } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = addRoleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { role } = validationResult.data;
    const currentSettings = (project.settings as ProjectSettings) || {};
    const currentRoles = currentSettings.customRoles || [];

    // Don't add if already exists (case-insensitive check)
    if (currentRoles.some((r) => r.toLowerCase() === role.toLowerCase())) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    // Limit maximum number of custom roles
    const MAX_CUSTOM_ROLES = 50;
    if (currentRoles.length >= MAX_CUSTOM_ROLES) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_CUSTOM_ROLES} custom roles allowed` },
        { status: 400 }
      );
    }

    // Add the new role
    const updatedSettings = {
      ...currentSettings,
      customRoles: [...currentRoles, role],
    };

    const { error: updateError } = await supabase
      .from('projects')
      .update({ settings: updatedSettings as Json, updated_at: new Date().toISOString() })
      .eq('id', project.id);

    if (updateError) {
      console.error('Error updating project settings:', updateError);
      return NextResponse.json({ error: 'Failed to save custom role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/settings/custom-roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
