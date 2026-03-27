import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updateBudgetLineItemSchema } from '@/lib/validators/community/grant-budget';

interface RouteContext {
  params: Promise<{ slug: string; id: string; itemId: string }>;
}

// PATCH /api/projects/[slug]/grants/[id]/budget/[itemId]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, itemId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify item belongs to this grant (which belongs to this project)
    const { data: existing } = await supabaseAny
      .from('grant_budget_line_items')
      .select('id, grant_id')
      .eq('id', itemId)
      .eq('grant_id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });

    // Verify grant belongs to project
    const { data: grant } = await supabaseAny
      .from('grants')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const body = await request.json();
    const validation = updateBudgetLineItemSchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    const { data: item, error } = await supabaseAny
      .from('grant_budget_line_items')
      .update(validation.data)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /grants/[id]/budget/[itemId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/grants/[id]/budget/[itemId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, itemId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify item belongs to this grant
    const { data: existing } = await supabaseAny
      .from('grant_budget_line_items')
      .select('id, grant_id')
      .eq('id', itemId)
      .eq('grant_id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });

    // Verify grant belongs to project
    const { data: grant } = await supabaseAny
      .from('grants')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const { error } = await supabaseAny
      .from('grant_budget_line_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /grants/[id]/budget/[itemId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
