import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const updateEmployeeSchema = z.object({
  is_employee: z.boolean().optional(),
  kiosk_pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').nullable().optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().max(100).nullable().optional(),
});

function computePinHmac(projectId: string, pin: string): string {
  const secret = process.env.KIOSK_PIN_SECRET ?? 'dev-kiosk-secret';
  return createHmac('sha256', secret).update(`${projectId}:${pin}`).digest('hex');
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    // Verify person belongs to this project
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    const validation = updateEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (validation.data.is_employee !== undefined) {
      updates.is_employee = validation.data.is_employee;
    }

    if ('kiosk_pin' in validation.data) {
      if (validation.data.kiosk_pin === null) {
        updates.kiosk_pin_hmac = null;
      } else if (validation.data.kiosk_pin) {
        updates.kiosk_pin_hmac = computePinHmac(project.id, validation.data.kiosk_pin);
      }
    }

    if (validation.data.first_name !== undefined) {
      updates.first_name = validation.data.first_name;
    }
    if ('last_name' in validation.data) {
      updates.last_name = validation.data.last_name ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('people')
      .update(updates)
      .eq('id', id)
      .eq('project_id', project.id)
      .select('id, first_name, last_name, email, is_employee, kiosk_pin_hmac, user_id')
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'That PIN is already in use by another employee in this project' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }

    // Return pin_set flag instead of raw HMAC
    const { kiosk_pin_hmac, ...rest } = updated;
    return NextResponse.json({ employee: { ...rest, pin_set: kiosk_pin_hmac !== null } });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/employees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
