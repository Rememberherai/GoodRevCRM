import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateGivingHistorySchema } from '@/lib/validators/community/giving-history';

interface RouteContext {
  params: Promise<{ slug: string; id: string; historyId: string }>;
}

// PATCH /api/projects/[slug]/organizations/[id]/giving-history/[historyId]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, historyId } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify the history entry belongs to the org in this project
    const { data: existing } = await supabaseAny
      .from('funder_giving_history')
      .select('id, organization_id')
      .eq('id', historyId)
      .eq('organization_id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'History entry not found' }, { status: 404 });

    // Verify org belongs to this project
    const { data: org } = await supabaseAny
      .from('organizations')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const validation = updateGivingHistorySchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    const { data: entry, error } = await supabaseAny
      .from('funder_giving_history')
      .update(validation.data)
      .eq('id', historyId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error in PATCH /organizations/[id]/giving-history/[historyId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/organizations/[id]/giving-history/[historyId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, historyId } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify chain: historyId belongs to this org, org belongs to this project
    const { data: existing } = await supabaseAny
      .from('funder_giving_history')
      .select('id, organization_id')
      .eq('id', historyId)
      .eq('organization_id', id)
      .single();
    if (!existing) return NextResponse.json({ error: 'History entry not found' }, { status: 404 });

    const { data: org } = await supabaseAny
      .from('organizations')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const { error } = await supabaseAny
      .from('funder_giving_history')
      .delete()
      .eq('id', historyId);

    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /organizations/[id]/giving-history/[historyId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
