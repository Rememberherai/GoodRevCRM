import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateProjectSchema } from '@/lib/validators/project';
import type { Database } from '@/types/database';

type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type Project = Database['public']['Tables']['projects']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug] - Get a specific project
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

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project: project as Project });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug] - Update a project
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

    const body = await request.json();
    const validationResult = updateProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build the update object, only including fields that were provided
    const updateData: ProjectUpdate = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.slug !== undefined) updateData.slug = updates.slug;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;

    // For settings, merge with existing settings rather than replacing
    if (updates.settings !== undefined) {
      // Get current project to merge settings
      const { data: currentProject } = await supabase
        .from('projects')
        .select('settings')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

      const currentSettings = (currentProject?.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...currentSettings,
        ...updates.settings,
      } as Database['public']['Tables']['projects']['Row']['settings'];
    }

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('slug', slug)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A project with this slug already exists' },
          { status: 409 }
        );
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      console.error('Error updating project:', error);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ project: project as Project });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug] - Soft delete a project
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() } as ProjectUpdate)
      .eq('slug', slug)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
