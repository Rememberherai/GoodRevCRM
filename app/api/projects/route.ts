import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createProjectSchema } from '@/lib/validators/project';
import type { Database } from '@/types/database';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

// GET /api/projects - List all projects for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error in GET /api/projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, slug, description, settings } = validationResult.data;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        slug,
        description: description ?? null,
        settings: settings ?? {},
        owner_id: user.id,
      } as ProjectInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A project with this slug already exists' },
          { status: 409 }
        );
      }
      // Return the actual error message for debugging
      return NextResponse.json(
        { error: error.message || 'Failed to create project', code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
