import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import type { Database } from '@/types/database';

type DocInsert = Database['public']['Tables']['contract_documents']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string; tid: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug, tid } = await context.params;
  const supabase = await createClient();
  const adminClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', tid)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const body = await request.json();
  const { title, opportunity_id, organization_id, person_id } = body;
  const documentId = crypto.randomUUID();

  const { data: templateFile, error: downloadError } = await adminClient.storage
    .from('contracts')
    .download(template.file_path);

  if (downloadError || !templateFile) {
    console.error('[CONTRACT_FROM_TEMPLATE] Failed to download template file:', downloadError);
    return NextResponse.json({ error: 'Failed to read template file' }, { status: 500 });
  }

  const fileBytes = new Uint8Array(await templateFile.arrayBuffer());
  const fileHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const documentFilePath = `${project.id}/documents/${documentId}/${template.file_name}`;

  const { error: uploadError } = await adminClient.storage
    .from('contracts')
    .upload(documentFilePath, fileBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[CONTRACT_FROM_TEMPLATE] Failed to copy template file:', uploadError);
    return NextResponse.json({ error: 'Failed to create document file from template' }, { status: 500 });
  }

  const docData: DocInsert = {
    id: documentId,
    project_id: project.id,
    title: title ?? template.name,
    original_file_path: documentFilePath,
    original_file_name: template.file_name,
    original_file_hash: fileHash,
    page_count: template.page_count,
    template_id: tid,
    opportunity_id: opportunity_id ?? null,
    organization_id: organization_id ?? null,
    person_id: person_id ?? null,
    created_by: user.id,
    owner_id: user.id,
  };

  const { data: document, error } = await supabase
    .from('contract_documents')
    .insert(docData)
    .select()
    .single();

  if (error) {
    console.error('[CONTRACT_FROM_TEMPLATE] Create error:', error);
    await adminClient.storage.from('contracts').remove([documentFilePath]).catch(() => undefined);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }

  // Update template use count
  await supabase
    .from('contract_templates')
    .update({
      use_count: (template.use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', tid)
    .eq('project_id', project.id);

  insertAuditTrail({
    project_id: project.id,
    document_id: document.id,
    action: 'created',
    actor_type: 'user',
    actor_id: user.id,
    details: { from_template: tid, template_name: template.name },
  });

  return NextResponse.json({ contract: document }, { status: 201 });
}
