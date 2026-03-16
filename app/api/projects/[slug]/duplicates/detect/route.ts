import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { detectDuplicates } from '@/lib/deduplication';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const detectSchema = z.object({
  entity_type: z.enum(['person', 'organization']),
  record: z.record(z.string(), z.unknown()),
  source: z.enum(['manual_creation', 'csv_import', 'epa_import', 'contact_discovery', 'bulk_scan']).optional(),
  exclude_ids: z.array(z.string()).optional(),
});

// POST /api/projects/[slug]/duplicates/detect - Check for duplicates before creation
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    const body = await request.json();
    const validation = detectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { entity_type, record, exclude_ids } = validation.data;

    // Load project-specific thresholds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('dedup_settings')
      .select('min_match_threshold')
      .eq('project_id', project.id)
      .single();

    const minThreshold = settings?.min_match_threshold ? Number(settings.min_match_threshold) : undefined;

    const result = await detectDuplicates(
      record as Record<string, string | null>,
      {
        entityType: entity_type,
        projectId: project.id,
        excludeIds: exclude_ids,
        minThreshold,
      },
      supabase
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/duplicates/detect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
