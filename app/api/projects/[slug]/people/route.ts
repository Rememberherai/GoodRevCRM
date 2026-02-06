import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createPersonSchema } from '@/lib/validators/person';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type PersonInsert = Database['public']['Tables']['people']['Insert'];
type Person = Database['public']['Tables']['people']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/people - List people
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
    const organizationId = searchParams.get('organizationId');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('people')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(
        `first_name.ilike."%${sanitized}%",last_name.ilike."%${sanitized}%",email.ilike."%${sanitized}%",job_title.ilike."%${sanitized}%"`
      );
    }

    // Filter by organization if provided
    if (organizationId) {
      const { data: personIds } = await supabase
        .from('person_organizations')
        .select('person_id')
        .eq('organization_id', organizationId)
        .eq('project_id', project.id);

      if (personIds && personIds.length > 0) {
        query = query.in(
          'id',
          personIds.map((p: { person_id: string }) => p.person_id)
        );
      } else {
        // No people in this organization
        return NextResponse.json({
          people: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    // Apply sorting
    const ALLOWED_SORT_COLUMNS = ['first_name', 'last_name', 'email', 'created_at', 'updated_at', 'job_title'];
    const ascending = sortOrder === 'asc';
    if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
      query = query.order(sortBy, { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: people, error, count } = await query;

    if (error) {
      console.error('Error fetching people:', error);
      return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
    }

    return NextResponse.json({
      people: people as Person[],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/people - Create person
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
    const { organization_id, ...personFields } = body;
    const validationResult = createPersonSchema.safeParse(personFields);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const personData: PersonInsert = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as PersonInsert['custom_fields'],
    };

    const { data: person, error } = await supabase
      .from('people')
      .insert(personData)
      .select()
      .single();

    if (error) {
      console.error('Error creating person:', error);
      return NextResponse.json({ error: 'Failed to create person' }, { status: 500 });
    }

    // If organization_id is provided, create the person-organization link
    if (organization_id && typeof organization_id === 'string' && person) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .eq('project_id', project.id)
        .single();

      if (org) {
        const { error: linkError } = await supabase
          .from('person_organizations')
          .insert({
            person_id: (person as Person).id,
            organization_id: organization_id,
            project_id: project.id,
            is_primary: true,
          });

        if (linkError) {
          console.error('Error linking person to organization:', linkError);
        }
      }
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'person',
      entityId: (person as Person).id,
      data: person as Record<string, unknown>,
    });

    return NextResponse.json({ person: person as Person }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
