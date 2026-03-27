import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { createBudgetLineItemSchema } from '@/lib/validators/community/grant-budget';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function getProjectAndGrant(supabase: Awaited<ReturnType<typeof createClient>>, slug: string, grantId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  if (!project) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: grant } = await (supabase as any)
    .from('grants')
    .select('id, project_id, amount_requested')
    .eq('id', grantId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();
  if (!grant) return null;

  return { project, grant };
}

// GET /api/projects/[slug]/grants/[id]/budget
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await getProjectAndGrant(supabase, slug, id);
    if (!ctx) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('grant_budget_line_items')
      .select('*')
      .eq('grant_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      items: items ?? [],
      amount_requested: ctx.grant.amount_requested,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /grants/[id]/budget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/grants/[id]/budget
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await getProjectAndGrant(supabase, slug, id);
    if (!ctx) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, ctx.project.id, 'grants', 'update');

    const body = await request.json();
    const validation = createBudgetLineItemSchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get next sort_order
    const { data: lastItem } = await supabaseAny
      .from('grant_budget_line_items')
      .select('sort_order')
      .eq('grant_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    const nextSortOrder = validation.data.sort_order ?? ((lastItem?.sort_order ?? -1) + 1);

    const { data: item, error } = await supabaseAny
      .from('grant_budget_line_items')
      .insert({ grant_id: id, ...validation.data, sort_order: nextSortOrder })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /grants/[id]/budget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
