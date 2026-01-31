import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { ResearchJob, ResearchResult } from '@/types/research';
import { createFieldMappings } from '@/types/research';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/research/[id] - Get single research job with field mappings
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

    // Use type assertion since table isn't in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch research job
    const { data: job, error } = await supabaseAny
      .from('research_jobs')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Research job not found' }, { status: 404 });
    }

    const typedJob = job as ResearchJob;

    // If job is completed, generate field mappings
    if (typedJob.status === 'completed' && typedJob.result) {
      // Fetch the current entity data
      let entity: Record<string, unknown> | null = null;

      if (typedJob.entity_type === 'organization') {
        const { data } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', typedJob.entity_id)
          .single();
        entity = data;
      } else if (typedJob.entity_type === 'person') {
        const { data } = await supabase
          .from('people')
          .select('*')
          .eq('id', typedJob.entity_id)
          .single();
        entity = data;
      }

      // Fetch custom field definitions
      const { data: customFieldDefs } = await supabase
        .from('custom_field_definitions')
        .select('name')
        .eq('project_id', project.id)
        .eq('entity_type', typedJob.entity_type)
        .is('deleted_at', null);

      const customFieldNames = (customFieldDefs ?? []).map((f: { name: string }) => f.name);

      console.log('[RESEARCH-GET] Custom field definitions from DB', JSON.stringify({
        count: customFieldNames.length,
        names: customFieldNames,
      }));

      console.log('[RESEARCH-GET] Research result custom_fields', JSON.stringify({
        hasCustomFields: !!(typedJob.result as Record<string, unknown>)?.custom_fields,
        customFieldsContent: (typedJob.result as Record<string, unknown>)?.custom_fields,
      }, null, 2));

      // Generate field mappings
      const fieldMappings = createFieldMappings(
        typedJob.result as ResearchResult,
        typedJob.entity_type,
        entity ?? {},
        customFieldNames
      );

      return NextResponse.json({
        job: typedJob,
        field_mappings: fieldMappings,
      });
    }

    return NextResponse.json({ job: typedJob });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/research/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
