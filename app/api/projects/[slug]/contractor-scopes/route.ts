import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createContractorScopeSchema } from '@/lib/validators/community/contractors';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type ContractorScopeInsert = Database['public']['Tables']['contractor_scopes']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Not a community project' }, { status: 400 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'view');

    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId');

    let query = supabase
      .from('contractor_scopes')
      .select('*, contractor:people!contractor_scopes_contractor_id_fkey(id, first_name, last_name, email)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (contractorId) {
      query = query.eq('contractor_id', contractorId);
    }

    const { data: scopes, error } = await query;
    if (error) {
      console.error('Error fetching contractor scopes:', error);
      return NextResponse.json({ error: 'Failed to fetch contractor scopes' }, { status: 500 });
    }

    return NextResponse.json({ scopes: scopes ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error in GET /api/projects/[slug]/contractor-scopes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Not a community project' }, { status: 400 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'create');

    const body = await request.json();
    const validation = createContractorScopeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    if (!validation.data.contractor_id) {
      return NextResponse.json({ error: 'contractor_id is required' }, { status: 400 });
    }

    const insertData: ContractorScopeInsert = {
      project_id: project.id,
      contractor_id: validation.data.contractor_id,
      created_by: user.id,
      title: validation.data.title,
      description: validation.data.description ?? null,
      status: validation.data.status,
      start_date: validation.data.start_date ?? null,
      end_date: validation.data.end_date ?? null,
      compensation_terms: validation.data.compensation_terms ?? null,
      service_categories: validation.data.service_categories,
      certifications: validation.data.certifications,
      service_area_radius_miles: validation.data.service_area_radius_miles ?? null,
      home_base_latitude: validation.data.home_base_latitude ?? null,
      home_base_longitude: validation.data.home_base_longitude ?? null,
      document_url: validation.data.document_url || null,
    };

    const { data: scope, error } = await supabase
      .from('contractor_scopes')
      .insert(insertData)
      .select('*')
      .single();

    if (error || !scope) {
      console.error('Error creating contractor scope:', error);
      return NextResponse.json({ error: 'Failed to create contractor scope' }, { status: 500 });
    }

    await supabase
      .from('people')
      .update({ is_contractor: true })
      .eq('id', validation.data.contractor_id)
      .eq('project_id', project.id);

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'contractor.onboarded' as never,
      entityType: 'contractor_scope' as never,
      entityId: scope.id,
      data: scope as Record<string, unknown>,
    });

    return NextResponse.json({ scope }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error in POST /api/projects/[slug]/contractor-scopes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
