import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createOrganizationSchema } from '@/lib/validators/organization';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
type Organization = Database['public']['Tables']['organizations']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/organizations - List organizations
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('organizations')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(`name.ilike."%${sanitized}%",domain.ilike."%${sanitized}%",industry.ilike."%${sanitized}%"`);
    }

    // Apply sorting
    const ALLOWED_SORT_COLUMNS = ['name', 'domain', 'industry', 'created_at', 'updated_at'];
    const ascending = sortOrder === 'asc';
    if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
      query = query.order(sortBy, { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: organizations, error, count } = await query;

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    return NextResponse.json({
      organizations: organizations as Organization[],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/organizations - Create organization
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = createOrganizationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const orgData: OrganizationInsert = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as OrganizationInsert['custom_fields'],
    };

    const { data: organization, error } = await supabase
      .from('organizations')
      .insert(orgData)
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'organization',
      entityId: (organization as Organization).id,
      data: organization as Record<string, unknown>,
    });

    // Auto-create news keyword for this organization (fire-and-forget)
    const orgName = (organization as Organization).name;
    if (orgName && orgName.length >= 3) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('news_keywords')
        .upsert(
          {
            project_id: project.id,
            keyword: orgName,
            source: 'organization',
            organization_id: (organization as Organization).id,
            is_active: true,
            created_by: user.id,
          },
          { onConflict: 'project_id,keyword' }
        )
        .then(({ error: kwError }: { error: { message: string } | null }) => {
          if (kwError) console.warn('[News] Auto-keyword creation failed:', kwError.message);
        });
    }

    return NextResponse.json({ organization: organization as Organization }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
