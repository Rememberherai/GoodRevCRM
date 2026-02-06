import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { telnyxConnectionSchema } from '@/lib/validators/call';
import { validateApiKey } from '@/lib/telnyx/client';
import { encryptApiKey } from '@/lib/telnyx/encryption';
import { z } from 'zod';

const telnyxUpdateSchema = z.object({
  record_calls: z.boolean().optional(),
  amd_enabled: z.boolean().optional(),
  caller_id_name: z.string().max(50).nullable().optional(),
  call_control_app_id: z.string().nullable().optional(),
  messaging_profile_id: z.string().nullable().optional(),
  sip_connection_id: z.string().nullable().optional(),
  sip_username: z.string().nullable().optional(),
  sip_password: z.string().nullable().optional(),
});

// GET /api/user/telnyx - Get the current user's Telnyx connection
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('telnyx_connections')
      .select('id, user_id, phone_number, phone_number_id, record_calls, amd_enabled, caller_id_name, status, error_message, last_call_at, call_control_app_id, messaging_profile_id, sip_connection_id, sip_username, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    return NextResponse.json({ connection: connection ?? null });
  } catch (error) {
    console.error('Error in GET /api/user/telnyx:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/user/telnyx - Create a new Telnyx connection for the current user
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = telnyxConnectionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Validate API key against Telnyx
    const isValid = await validateApiKey(input.api_key);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Telnyx API key' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Deactivate any existing user connection
    await supabaseAny
      .from('telnyx_connections')
      .update({ status: 'inactive' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Encrypt the API key
    let encryptedApiKey: string;
    try {
      encryptedApiKey = encryptApiKey(input.api_key);
    } catch (encryptError) {
      console.error('Error encrypting API key:', encryptError);
      return NextResponse.json(
        { error: 'Encryption configuration error. Contact administrator.' },
        { status: 500 }
      );
    }

    // Create new user-level connection (no project_id)
    const { data: connection, error } = await supabaseAny
      .from('telnyx_connections')
      .insert({
        user_id: user.id,
        created_by: user.id,
        api_key: encryptedApiKey,
        call_control_app_id: input.call_control_app_id ?? null,
        messaging_profile_id: input.messaging_profile_id ?? null,
        sip_connection_id: input.sip_connection_id ?? null,
        sip_username: input.sip_username ?? null,
        sip_password: input.sip_password ?? null,
        phone_number: input.phone_number,
        phone_number_id: input.phone_number_id ?? null,
        record_calls: input.record_calls ?? false,
        amd_enabled: input.amd_enabled ?? false,
        caller_id_name: input.caller_id_name ?? null,
        status: 'active',
      })
      .select('id, user_id, phone_number, record_calls, amd_enabled, caller_id_name, status, call_control_app_id, messaging_profile_id, sip_connection_id, sip_username, created_at')
      .single();

    if (error) {
      console.error('Error creating Telnyx connection:', error);
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
    }

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/user/telnyx:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/user/telnyx - Update the current user's connection settings
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = telnyxUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;
    const updates: Record<string, unknown> = {};
    if (input.record_calls !== undefined) updates.record_calls = input.record_calls;
    if (input.amd_enabled !== undefined) updates.amd_enabled = input.amd_enabled;
    if (input.caller_id_name !== undefined) updates.caller_id_name = input.caller_id_name;
    if (input.call_control_app_id !== undefined) updates.call_control_app_id = input.call_control_app_id;
    if (input.messaging_profile_id !== undefined) updates.messaging_profile_id = input.messaging_profile_id;
    if (input.sip_connection_id !== undefined) updates.sip_connection_id = input.sip_connection_id;
    if (input.sip_username !== undefined) updates.sip_username = input.sip_username;
    if (input.sip_password !== undefined) updates.sip_password = input.sip_password;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection, error } = await (supabase as any)
      .from('telnyx_connections')
      .update(updates)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .select('id, user_id, phone_number, record_calls, amd_enabled, caller_id_name, status, call_control_app_id, messaging_profile_id, sip_connection_id, sip_username, updated_at')
      .single();

    if (error) {
      console.error('Error updating Telnyx connection:', error);
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    console.error('Error in PATCH /api/user/telnyx:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/user/telnyx - Deactivate the current user's connection
export async function DELETE() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('telnyx_connections')
      .update({ status: 'inactive' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error) {
      console.error('Error deactivating Telnyx connection:', error);
      return NextResponse.json({ error: 'Failed to deactivate connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/user/telnyx:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
