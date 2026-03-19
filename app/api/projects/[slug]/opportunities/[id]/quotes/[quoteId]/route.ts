import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getQuote, updateQuote, deleteQuote } from '@/lib/quotes/service';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; quoteId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'viewer');

    const quote = await getQuote({ supabase, projectId: project.id }, quoteId, id);
    return NextResponse.json({ quote });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error getting quote:', error);
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    const body = await request.json();
    const quote = await updateQuote(
      { supabase, projectId: project.id, userId: user.id },
      quoteId, body, id
    );

    return NextResponse.json({ quote });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating quote:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    await deleteQuote({ supabase, projectId: project.id }, quoteId, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting quote:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
