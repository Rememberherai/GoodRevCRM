import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { reorderServiceTypes } from '@/lib/service-types/service';
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

    const { items } = await request.json();
    await reorderServiceTypes({ supabase, projectId: project.id }, items);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error reordering service types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
