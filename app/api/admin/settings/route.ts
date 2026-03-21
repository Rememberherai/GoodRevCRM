import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSystemAdmin, logAdminAction } from '@/lib/admin/permissions';
import { getSystemSettings } from '@/lib/admin/queries';
import { adminSettingUpdateSchema } from '@/lib/admin/validators';
import type { Json } from '@/types/database';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    const settings = await getSystemSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    const body = await request.json();
    const { key, value } = adminSettingUpdateSchema.parse(body);

    const adminClient = createAdminClient();

    // Get old value for audit log
    const { data: oldSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    const { error } = await adminClient
      .from('system_settings')
      .upsert({ key, value: value as Json, updated_by: user.id }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(user.id, 'updated_system_setting', 'setting', null, {
      key,
      old_value: oldSetting?.value,
      new_value: value,
    }, request);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
