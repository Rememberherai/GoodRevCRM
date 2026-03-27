import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGivingHistorySchema } from '@/lib/validators/community/giving-history';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function getProjectAndOrg(supabase: Awaited<ReturnType<typeof createClient>>, slug: string, orgId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  if (!project) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id, project_id')
    .eq('id', orgId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();
  if (!org) return null;

  return { project, org };
}

// GET /api/projects/[slug]/organizations/[id]/giving-history
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await getProjectAndOrg(supabase, slug, id);
    if (!ctx) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Pipeline grants where this org is the funder
    const { data: pipelineGrants } = await supabaseAny
      .from('grants')
      .select('id, name, status, amount_requested, amount_awarded, application_due_at, award_period_start, award_period_end')
      .eq('funder_organization_id', id)
      .eq('project_id', ctx.project.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Manual giving history rows
    const { data: manualHistory } = await supabaseAny
      .from('funder_giving_history')
      .select('*')
      .eq('organization_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    return NextResponse.json({
      pipeline_grants: pipelineGrants ?? [],
      manual_history: manualHistory ?? [],
    });
  } catch (error) {
    console.error('Error in GET /organizations/[id]/giving-history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/organizations/[id]/giving-history
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await getProjectAndOrg(supabase, slug, id);
    if (!ctx) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const validation = createGivingHistorySchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error } = await (supabase as any)
      .from('funder_giving_history')
      .insert({ organization_id: id, ...validation.data })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /organizations/[id]/giving-history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
