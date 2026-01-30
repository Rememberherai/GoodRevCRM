import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notificationQuerySchema, markReadSchema, archiveSchema } from '@/lib/validators/notification';

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
        const projectId = body.project_id as string | null;

        const { data: count } = await supabase.rpc(
          'mark_all_notifications_read' as never,
          { p_project_id: projectId || null } as never
        );

        return NextResponse.json({ updated: count || 0 });
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

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing notification action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
