import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { decrypt, encrypt, maskApiKey } from '@/lib/encryption';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

/**
 * GET  — Returns the receiver URL + masked token (last 4 chars only).
 * POST — Generates a new secret token, encrypts and stores it, returns plaintext once.
 */

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: workflow } = await supabaseAny
      .from('workflows').select('id, trigger_type, trigger_config')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const hasToken = !!(workflow.trigger_config?.webhook_secret_enc);
    let maskedToken: string | null = null;
    if (hasToken) {
      try {
        maskedToken = maskApiKey(decrypt(workflow.trigger_config.webhook_secret_enc as string));
      } catch {
        maskedToken = '••••••••';
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const receiverUrl = `${baseUrl}/api/webhooks/workflow/${slug}/${id}`;

    return NextResponse.json({
      has_token: hasToken,
      masked_token: maskedToken,
      receiver_url: receiverUrl,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('GET /webhook-token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'update');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: workflow } = await supabaseAny
      .from('workflows').select('id, trigger_type, trigger_config, current_version, definition')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    // Generate a new plaintext token (32 random bytes = 64 hex chars)
    const plainToken = randomBytes(32).toString('hex');
    const encryptedToken = encrypt(plainToken);

    // Merge into existing trigger_config
    const newTriggerConfig = {
      ...(workflow.trigger_config ?? {}),
      webhook_secret_enc: encryptedToken,
    };
    const newVersion = (workflow.current_version ?? 0) + 1;

    const { error: updateError } = await supabaseAny
      .from('workflows')
      .update({
        trigger_type: 'webhook_inbound',
        trigger_config: newTriggerConfig,
        current_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', project.id);

    if (updateError) {
      console.error('Failed to save webhook token:', updateError.message);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    const { error: versionError } = await supabaseAny
      .from('workflow_versions')
      .insert({
        workflow_id: id,
        version: newVersion,
        definition: workflow.definition,
        trigger_type: 'webhook_inbound',
        trigger_config: newTriggerConfig,
        change_summary: workflow.trigger_type === 'webhook_inbound'
          ? 'Regenerated inbound webhook token'
          : 'Configured inbound webhook token',
        created_by: user.id,
      });
    if (versionError) {
      console.error('Failed to create workflow version for webhook token:', versionError.message);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const receiverUrl = `${baseUrl}/api/webhooks/workflow/${slug}/${id}`;

    return NextResponse.json({
      // Return plaintext token ONCE — it cannot be retrieved again
      token: plainToken,
      receiver_url: receiverUrl,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('POST /webhook-token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
