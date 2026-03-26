import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { generateSlug } from '@/lib/validation-helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'create');

    const { data: original } = await supabase
      .from('events').select('*').eq('id', id).eq('project_id', project.id).single();
    if (!original) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const duplicatedStartsAt = new Date(original.starts_at);
    duplicatedStartsAt.setDate(duplicatedStartsAt.getDate() + 7);
    const duplicatedEndsAt = new Date(original.ends_at);
    duplicatedEndsAt.setDate(duplicatedEndsAt.getDate() + 7);
    const duplicatedOffsetMs = duplicatedStartsAt.getTime() - new Date(original.starts_at).getTime();

    const shiftIso = (value: string | null) =>
      value ? new Date(new Date(value).getTime() + duplicatedOffsetMs).toISOString() : null;

    const newSlug = generateSlug(`${original.title}-copy-${Date.now()}`);
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        project_id: original.project_id,
        program_id: original.program_id,
        created_by: user.id,
        title: `${original.title} (Copy)`,
        slug: newSlug,
        description: original.description,
        description_html: original.description_html,
        cover_image_url: original.cover_image_url,
        category: original.category,
        tags: original.tags as string[],
        starts_at: duplicatedStartsAt.toISOString(),
        ends_at: duplicatedEndsAt.toISOString(),
        timezone: original.timezone,
        is_all_day: original.is_all_day,
        location_type: original.location_type as 'in_person' | 'virtual' | 'hybrid',
        venue_name: original.venue_name,
        venue_address: original.venue_address,
        venue_latitude: original.venue_latitude,
        venue_longitude: original.venue_longitude,
        virtual_url: original.virtual_url,
        registration_enabled: original.registration_enabled,
        registration_opens_at: shiftIso(original.registration_opens_at),
        registration_closes_at: shiftIso(original.registration_closes_at),
        total_capacity: original.total_capacity,
        waitlist_enabled: original.waitlist_enabled,
        max_tickets_per_registration: original.max_tickets_per_registration,
        require_approval: original.require_approval,
        add_to_crm: original.add_to_crm,
        custom_questions: original.custom_questions,
        visibility: original.visibility as 'public' | 'unlisted' | 'private',
        organizer_name: original.organizer_name,
        organizer_email: original.organizer_email,
        confirmation_message: original.confirmation_message,
        cancellation_policy: original.cancellation_policy,
        requires_waiver: false,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating event:', error);
      return NextResponse.json({ error: 'Failed to duplicate event' }, { status: 500 });
    }

    // Copy ticket types
    const { data: ticketTypes } = await supabase
      .from('event_ticket_types').select('*').eq('event_id', id);

    if (ticketTypes && ticketTypes.length > 0) {
      const { error: ttError } = await supabase.from('event_ticket_types').insert(
        ticketTypes.map(tt => ({
          event_id: event.id,
          name: tt.name,
          description: tt.description,
          price_cents: tt.price_cents,
          currency: tt.currency,
          quantity_available: tt.quantity_available,
          max_per_order: tt.max_per_order,
          sort_order: tt.sort_order,
          sales_start_at: shiftIso(tt.sales_start_at),
          sales_end_at: shiftIso(tt.sales_end_at),
          is_active: tt.is_active,
          is_hidden: tt.is_hidden,
        }))
      );
      if (ttError) {
        console.error('Failed to copy ticket types during duplication:', ttError.message);
        await supabase.from('events').delete().eq('id', event.id);
        return NextResponse.json({ error: 'Failed to duplicate event ticket types' }, { status: 500 });
      }
    }

    const { data: eventWaivers } = await supabase
      .from('event_waivers')
      .select('template_id')
      .eq('event_id', id);

    if (eventWaivers && eventWaivers.length > 0) {
      const { error: waiverCopyError } = await supabase.from('event_waivers').insert(
        eventWaivers.map((waiver) => ({
          event_id: event.id,
          template_id: waiver.template_id,
        }))
      );

      if (waiverCopyError) {
        console.error('Failed to copy event waivers during duplication:', waiverCopyError.message);
        await supabase.from('events').delete().eq('id', event.id);
        return NextResponse.json({ error: 'Failed to duplicate event waivers' }, { status: 500 });
      }
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
    console.error('Error in POST /api/projects/[slug]/events/[id]/duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
