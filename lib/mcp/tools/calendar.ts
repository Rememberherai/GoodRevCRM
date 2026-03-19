import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { sendBookingCancellation } from '@/lib/calendar/notifications';
import type { McpContext } from '@/types/mcp';

export function registerCalendarTools(server: McpServer, getContext: () => McpContext) {
  // calendar.list_event_types
  server.tool(
    'calendar.list_event_types',
    'List event types for the current project',
    {
      active_only: z.boolean().default(true).describe('Only return active event types'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      let query = ctx.supabase
        .from('event_types')
        .select('*')
        .eq('project_id', ctx.projectId)
        .order('created_at', { ascending: false });

      if (params.active_only) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list event types: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ event_types: data }) }] };
    }
  );

  // calendar.get_event_type
  server.tool(
    'calendar.get_event_type',
    'Get a single event type by ID',
    {
      id: z.string().uuid().describe('Event type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('event_types')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (error) throw new Error(`Event type not found: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.create_event_type
  server.tool(
    'calendar.create_event_type',
    'Create a new event type for the current project',
    {
      title: z.string().min(1).max(500).describe('Event type title'),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).describe('URL slug'),
      description: z.string().max(2000).optional().describe('Description'),
      duration_minutes: z.number().int().min(5).max(480).default(30).describe('Duration in minutes'),
      color: z.string().default('#3b82f6').describe('Color hex code'),
      location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).default('video').describe('Location type'),
      location_value: z.string().optional().describe('Location details'),
      buffer_before_minutes: z.number().int().min(0).default(0).describe('Buffer before meeting'),
      buffer_after_minutes: z.number().int().min(0).default(0).describe('Buffer after meeting'),
      min_notice_hours: z.number().int().min(0).default(24).describe('Minimum notice hours'),
      max_days_in_advance: z.number().int().min(1).default(60).describe('Max days in advance'),
      requires_confirmation: z.boolean().default(false).describe('Require host confirmation'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('event_types')
        .insert({
          user_id: ctx.userId,
          project_id: ctx.projectId,
          title: params.title,
          slug: params.slug,
          description: params.description || null,
          duration_minutes: params.duration_minutes,
          color: params.color,
          location_type: params.location_type,
          location_value: params.location_value || null,
          buffer_before_minutes: params.buffer_before_minutes,
          buffer_after_minutes: params.buffer_after_minutes,
          min_notice_hours: params.min_notice_hours,
          max_days_in_advance: params.max_days_in_advance,
          requires_confirmation: params.requires_confirmation,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create event type: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'event_type.created',
        entityType: 'event_type',
        entityId: data.id,
        data: { event_type: data },
        metadata: { userId: ctx.userId },
      }).catch(() => {});

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.update_event_type
  server.tool(
    'calendar.update_event_type',
    'Update an existing event type',
    {
      id: z.string().uuid().describe('Event type ID'),
      title: z.string().min(1).max(500).optional().describe('Event type title'),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL slug'),
      description: z.string().max(2000).nullable().optional().describe('Description'),
      duration_minutes: z.number().int().min(5).max(480).optional().describe('Duration in minutes'),
      color: z.string().optional().describe('Color hex code'),
      is_active: z.boolean().optional().describe('Whether active'),
      location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).optional().describe('Location type'),
      location_value: z.string().nullable().optional().describe('Location details'),
      buffer_before_minutes: z.number().int().min(0).optional().describe('Buffer before'),
      buffer_after_minutes: z.number().int().min(0).optional().describe('Buffer after'),
      min_notice_hours: z.number().int().min(0).optional().describe('Min notice hours'),
      max_days_in_advance: z.number().int().min(1).optional().describe('Max days in advance'),
      requires_confirmation: z.boolean().optional().describe('Require host confirmation'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, ...updates } = params;
      const { data, error } = await ctx.supabase
        .from('event_types')
        .update(updates)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update event type: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.delete_event_type
  server.tool(
    'calendar.delete_event_type',
    'Delete an event type',
    {
      id: z.string().uuid().describe('Event type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { error } = await ctx.supabase
        .from('event_types')
        .delete()
        .eq('id', params.id)
        .eq('project_id', ctx.projectId);

      if (error) throw new Error(`Failed to delete event type: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true }) }] };
    }
  );

  // calendar.list_bookings
  server.tool(
    'calendar.list_bookings',
    'List bookings for the current project with optional status filter',
    {
      status: z.enum(['pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show']).optional().describe('Filter by status'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      let query = ctx.supabase
        .from('bookings')
        .select('*, event_types(title, color, duration_minutes)')
        .eq('project_id', ctx.projectId)
        .order('start_at', { ascending: false })
        .limit(params.limit);

      if (params.status) {
        query = query.eq('status', params.status);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list bookings: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ bookings: data }) }] };
    }
  );

  // calendar.get_booking
  server.tool(
    'calendar.get_booking',
    'Get a single booking by ID',
    {
      id: z.string().uuid().describe('Booking ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('bookings')
        .select('*, event_types(title, color, duration_minutes, location_type)')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (error) throw new Error(`Booking not found: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.cancel_booking
  server.tool(
    'calendar.cancel_booking',
    'Cancel a booking by ID (host action)',
    {
      id: z.string().uuid().describe('Booking ID'),
      reason: z.string().max(2000).optional().describe('Cancellation reason'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'host',
          cancellation_reason: params.reason || null,
        })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .in('status', ['confirmed', 'pending'])
        .select()
        .single();

      if (error) throw new Error(`Failed to cancel booking: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'booking.cancelled',
        entityType: 'booking',
        entityId: data.id,
        data: { booking: data, cancelled_by: 'host' },
        metadata: { userId: ctx.userId },
      }).catch(() => {});

      sendBookingCancellation(data.id).catch(() => {});

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.update_profile
  server.tool(
    'calendar.update_profile',
    'Update the current user\'s calendar booking profile',
    {
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL slug'),
      display_name: z.string().min(1).max(200).optional().describe('Display name'),
      bio: z.string().max(2000).nullable().optional().describe('Bio'),
      timezone: z.string().max(100).optional().describe('Timezone'),
      welcome_message: z.string().max(2000).nullable().optional().describe('Welcome message'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('calendar_profiles')
        .update(params)
        .eq('user_id', ctx.userId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update profile: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.list_availability_schedules
  server.tool(
    'calendar.list_availability_schedules',
    'List the current user\'s availability schedules',
    {},
    async () => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('availability_schedules')
        .select('*, availability_rules(*)')
        .eq('user_id', ctx.userId);

      if (error) throw new Error(`Failed to list schedules: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ schedules: data }) }] };
    }
  );

  // calendar.update_availability
  server.tool(
    'calendar.update_availability',
    'Update an availability schedule and its rules',
    {
      schedule_id: z.string().uuid().describe('Schedule ID'),
      name: z.string().min(1).max(200).optional().describe('Schedule name'),
      timezone: z.string().max(100).optional().describe('Timezone'),
      rules: z.array(z.object({
        day_of_week: z.number().int().min(0).max(6).describe('0=Sun, 6=Sat'),
        start_time: z.string().regex(/^\d{2}:\d{2}$/).describe('Start time HH:MM'),
        end_time: z.string().regex(/^\d{2}:\d{2}$/).describe('End time HH:MM'),
      })).optional().describe('Replacement availability rules'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Verify schedule ownership
      const { data: schedule, error: schedError } = await ctx.supabase
        .from('availability_schedules')
        .select('id')
        .eq('id', params.schedule_id)
        .eq('user_id', ctx.userId)
        .single();
      if (schedError || !schedule) throw new Error('Schedule not found or access denied');

      // Update schedule metadata
      if (params.name || params.timezone) {
        const updates: Record<string, string> = {};
        if (params.name) updates.name = params.name;
        if (params.timezone) updates.timezone = params.timezone;

        const { error } = await ctx.supabase
          .from('availability_schedules')
          .update(updates)
          .eq('id', params.schedule_id)
          .eq('user_id', ctx.userId);

        if (error) throw new Error(`Failed to update schedule: ${error.message}`);
      }

      // Replace rules if provided
      if (params.rules) {
        // Delete existing rules
        await ctx.supabase
          .from('availability_rules')
          .delete()
          .eq('schedule_id', params.schedule_id);

        // Insert new rules
        if (params.rules.length > 0) {
          const { error } = await ctx.supabase
            .from('availability_rules')
            .insert(params.rules.map((r) => ({
              schedule_id: params.schedule_id,
              day_of_week: r.day_of_week,
              start_time: r.start_time,
              end_time: r.end_time,
            })));

          if (error) throw new Error(`Failed to update rules: ${error.message}`);
        }
      }

      // Return updated schedule
      const { data, error } = await ctx.supabase
        .from('availability_schedules')
        .select('*, availability_rules(*)')
        .eq('id', params.schedule_id)
        .single();

      if (error) throw new Error(`Failed to fetch updated schedule: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.list_event_type_members
  server.tool(
    'calendar.list_event_type_members',
    'List team members assigned to an event type',
    {
      event_type_id: z.string().uuid().describe('Event type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('event_type_members')
        .select('*, users(id, display_name, email)')
        .eq('event_type_id', params.event_type_id);

      if (error) throw new Error(`Failed to list event type members: ${error.message}`);

      // Verify the event type belongs to this project
      const { error: etError } = await ctx.supabase
        .from('event_types')
        .select('id')
        .eq('id', params.event_type_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (etError) throw new Error(`Event type not found: ${etError.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ members: data }) }] };
    }
  );

  // calendar.add_event_type_member
  server.tool(
    'calendar.add_event_type_member',
    'Add a team member to an event type',
    {
      event_type_id: z.string().uuid().describe('Event type ID'),
      user_id: z.string().uuid().describe('User ID to add'),
      priority: z.number().int().min(0).default(0).describe('Priority (0=default)'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Verify event type belongs to this project
      const { error: etError } = await ctx.supabase
        .from('event_types')
        .select('id')
        .eq('id', params.event_type_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (etError) throw new Error(`Event type not found: ${etError.message}`);

      const { data, error } = await ctx.supabase
        .from('event_type_members')
        .insert({
          event_type_id: params.event_type_id,
          user_id: params.user_id,
          priority: params.priority,
        })
        .select('*, users(id, display_name, email)')
        .single();

      if (error) throw new Error(`Failed to add member: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.remove_event_type_member
  server.tool(
    'calendar.remove_event_type_member',
    'Remove a team member from an event type',
    {
      event_type_id: z.string().uuid().describe('Event type ID'),
      user_id: z.string().uuid().describe('User ID to remove'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Verify event type belongs to this project
      const { error: etError } = await ctx.supabase
        .from('event_types')
        .select('id')
        .eq('id', params.event_type_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (etError) throw new Error(`Event type not found: ${etError.message}`);

      const { error } = await ctx.supabase
        .from('event_type_members')
        .delete()
        .eq('event_type_id', params.event_type_id)
        .eq('user_id', params.user_id);

      if (error) throw new Error(`Failed to remove member: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ removed: true }) }] };
    }
  );

  // calendar.get_round_robin_stats
  server.tool(
    'calendar.get_round_robin_stats',
    'Get round robin assignment statistics for an event type',
    {
      event_type_id: z.string().uuid().describe('Event type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      // Verify event type belongs to this project
      const { error: etError } = await ctx.supabase
        .from('event_types')
        .select('id')
        .eq('id', params.event_type_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (etError) throw new Error(`Event type not found: ${etError.message}`);

      const { data, error } = await ctx.supabase
        .from('round_robin_state')
        .select('*')
        .eq('event_type_id', params.event_type_id)
        .single();

      if (error) throw new Error(`Round robin stats not found: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // calendar.get_booking_link
  server.tool(
    'calendar.get_booking_link',
    'Get the public booking URL for an event type',
    {
      event_type_id: z.string().uuid().describe('Event type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      // Get event type slug
      const { data: et, error: etError } = await ctx.supabase
        .from('event_types')
        .select('slug, user_id')
        .eq('id', params.event_type_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (etError) throw new Error(`Event type not found: ${etError.message}`);

      // Get calendar profile slug
      const { data: profile, error: profileError } = await ctx.supabase
        .from('calendar_profiles')
        .select('slug')
        .eq('user_id', et.user_id)
        .single();

      if (profileError) throw new Error(`Calendar profile not found: ${profileError.message}`);

      const bookingUrl = `/book/${profile.slug}/${et.slug}`;

      return { content: [{ type: 'text' as const, text: JSON.stringify({ url: bookingUrl }) }] };
    }
  );
}
