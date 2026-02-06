import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { preferenceQuerySchema, updatePreferencesSchema } from '@/lib/validators/notification';
import { isValidUUID } from '@/lib/validation-helpers';

// GET /api/notifications/preferences - Get user preferences
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
    const queryResult = preferenceQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { project_id } = queryResult.data;

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id);

    if (project_id) {
      if (!isValidUUID(project_id)) {
        return NextResponse.json({ error: 'Invalid project_id' }, { status: 400 });
      }
      query = query.or(`project_id.eq.${project_id},project_id.is.null`);
    }

    const { data: preferences, error } = await query;

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications/preferences - Update preferences
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

    // Parse and validate body
    const body = await request.json();
    const validationResult = updatePreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { preferences, project_id } = validationResult.data;

    // Upsert each preference
    const results = [];
    for (const pref of preferences) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            project_id: project_id || null,
            notification_type: pref.notification_type,
            email_enabled: pref.email_enabled ?? true,
            push_enabled: pref.push_enabled ?? true,
            in_app_enabled: pref.in_app_enabled ?? true,
          },
          {
            onConflict: 'user_id,project_id,notification_type',
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Error upserting preference:', error);
      } else {
        results.push(data);
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
