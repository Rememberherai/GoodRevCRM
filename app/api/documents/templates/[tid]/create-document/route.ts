import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import crypto from 'crypto';

interface RouteContext {
  params: Promise<{ tid: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch template (RLS handles access)
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', tid)
    .is('deleted_at', null)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body as { title?: string }).title || template.name;

  const serviceClient = createServiceClient();
  const documentId = crypto.randomUUID();
  const pathPrefix = `standalone/${user.id}`;
  const newPath = `${pathPrefix}/documents/${documentId}/${template.file_name}`;

  // Download template PDF and re-upload
  const { data: fileData } = await serviceClient.storage
    .from('contracts')
    .download(template.file_path);

  if (!fileData) {
    return NextResponse.json({ error: 'Failed to download template PDF' }, { status: 500 });
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  const { error: uploadError } = await serviceClient.storage
    .from('contracts')
    .upload(newPath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
  }

  // Create document
  const { data: document, error: insertError } = await serviceClient
    .from('contract_documents')
    .insert({
      id: documentId,
      project_id: null, // Standalone
      title,
      template_id: tid,
      original_file_path: newPath,
      original_file_name: template.file_name,
      original_file_hash: hash,
      page_count: template.page_count,
      created_by: user.id,
      owner_id: user.id,
    })
    .select()
    .single();

  if (insertError || !document) {
    await serviceClient.storage.from('contracts').remove([newPath]);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }

  // Increment template use count
  await serviceClient
    .from('contract_templates')
    .update({
      use_count: (template.use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', tid);

  insertAuditTrail({
    project_id: null,
    document_id: documentId,
    action: 'created',
    actor_type: 'user',
    actor_id: user.id,
    details: { from_template: tid, template_name: template.name },
  });

  return NextResponse.json({ document }, { status: 201 });
}
