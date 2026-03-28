import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateTemplateSchema, renderTemplateSchema } from '@/lib/validators/email-template';
import { deriveFieldsFromDesign } from '@/lib/email-builder/derive-fields';

// GET /api/projects/[slug]/templates/[id] - Get template details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template, error: templateError } = await (supabase as any)
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get attachments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: attachments } = await (supabase as any)
      .from('email_template_attachments')
      .select('*')
      .eq('template_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      ...template,
      attachments: attachments || [],
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/templates/[id] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = updateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // When the row is builder-backed, always re-derive body_html and body_text from design_json.
    // Use the request's design_json if provided, otherwise fall back to the existing row's design.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingTemplate } = await (supabase as any)
      .from('email_templates')
      .select('design_json')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const designForDerive = validationResult.data.design_json !== undefined
      ? validationResult.data.design_json
      : existingTemplate.design_json;
    const deriveResult = deriveFieldsFromDesign(designForDerive, 'body_text', { validate: true });
    if (deriveResult.status === 'invalid') {
      return NextResponse.json({ error: deriveResult.error }, { status: 400 });
    }
    const derived = deriveResult.status === 'ok' ? deriveResult.fields : {};

    // When design_json is the canonical source, strip any client-sent body_html/body_text
    // to prevent drift between design and rendered output
    const updatePayload = { ...validationResult.data };
    if (designForDerive != null) {
      delete updatePayload.body_html;
      delete updatePayload.body_text;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template, error: updateError } = await (supabase as any)
      .from('email_templates')
      .update({ ...updatePayload, ...derived })
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error updating template:', updateError);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/templates/[id] - Delete template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check admin access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (deleteError) {
      console.error('Error deleting template:', deleteError);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/templates/[id] - Render template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = renderTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Render template
    const { data: rendered, error: renderError } = await supabase.rpc(
      'render_email_template' as never,
      {
        p_template_id: id,
        p_variables: validationResult.data.variables,
      } as never
    );

    if (renderError) {
      console.error('Error rendering template:', renderError);
      return NextResponse.json({ error: 'Failed to render template' }, { status: 500 });
    }

    // Increment usage
    await supabase.rpc('increment_template_usage' as never, { p_template_id: id } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (rendered as any)?.[0] || rendered;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error rendering template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
