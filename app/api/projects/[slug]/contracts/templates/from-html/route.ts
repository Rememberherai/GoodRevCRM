import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWaiverFromHtmlSchema } from '@/lib/validators/contract';
import { htmlToPdf } from '@/lib/contracts/html-to-pdf';
import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';
import type { Database } from '@/types/database';

type TemplateInsert = Database['public']['Tables']['contract_templates']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json();
  const result = createWaiverFromHtmlSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
  }

  const { name, description, html_content, include_signature_line, program_id } = result.data;

  // Check that the HTML has actual text content, not just empty tags
  const textContent = html_content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (!textContent) {
    return NextResponse.json({ error: 'Waiver content cannot be empty' }, { status: 400 });
  }

  // Generate PDF from HTML
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await htmlToPdf(html_content, { includeSignatureLine: include_signature_line });
  } catch (err) {
    console.error('[WAIVER_FROM_HTML] PDF generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate PDF from content' }, { status: 500 });
  }

  // Count actual pages in generated PDF
  let pageCount = 1;
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pageCount = pdfDoc.getPageCount();
  } catch {
    // Fall back to 1 if we can't read the PDF we just generated
  }

  // Upload to storage
  const fileId = crypto.randomUUID();
  const fileName = `${name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'waiver'}.pdf`;
  const storagePath = `${project.id}/templates/${fileId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[WAIVER_FROM_HTML] Storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Failed to upload generated PDF' }, { status: 500 });
  }

  // Create contract template
  const templateData: TemplateInsert = {
    project_id: project.id,
    created_by: user.id,
    name,
    description: description ?? null,
    category: 'waiver',
    file_path: storagePath,
    file_name: fileName,
    page_count: pageCount,
    roles: [],
    fields: [],
    merge_fields: [],
    html_content: html_content,
  };

  const { data: template, error: templateError } = await supabase
    .from('contract_templates')
    .insert(templateData)
    .select()
    .single();

  if (templateError) {
    console.error('[WAIVER_FROM_HTML] Template creation failed:', templateError);
    // Clean up orphaned storage file
    await supabase.storage.from('contracts').remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  // Auto-link to program if program_id provided
  let waiver = null;
  if (program_id) {
    const { data: waiverRow, error: waiverError } = await supabase
      .from('program_waivers')
      .insert({ program_id, template_id: template.id })
      .select()
      .single();

    if (waiverError) {
      console.error('[WAIVER_FROM_HTML] Program waiver link failed:', waiverError);
    } else {
      waiver = waiverRow;
    }
  }

  return NextResponse.json({ template, waiver }, { status: 201 });
}
