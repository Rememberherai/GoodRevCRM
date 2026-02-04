import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/projects/[slug]/email/inbox
 * Fetch synced emails for a project, with optional filters
 *
 * Query params:
 *   person_id     - filter by person
 *   organization_id - filter by organization
 *   direction     - 'inbound' | 'outbound'
 *   thread_id     - filter by Gmail thread ID
 *   limit         - max results (default 50)
 *   offset        - pagination offset (default 0)
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const personId = url.searchParams.get('person_id');
    const organizationId = url.searchParams.get('organization_id');
    const direction = url.searchParams.get('direction');
    const threadId = url.searchParams.get('thread_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    let query = supabase
      .from('emails')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .order('email_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (personId) query = query.eq('person_id', personId);
    if (organizationId) query = query.eq('organization_id', organizationId);
    if (direction) query = query.eq('direction', direction);
    if (threadId) query = query.eq('gmail_thread_id', threadId);

    const { data: emails, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ emails, total: count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
