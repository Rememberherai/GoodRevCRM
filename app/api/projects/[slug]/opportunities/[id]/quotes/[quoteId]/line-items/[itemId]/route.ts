import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateLineItem, deleteLineItem } from '@/lib/quotes/service';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; quoteId: string; itemId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId, itemId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    const body = await request.json();
    const result = await updateLineItem(
      { supabase, projectId: project.id, userId: user.id },
      quoteId, itemId, body, id
    );

    return NextResponse.json({ result });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating line item:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId, itemId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    await deleteLineItem(
      { supabase, projectId: project.id, userId: user.id },
      quoteId, itemId, id
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting line item:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
