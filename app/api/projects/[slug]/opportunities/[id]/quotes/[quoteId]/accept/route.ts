import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { acceptQuote } from '@/lib/quotes/service';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; quoteId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id, quoteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireProjectRole(supabase, user.id, project.id, 'member');

    const body = await request.json().catch(() => ({}));
    const result = await acceptQuote(
      { supabase, projectId: project.id, userId: user.id },
      quoteId, body, id
    );

    return NextResponse.json({ result });
  } catch (error: unknown) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error accepting quote:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
