import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { listDispositions, createDisposition } from '@/lib/dispositions/service';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';
import type { DispositionEntityType } from '@/types/disposition';

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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'viewer');

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type') as DispositionEntityType | null;
    if (!entity_type || !['organization', 'person'].includes(entity_type)) {
      return NextResponse.json({ error: 'entity_type query param is required (organization or person)' }, { status: 400 });
    }

    const dispositions = await listDispositions(
      { supabase, projectId: project.id, userId: user.id },
      { entity_type }
    );

    return NextResponse.json({ dispositions });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing dispositions:', error);
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    const body = await request.json();
    const disposition = await createDisposition(
      { supabase, projectId: project.id, userId: user.id },
      body
    );

    return NextResponse.json({ disposition }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error creating disposition:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
