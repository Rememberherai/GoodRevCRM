import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const updateKeywordSchema = z.object({
  is_active: z.boolean().optional(),
});

// PATCH /api/projects/[slug]/news/keywords/[id]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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
    const parsed = updateKeywordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: keyword, error } = await (supabase as any)
      .from('news_keywords')
      .update(parsed.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    return NextResponse.json({ keyword });
  } catch (error) {
    console.error('[News Keywords PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/news/keywords/[id]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    // Only allow deleting manual keywords
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('news_keywords')
      .select('source')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    if (existing.source === 'organization') {
      return NextResponse.json(
        { error: 'Organization keywords are managed automatically' },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('news_keywords')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[News Keywords DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
