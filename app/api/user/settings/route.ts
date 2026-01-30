import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { userSettingsSchema } from '@/lib/validators/user';

// GET /api/user/settings - Get user settings
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: settings, error } = await supabaseAny
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        user_id: user.id,
        theme: 'system',
        timezone: 'UTC',
        date_format: 'MMM dd, yyyy',
        time_format: 'HH:mm',
        notifications_email: true,
        notifications_push: true,
        notifications_digest: 'daily',
        default_project_id: null,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in GET /api/user/settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/user/settings - Update user settings
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = userSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Upsert settings
    const { data: settings, error } = await supabaseAny
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          ...validationResult.data,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating user settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in PUT /api/user/settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
