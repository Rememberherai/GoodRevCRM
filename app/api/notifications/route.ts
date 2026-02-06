import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notificationQuerySchema, markReadSchema, markAllReadSchema, createNotificationSchema, archiveSchema } from '@/lib/validators/notification';
import { z } from 'zod';

const deleteNotificationSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});

// GET /api/notifications - List notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = notificationQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { type, is_read, is_archived, priority, project_id, limit, offset } = queryResult.data;

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read);
    }

    // By default, don't show archived
    if (is_archived !== undefined) {
      query = query.eq('is_archived', is_archived);
    } else {
      query = query.eq('is_archived', false);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get unread count
    const { data: unreadCount } = await supabase.rpc(
      'get_unread_notification_count' as never,
      { p_project_id: project_id || null } as never
    );

    return NextResponse.json({
      data: notifications,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - Mark as read or archive
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'mark_read': {
        const validationResult = markReadSchema.safeParse(body);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.flatten() },
            { status: 400 }
          );
        }

        const { data: count } = await supabase.rpc(
          'mark_notifications_read' as never,
          { p_notification_ids: validationResult.data.notification_ids } as never
        );

        return NextResponse.json({ updated: count || 0 });
      }

      case 'mark_all_read': {
        const markAllResult = markAllReadSchema.safeParse(body);
        if (!markAllResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: markAllResult.error.flatten() },
            { status: 400 }
          );
        }

        const { data: count } = await supabase.rpc(
          'mark_all_notifications_read' as never,
          { p_project_id: markAllResult.data.project_id || null } as never
        );

        return NextResponse.json({ updated: count || 0 });
      }

      case 'create': {
        const createResult = createNotificationSchema.omit({ user_id: true }).safeParse(body);
        if (!createResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: createResult.error.flatten() },
            { status: 400 }
          );
        }

        const validated = createResult.data;
        const { data: notificationId, error: createError } = await supabase.rpc(
          'create_notification' as never,
          {
            p_user_id: user.id,
            p_type: validated.type,
            p_title: validated.title,
            p_message: validated.message,
            p_project_id: validated.project_id || null,
            p_data: validated.data || {},
            p_entity_type: validated.entity_type || null,
            p_entity_id: validated.entity_id || null,
            p_priority: validated.priority || 'normal',
            p_action_url: validated.action_url || null,
          } as never
        );

        if (createError) {
          console.error('Error creating notification:', createError);
          return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
        }

        return NextResponse.json({ id: notificationId });
      }

      case 'archive': {
        const validationResult = archiveSchema.safeParse(body);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.flatten() },
            { status: 400 }
          );
        }

        const { data: count } = await supabase.rpc(
          'archive_notifications' as never,
          { p_notification_ids: validationResult.data.notification_ids } as never
        );

        return NextResponse.json({ archived: count || 0 });
      }

      case 'delete': {
        const deleteResult = deleteNotificationSchema.safeParse(body);
        if (!deleteResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: deleteResult.error.flatten() },
            { status: 400 }
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase as any)
          .from('notifications')
          .delete()
          .in('id', deleteResult.data.notification_ids)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting notifications:', deleteError);
          return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
        }

        return NextResponse.json({ deleted: deleteResult.data.notification_ids.length });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing notification action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
