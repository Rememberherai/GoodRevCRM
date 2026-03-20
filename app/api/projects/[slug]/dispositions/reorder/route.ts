import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { reorderDispositions } from '@/lib/dispositions/service';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    await reorderDispositions(
      { supabase, projectId: project.id, userId: user.id },
      body.items
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error reordering dispositions:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
