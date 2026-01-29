import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateCustomFieldDefinitionSchema } from '@/lib/validators/custom-field';
import type { Database } from '@/types/database';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];
type CustomFieldDefinitionUpdate = Database['public']['Tables']['custom_field_definitions']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/schema/[id] - Get single custom field definition
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // Fetch field
    const { data: field, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !field) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    return NextResponse.json({ field: field as CustomFieldDefinition });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/schema/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/schema/[id] - Update custom field definition
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // Check that the field exists
    const { data: existingField, error: fieldError } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (fieldError || !existingField) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateCustomFieldDefinitionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build the update object
    const updateData: CustomFieldDefinitionUpdate = {};
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.is_required !== undefined) updateData.is_required = updates.is_required;
    if (updates.is_unique !== undefined) updateData.is_unique = updates.is_unique;
    if (updates.is_searchable !== undefined) updateData.is_searchable = updates.is_searchable;
    if (updates.is_filterable !== undefined) updateData.is_filterable = updates.is_filterable;
    if (updates.is_visible_in_list !== undefined) updateData.is_visible_in_list = updates.is_visible_in_list;
    if (updates.display_order !== undefined) updateData.display_order = updates.display_order;
    if (updates.group_name !== undefined) updateData.group_name = updates.group_name;
    if (updates.options !== undefined) updateData.options = updates.options;
    if (updates.default_value !== undefined) updateData.default_value = updates.default_value;
    if (updates.validation_rules !== undefined) updateData.validation_rules = updates.validation_rules;

    const { data: field, error } = await supabase
      .from('custom_field_definitions')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating custom field:', error);
      return NextResponse.json({ error: 'Failed to update custom field' }, { status: 500 });
    }

    return NextResponse.json({ field: field as CustomFieldDefinition });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/schema/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/schema/[id] - Delete custom field definition
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // Get the field to be deleted (for entity type)
    const { data: fieldToDelete } = await supabase
      .from('custom_field_definitions')
      .select('entity_type, name')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!fieldToDelete) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    // Delete the field
    const { error } = await supabase
      .from('custom_field_definitions')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting custom field:', error);
      return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 });
    }

    // Note: Optionally, you could clean up the custom_fields JSONB data
    // from entities that have this field. This would require a database
    // function like remove_custom_field_data() mentioned in the TODO.
    // For now, we just delete the definition and the data becomes orphaned.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/schema/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
