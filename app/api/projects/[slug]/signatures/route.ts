import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSignatureSchema } from '@/lib/validators/email-signature';

// GET /api/projects/[slug]/signatures - List signatures for current user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: signatures, error } = await (supabase as any)
      .from('email_signatures')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', project.id)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching signatures:', error);
      return NextResponse.json({ error: 'Failed to fetch signatures' }, { status: 500 });
    }

    return NextResponse.json({ data: signatures });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/signatures - Create signature
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = createSignatureSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: signature, error: createError } = await (supabase as any)
      .from('email_signatures')
      .insert({
        user_id: user.id,
        project_id: project.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating signature:', createError);
      return NextResponse.json({ error: 'Failed to create signature' }, { status: 500 });
    }

    return NextResponse.json(signature, { status: 201 });
  } catch (error) {
    console.error('Error creating signature:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
