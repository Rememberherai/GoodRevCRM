import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { EntityType } from '@/types/custom-field';
import type { ColumnConfig } from '@/types/table-columns';
import { getDefaultColumnConfig, COLUMN_DEFINITIONS } from '@/lib/table-columns/definitions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const columnConfigSchema = z.object({
  key: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0),
  width: z.number().int().min(50).max(800).optional(),
});

const savePreferencesSchema = z.object({
  entity_type: z.enum(['organization', 'person', 'opportunity', 'rfp']),
  columns: z.array(columnConfigSchema),
});

// GET /api/projects/[slug]/column-preferences - Fetch user's column preferences
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get entity_type from query params (optional)
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entity_type') as EntityType | null;

    // Get project by slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build query for preferences
    let query = supabase
      .from('table_column_preferences')
      .select('*')
      .eq('project_id', project.id)
      .eq('user_id', user.id);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data: preferences, error: prefsError } = await query;

    if (prefsError) {
      console.error('Error fetching column preferences:', prefsError);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // If requesting a specific entity type and no preferences exist, return defaults
    if (entityType && (!preferences || preferences.length === 0)) {
      return NextResponse.json({
        preferences: null,
        defaults: getDefaultColumnConfig(entityType),
      });
    }

    // Return all preferences
    return NextResponse.json({
      preferences: entityType ? preferences?.[0] ?? null : preferences,
      defaults: entityType ? getDefaultColumnConfig(entityType) : null,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/column-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/column-preferences - Save column preferences
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = savePreferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { entity_type, columns } = parseResult.data;

    // Validate that column keys are valid for this entity type
    const validKeys = new Set(COLUMN_DEFINITIONS[entity_type].map(c => c.key));
    const invalidKeys = columns
      .filter(c => !c.key.startsWith('custom_') && !validKeys.has(c.key))
      .map(c => c.key);

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid column keys: ${invalidKeys.join(', ')}` },
        { status: 400 }
      );
    }

    // Get project by slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Upsert preferences
    const { data: savedPrefs, error: saveError } = await supabase
      .from('table_column_preferences')
      .upsert(
        {
          project_id: project.id,
          user_id: user.id,
          entity_type,
          columns: columns as unknown as ColumnConfig[],
        },
        {
          onConflict: 'project_id,user_id,entity_type',
        }
      )
      .select()
      .single();

    if (saveError) {
      console.error('Error saving column preferences:', saveError);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences: savedPrefs });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/column-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
