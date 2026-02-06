import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { reorderFieldsSchema } from '@/lib/validators/custom-field';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/schema/reorder - Reorder custom field definitions
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = reorderFieldsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { field_orders } = validationResult.data;

    // Verify all supplied field IDs belong to this project
    const fieldIds = field_orders.map((f) => f.id);
    const { data: existingFields, error: lookupError } = await supabase
      .from('custom_field_definitions')
      .select('id')
      .in('id', fieldIds)
      .eq('project_id', project.id);

    if (lookupError) {
      return NextResponse.json({ error: 'Failed to verify fields' }, { status: 500 });
    }

    const existingIds = new Set((existingFields || []).map((f) => f.id));
    const invalidIds = fieldIds.filter((id) => !existingIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Some field IDs do not belong to this project' },
        { status: 400 }
      );
    }

    // Update each field's display_order
    // We do this in a loop since Supabase doesn't support batch updates easily
    const updates = field_orders.map(async ({ id, display_order }) => {
      return supabase
        .from('custom_field_definitions')
        .update({ display_order })
        .eq('id', id)
        .eq('project_id', project.id);
    });

    const results = await Promise.all(updates);

    // Check for any errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Error reordering fields:', errors);
      return NextResponse.json({ error: 'Failed to reorder some fields' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/schema/reorder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
