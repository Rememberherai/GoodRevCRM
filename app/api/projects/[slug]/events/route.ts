import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createEventSchema } from '@/lib/validators/event';
import { generateSlug } from '@/lib/validation-helpers';
import type { Database } from '@/types/database';

type EventInsert = Database['public']['Tables']['events']['Insert'];

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
      .from('projects').select('*').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'starts_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id);

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.ilike('title', `%${sanitized}%`);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }

    const programIdFilter = searchParams.get('programId');
    if (programIdFilter) {
      query = query.eq('program_id', programIdFilter);
    }

    const seriesIdFilter = searchParams.get('seriesId');
    if (seriesIdFilter) {
      query = query.eq('series_id', seriesIdFilter);
    }

    // Exclude events that belong to a series (show only standalone events)
    const excludeSeries = searchParams.get('excludeSeries');
    if (excludeSeries === 'true') {
      query = query.is('series_id', null);
    }

    const ALLOWED_SORT = ['title', 'status', 'created_at', 'updated_at', 'starts_at', 'ends_at'];
    const ascending = sortOrder === 'asc';
    query = query.order(ALLOWED_SORT.includes(sortBy) ? sortBy : 'starts_at', { ascending });
    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;
    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Enrich with registration and check-in counts
    const eventIds = (events ?? []).map((e) => e.id);
    const regStatsMap = new Map<string, { registration_count: number; checked_in_count: number }>();

    if (eventIds.length > 0) {
      const { data: regs } = await supabase
        .from('event_registrations')
        .select('event_id, status, checked_in_at')
        .in('event_id', eventIds);

      if (regs) {
        for (const r of regs) {
          if (r.status === 'cancelled') continue;
          const entry = regStatsMap.get(r.event_id) ?? { registration_count: 0, checked_in_count: 0 };
          entry.registration_count++;
          if (r.checked_in_at) entry.checked_in_count++;
          regStatsMap.set(r.event_id, entry);
        }
      }
    }

    const enrichedEvents = (events ?? []).map((e) => {
      const stats = regStatsMap.get(e.id) ?? { registration_count: 0, checked_in_count: 0 };
      return { ...e, registration_count: stats.registration_count, checked_in_count: stats.checked_in_count };
    });

    return NextResponse.json({
      events: enrichedEvents,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/events:', error);
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
      .from('projects').select('*').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'create');

    const body = await request.json();
    const validationResult = createEventSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;
    const eventSlug = validated.slug || generateSlug(validated.title);

    const insertData: EventInsert = {
      project_id: project.id,
      created_by: user.id,
      title: validated.title,
      slug: eventSlug,
      description: validated.description ?? null,
      description_html: validated.description_html ?? null,
      cover_image_url: validated.cover_image_url ?? null,
      category: validated.category ?? null,
      tags: validated.tags ?? [],
      starts_at: validated.starts_at,
      ends_at: validated.ends_at,
      timezone: validated.timezone ?? 'America/Denver',
      is_all_day: validated.is_all_day ?? false,
      location_type: validated.location_type ?? 'in_person',
      venue_name: validated.venue_name ?? null,
      venue_address: validated.venue_address ?? null,
      venue_latitude: validated.venue_latitude ?? null,
      venue_longitude: validated.venue_longitude ?? null,
      virtual_url: validated.virtual_url ?? null,
      registration_enabled: validated.registration_enabled ?? true,
      registration_opens_at: validated.registration_opens_at ?? null,
      registration_closes_at: validated.registration_closes_at ?? null,
      total_capacity: validated.total_capacity ?? null,
      waitlist_enabled: validated.waitlist_enabled ?? false,
      max_tickets_per_registration: validated.max_tickets_per_registration ?? 10,
      require_approval: validated.require_approval ?? false,
      add_to_crm: validated.add_to_crm ?? true,
      custom_questions: validated.custom_questions ?? [],
      visibility: validated.visibility ?? 'public',
      program_id: validated.program_id ?? null,
      organizer_name: validated.organizer_name ?? null,
      organizer_email: validated.organizer_email ?? null,
      confirmation_message: validated.confirmation_message ?? null,
      cancellation_policy: validated.cancellation_policy ?? null,
      // Event waiver requirement is derived from event_waivers links, not direct writes.
      requires_waiver: false,
    };

    const { data: event, error } = await supabase
      .from('events').insert(insertData).select().single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An event with this slug already exists' }, { status: 409 });
      }
      console.error('Error creating event:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'event.created',
      entityType: 'event',
      entityId: event.id,
      data: event as Record<string, unknown>,
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
