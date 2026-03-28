import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createBroadcastSchema } from '@/lib/validators/community/broadcasts';
import { resolveBroadcastRecipients } from '@/lib/community/broadcasts';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { deriveFieldsFromDesign } from '@/lib/email-builder/derive-fields';
import type { Database, Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

type BroadcastInsert = Database['public']['Tables']['broadcasts']['Insert'];

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'view');

    const { data, error } = await supabase.from('broadcasts').select('*').eq('project_id', project.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ broadcasts: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/broadcasts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'create');

    const body = await request.json();
    const validation = createBroadcastSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const requestedStatus = validation.data.status ?? 'draft';
    if (!['draft', 'scheduled'].includes(requestedStatus)) {
      return NextResponse.json(
        { error: `Cannot create a broadcast with status "${requestedStatus}".` },
        { status: 400 }
      );
    }

    if (requestedStatus === 'scheduled') {
      if (!validation.data.scheduled_at) {
        return NextResponse.json({ error: 'scheduled_at is required when creating a scheduled broadcast.' }, { status: 400 });
      }
      if (new Date(validation.data.scheduled_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduled_at must be in the future.' }, { status: 400 });
      }
    }

    if (validation.data.send_config_id) {
      const { data: sendConfig } = await supabase
        .from('email_send_configs')
        .select('id, provider, domain_verified')
        .eq('id', validation.data.send_config_id)
        .eq('project_id', project.id)
        .single();

      if (!sendConfig) {
        return NextResponse.json({ error: 'Selected email provider was not found for this project.' }, { status: 400 });
      }
      if (sendConfig.provider === 'resend' && sendConfig.domain_verified !== true) {
        return NextResponse.json({ error: 'Selected Resend provider must have a verified domain before it can be used.' }, { status: 400 });
      }
    }

    const recipientPreview = await resolveBroadcastRecipients(project.id, validation.data.filter_criteria as unknown as Json);

    // When design_json is present, derive body_html and body server-side
    const deriveResult = deriveFieldsFromDesign(validation.data.design_json, 'body', { validate: true });
    if (deriveResult.status === 'invalid') {
      return NextResponse.json({ error: deriveResult.error }, { status: 400 });
    }
    const derived = deriveResult.status === 'ok' ? deriveResult.fields : {};

    // The refinement guarantees either body or design_json is present.
    // When design_json is present, derived includes body from renderDesignToText.
    // When design_json is absent, validation.data.body is guaranteed non-empty.
    const insertData = {
      ...validation.data,
      ...derived,
      status: requestedStatus,
      project_id: project.id,
      created_by: user.id,
      filter_criteria: validation.data.filter_criteria as unknown as Json,
      design_json: validation.data.design_json as unknown as Json | undefined,
      scheduled_at: requestedStatus === 'scheduled' ? validation.data.scheduled_at : null,
      sent_at: null,
      failure_reason: null,
    } as BroadcastInsert;

    const { data, error } = await supabase
      .from('broadcasts')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create broadcast');
    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.created', entityType: 'broadcast', entityId: data.id, data: data as unknown as Record<string, unknown> });
    return NextResponse.json({ broadcast: data, recipient_count: recipientPreview.length }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/broadcasts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
