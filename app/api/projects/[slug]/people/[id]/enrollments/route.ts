import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/people/[id]/enrollments - Get person's sequence enrollments
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: personId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Join through sequences to scope enrollments to this project
    const { data: enrollments, error } = await supabaseAny
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:sequences!inner(id, name, status, description, project_id)
      `)
      .eq('person_id', personId)
      .eq('sequence.project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching person enrollments:', error);
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
    }

    return NextResponse.json({ enrollments: enrollments ?? [] });
  } catch (error) {
    console.error('Error in GET person enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
