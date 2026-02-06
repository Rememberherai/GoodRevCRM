import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createNoteSchema, noteQuerySchema } from '@/lib/validators/note';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/notes - List notes
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = noteQuerySchema.safeParse({
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      rfp_id: searchParams.get('rfp_id') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, organization_id, opportunity_id, rfp_id, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('notes')
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id);

    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
    if (rfp_id) query = query.eq('rfp_id', rfp_id);

    const { data: notes, error } = await query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({
      notes: notes ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/notes - Create note
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
    const validationResult = createNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, organization_id, opportunity_id, rfp_id } = validationResult.data;

    // Validate that referenced entities belong to this project
    if (person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('id', person_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!person) {
        return NextResponse.json({ error: 'Person not found in this project' }, { status: 400 });
      }
    }
    if (organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'Organization not found in this project' }, { status: 400 });
      }
    }
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('id', opportunity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found in this project' }, { status: 400 });
      }
    }
    if (rfp_id) {
      const { data: rfp } = await supabase
        .from('rfps')
        .select('id')
        .eq('id', rfp_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!rfp) {
        return NextResponse.json({ error: 'RFP not found in this project' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: note, error } = await supabaseAny
      .from('notes')
      .insert({
        project_id: project.id,
        ...validationResult.data,
        created_by: user.id,
      })
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
