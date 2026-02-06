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
    const directionParam = url.searchParams.get('direction');
    const direction = directionParam && ['inbound', 'outbound'].includes(directionParam) ? directionParam : null;
    const threadId = url.searchParams.get('thread_id');
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50');
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '0');
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

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
      console.error('[inbox] Failed to fetch emails:', error.message);
      return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }

    return NextResponse.json({ emails, total: count });
  } catch (error) {
    console.error('[inbox] Internal error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}
