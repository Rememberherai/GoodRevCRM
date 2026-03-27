import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; entryId: string }>;
}

const updateEntrySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z.string().max(100).optional(),
  content: z.string().min(1).max(20000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// PATCH /api/projects/[slug]/grants/answer-bank/[entryId]
// ?use=true increments usage_count and last_used_at without requiring a body
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    const { searchParams } = new URL(request.url);
    const isUse = searchParams.get('use') === 'true';

    // Verify entry belongs to this project
    const { data: existing } = await supabase
      .from('grant_answer_bank')
      .select('id, usage_count')
      .eq('id', entryId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    let updates: Record<string, unknown> = {};

    if (isUse) {
      updates = { usage_count: (existing.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() };
    } else {
      const body = await request.json();
      const validation = updateEntrySchema.safeParse(body);
      if (!validation.success)
        return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
      updates = validation.data;
    }

    const { data: entry, error } = await supabase
      .from('grant_answer_bank')
      .update(updates)
      .eq('id', entryId)
      .select('id, title, category, content, tags, usage_count, last_used_at, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /grants/answer-bank/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/grants/answer-bank/[entryId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    const { error } = await supabase
      .from('grant_answer_bank')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('project_id', project.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /grants/answer-bank/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
