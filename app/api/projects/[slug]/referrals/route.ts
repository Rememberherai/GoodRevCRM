import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createReferralSchema } from '@/lib/validators/community/referrals';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'view');

    const { searchParams } = new URL(request.url);
    let query = supabase
      .from('referrals')
      .select(`
        *,
        person:people(id, first_name, last_name),
        household:households(id, name),
        partner:organizations(id, name)
      `)
      .eq('project_id', project.id)
      .order('updated_at', { ascending: false });

    const status = searchParams.get('status');
    const householdId = searchParams.get('household_id');
    const personId = searchParams.get('person_id');
    if (status) query = query.eq('status', status);
    if (householdId) query = query.eq('household_id', householdId);
    if (personId) query = query.eq('person_id', personId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ referrals: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'create');

    const body = await request.json();
    const validation = createReferralSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert({ ...validation.data, project_id: project.id })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create referral');

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'referral.created' as never,
      entityType: 'referral' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return NextResponse.json({ referral: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
