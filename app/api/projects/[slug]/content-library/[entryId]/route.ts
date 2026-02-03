import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateContentLibraryEntrySchema } from '@/lib/validators/rfp-content-library';
import type { Database } from '@/types/database';

type ContentLibraryUpdate = Database['public']['Tables']['rfp_content_library']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; entryId: string }>;
}

// GET /api/projects/[slug]/content-library/[entryId]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
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

    const { data: entry, error } = await supabase
      .from('rfp_content_library')
      .select('*')
      .eq('id', entryId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error in GET /api/.../content-library/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/content-library/[entryId]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
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

    const body = await request.json();
    const validationResult = updateContentLibraryEntrySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;
    const updateData: ContentLibraryUpdate = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.question_text !== undefined) updateData.question_text = updates.question_text;
    if (updates.answer_text !== undefined) updateData.answer_text = updates.answer_text;
    if (updates.answer_html !== undefined) updateData.answer_html = updates.answer_html;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.tags !== undefined) updateData.tags = updates.tags;

    const { data: entry, error } = await supabase
      .from('rfp_content_library')
      .update(updateData)
      .eq('id', entryId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      console.error('Error updating entry:', error);
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error in PATCH /api/.../content-library/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/content-library/[entryId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
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

    const { error } = await supabase
      .from('rfp_content_library')
      .update({ deleted_at: new Date().toISOString() } as ContentLibraryUpdate)
      .eq('id', entryId)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting entry:', error);
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/.../content-library/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
