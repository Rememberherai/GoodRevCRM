import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Fetch original document
  const { data: original } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!original) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Copy the PDF file in storage
  const serviceClient = createServiceClient();
  const newDocId = crypto.randomUUID();
  const newFilePath = `${project.id}/documents/${newDocId}/${original.original_file_name}`;
  let uploadedFile = false;

  const cleanupFailedClone = async () => {
    if (uploadedFile) {
      await serviceClient.storage
        .from('contracts')
        .remove([newFilePath]);
    }

    await serviceClient
      .from('contract_documents')
      .delete()
      .eq('id', newDocId)
      .eq('project_id', project.id);
  };

  const { data: fileData } = await serviceClient.storage
    .from('contracts')
    .download(original.original_file_path);

  if (!fileData) {
    return NextResponse.json({ error: 'Failed to copy original PDF' }, { status: 500 });
  }

  const fileBytes = new Uint8Array(await fileData.arrayBuffer());
  const { error: uploadError } = await serviceClient.storage
    .from('contracts')
    .upload(newFilePath, fileBytes, { contentType: 'application/pdf' });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload cloned PDF' }, { status: 500 });
  }
  uploadedFile = true;

  // Create new document as draft
  const { data: newDoc, error: createError } = await supabase
    .from('contract_documents')
    .insert({
      id: newDocId,
      project_id: project.id,
      title: `${original.title} (Copy)`,
      description: original.description,
      original_file_path: newFilePath,
      original_file_name: original.original_file_name,
      original_file_hash: original.original_file_hash,
      page_count: original.page_count,
      signing_order_type: original.signing_order_type,
      reminder_enabled: original.reminder_enabled,
      reminder_interval_days: original.reminder_interval_days,
      send_completed_copy_to_sender: original.send_completed_copy_to_sender,
      send_completed_copy_to_recipients: original.send_completed_copy_to_recipients,
      notify_on_view: original.notify_on_view,
      notify_on_sign: original.notify_on_sign,
      notify_on_decline: original.notify_on_decline,
      template_id: original.template_id,
      opportunity_id: original.opportunity_id,
      organization_id: original.organization_id,
      person_id: original.person_id,
      created_by: user.id,
      owner_id: user.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (createError || !newDoc) {
    await cleanupFailedClone();
    return NextResponse.json({ error: 'Failed to create cloned document' }, { status: 500 });
  }

  // Clone recipients (as pending, new tokens)
  const { data: originalRecipients } = await supabase
    .from('contract_recipients')
    .select('id, name, email, role, signing_order, person_id')
    .eq('document_id', id)
    .eq('project_id', project.id);

  const recipientIdMap = new Map<string, string>();

  for (const r of originalRecipients ?? []) {
    const newRecipientId = crypto.randomUUID();
    const { error: recipientError } = await supabase.from('contract_recipients').insert({
      id: newRecipientId,
      project_id: project.id,
      document_id: newDoc.id,
      name: r.name,
      email: r.email,
      role: r.role,
      signing_order: r.signing_order,
      person_id: r.person_id,
      status: 'pending',
    });
    if (recipientError) {
      console.error('[CONTRACT_CLONE] Failed to clone recipient:', recipientError);
      await cleanupFailedClone();
      return NextResponse.json({ error: 'Failed to clone recipients' }, { status: 500 });
    }
    recipientIdMap.set(r.id, newRecipientId);
  }

  // Clone fields (placements only, no values)
  const { data: originalFields } = await supabase
    .from('contract_fields')
    .select('recipient_id, field_type, label, placeholder, is_required, page_number, x, y, width, height, options, validation_rule, auto_populate_from')
    .eq('document_id', id)
    .eq('project_id', project.id);

  for (const f of originalFields ?? []) {
    const newRecipientId = recipientIdMap.get(f.recipient_id);
    if (!newRecipientId) {
      console.error('[CONTRACT_CLONE] Missing recipient mapping for field clone');
      await cleanupFailedClone();
      return NextResponse.json({ error: 'Failed to map cloned fields to recipients' }, { status: 500 });
    }

    const { error: fieldError } = await supabase.from('contract_fields').insert({
      project_id: project.id,
      document_id: newDoc.id,
      recipient_id: newRecipientId,
      field_type: f.field_type,
      label: f.label,
      placeholder: f.placeholder,
      is_required: f.is_required,
      page_number: f.page_number,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      options: f.options,
      validation_rule: f.validation_rule,
      auto_populate_from: f.auto_populate_from,
      // No value or filled_at — clean slate
    });
    if (fieldError) {
      console.error('[CONTRACT_CLONE] Failed to clone field:', fieldError);
      await cleanupFailedClone();
      return NextResponse.json({ error: 'Failed to clone fields' }, { status: 500 });
    }
  }

  insertAuditTrail({
    project_id: project.id,
    document_id: newDoc.id,
    action: 'created',
    actor_type: 'user',
    actor_id: user.id,
    details: { cloned_from: id },
  });

  return NextResponse.json({ id: newDoc.id }, { status: 201 });
}
