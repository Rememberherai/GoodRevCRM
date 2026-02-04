import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hangupCall } from '@/lib/telnyx/service';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/calls/[id]/hangup - End an active call
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    await hangupCall(project.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/calls/[id]/hangup:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
