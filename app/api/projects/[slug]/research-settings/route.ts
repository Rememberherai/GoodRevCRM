import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { EntityType } from '@/types/custom-field';

// Validation schema for research settings
const researchSettingsSchema = z.object({
  entity_type: z.enum(['organization', 'person', 'opportunity', 'rfp']),
  system_prompt: z.string().max(10000).nullable().optional(),
  user_prompt_template: z.string().max(10000).nullable().optional(),
  model_id: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(100).max(16000).optional(),
  default_confidence_threshold: z.number().min(0).max(1).optional(),
  auto_apply_high_confidence: z.boolean().optional(),
  high_confidence_threshold: z.number().min(0).max(1).optional(),
});

// GET - Fetch all research settings for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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

  // Get research settings
  // Use type assertion since table isn't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings, error } = await (supabase as any)
    .from('research_settings')
    .select('*')
    .eq('project_id', project.id);

  if (error) {
    console.error('Error fetching research settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }

  return NextResponse.json({ settings: settings ?? [] });
}

// POST - Create or update research settings for an entity type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = researchSettingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.issues },
      { status: 400 }
    );
  }

  const { entity_type, ...settingsData } = result.data;

  // Upsert settings (insert or update)
  // Use type assertion since table isn't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings, error } = await (supabase as any)
    .from('research_settings')
    .upsert(
      {
        project_id: project.id,
        entity_type: entity_type as EntityType,
        ...settingsData,
        created_by: user.id,
      },
      {
        onConflict: 'project_id,entity_type',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving research settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ settings });
}
