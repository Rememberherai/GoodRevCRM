import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import { NextResponse } from 'next/server';
import {
  createCalendarProfileSchema,
  updateCalendarProfileSchema,
} from '@/lib/validators/calendar';

function normalizeProfilePayload(body: Record<string, unknown>) {
  const normalized = { ...body };

  if (typeof normalized.slug === 'string') {
    normalized.slug = normalized.slug.trim().toLowerCase();
  }

  if (typeof normalized.display_name === 'string') {
    normalized.display_name = normalized.display_name.trim();
  }

  if (typeof normalized.timezone === 'string') {
    normalized.timezone = normalized.timezone.trim();
  }

  if (typeof normalized.bio === 'string') {
    normalized.bio = normalized.bio.trim();
  }

  if (typeof normalized.welcome_message === 'string') {
    normalized.welcome_message = normalized.welcome_message.trim();
  }

  return normalized;
}

// GET /api/calendar/profile — Get current user's calendar profile
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error } = await supabase
      .from('calendar_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/calendar/profile — Create calendar profile
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = normalizeProfilePayload(await request.json());
    const result = createCalendarProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const insertData = {
      ...result.data,
      user_id: user.id,
      booking_page_theme: result.data.booking_page_theme as Json,
    } satisfies Database['public']['Tables']['calendar_profiles']['Insert'];

    const { data: profile, error } = await supabase
      .from('calendar_profiles')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Profile already exists or slug is taken' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/calendar/profile — Update calendar profile
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = normalizeProfilePayload(await request.json());
    const result = updateCalendarProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = result.data as Record<string, unknown>;
    const { data: profile, error } = await supabase
      .from('calendar_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Profile not found. Create a profile first.' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug is already taken' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
