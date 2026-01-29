import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createCustomFieldDefinitionSchema } from '@/lib/validators/custom-field';
import type { Database } from '@/types/database';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];
type CustomFieldDefinitionInsert = Database['public']['Tables']['custom_field_definitions']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/schema - List custom field definitions
export async function GET(request: Request, context: RouteContext) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    // Build query
    let query = supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('project_id', project.id)
      .order('entity_type')
      .order('display_order');

    // Filter by entity type if provided
    if (entityType) {
      query = query.eq('entity_type', entityType as Database['public']['Enums']['entity_type']);
    }

    const { data: fields, error } = await query;

    if (error) {
      console.error('Error fetching custom fields:', error);
      return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 });
    }

    return NextResponse.json({ fields: fields as CustomFieldDefinition[] });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/schema:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/schema - Create custom field definition
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
    const validationResult = createCustomFieldDefinitionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Check if field name already exists for this entity type in this project
    const { data: existingField } = await supabase
      .from('custom_field_definitions')
      .select('id')
      .eq('project_id', project.id)
      .eq('entity_type', validatedData.entity_type)
      .eq('name', validatedData.name)
      .single();

    if (existingField) {
      return NextResponse.json(
        { error: `A field with name "${validatedData.name}" already exists for this entity type` },
        { status: 400 }
      );
    }

    // Get the next display order
    const { data: maxOrderField } = await supabase
      .from('custom_field_definitions')
      .select('display_order')
      .eq('project_id', project.id)
      .eq('entity_type', validatedData.entity_type)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = maxOrderField ? maxOrderField.display_order + 1 : 0;

    const fieldData: CustomFieldDefinitionInsert = {
      project_id: project.id,
      name: validatedData.name,
      label: validatedData.label,
      description: validatedData.description ?? null,
      entity_type: validatedData.entity_type,
      field_type: validatedData.field_type,
      is_required: validatedData.is_required ?? false,
      is_unique: validatedData.is_unique ?? false,
      is_searchable: validatedData.is_searchable ?? false,
      is_filterable: validatedData.is_filterable ?? false,
      is_visible_in_list: validatedData.is_visible_in_list ?? true,
      display_order: validatedData.display_order ?? nextDisplayOrder,
      group_name: validatedData.group_name ?? null,
      options: validatedData.options ?? [],
      default_value: validatedData.default_value ?? null,
      validation_rules: validatedData.validation_rules ?? null,
      created_by: user.id,
    };

    const { data: field, error } = await supabase
      .from('custom_field_definitions')
      .insert(fieldData)
      .select()
      .single();

    if (error) {
      console.error('Error creating custom field:', error);
      return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 });
    }

    return NextResponse.json({ field: field as CustomFieldDefinition }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/schema:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
