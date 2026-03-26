import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('event_registrations')
      .select('*, event_registration_tickets(*)', { count: 'exact' })
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(`registrant_name.ilike.%${sanitized}%,registrant_email.ilike.%${sanitized}%`);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: registrations, error, count } = await query;
    if (error) {
      console.error('Error fetching registrations:', error);
      return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
    }

    return NextResponse.json({
      registrations,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET registrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
