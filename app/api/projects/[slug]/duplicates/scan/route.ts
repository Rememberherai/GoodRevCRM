import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { detectPersonDuplicates, detectOrganizationDuplicates } from '@/lib/deduplication';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const scanSchema = z.object({
  entity_type: z.enum(['person', 'organization']),
  max_results: z.number().min(1).max(500).optional().default(100),
});

// POST /api/projects/[slug]/duplicates/scan - Bulk scan existing records
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
    const validation = scanSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { entity_type, max_results } = validation.data;
    const table = entity_type === 'person' ? 'people' : 'organizations';

    // Load project-specific thresholds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('dedup_settings')
      .select('min_match_threshold')
      .eq('project_id', project.id)
      .single();

    const minThreshold = settings?.min_match_threshold ? Number(settings.min_match_threshold) : undefined;

    // Fetch records to scan (ordered by creation date, newest first)
    const { data: records } = await supabase
      .from(table)
      .select('*')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!records || records.length === 0) {
      return NextResponse.json({ found: 0, candidates_created: 0 });
    }

    // Track already-known pairs to avoid duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCandidates } = await (supabase as any)
      .from('duplicate_candidates')
      .select('source_id, target_id')
      .eq('project_id', project.id)
      .eq('entity_type', entity_type);

    const existingPairs = new Set(
      (existingCandidates ?? []).map((c: any) => `${c.source_id}:${c.target_id}`)
    );

    let candidatesCreated = 0;
    const scannedIds = new Set<string>();

    for (const record of records) {
      if (candidatesCreated >= max_results) break;
      scannedIds.add(record.id);

      const detectFn = entity_type === 'person' ? detectPersonDuplicates : detectOrganizationDuplicates;
      const matches = await detectFn(
        record as Record<string, string | null>,
        {
          entityType: entity_type,
          projectId: project.id,
          excludeIds: [record.id, ...Array.from(scannedIds)],
          minThreshold,
        },
        supabase
      );

      for (const match of matches) {
        if (candidatesCreated >= max_results) break;

        const pairKey = `${record.id}:${match.target_id}`;
        const reversePairKey = `${match.target_id}:${record.id}`;
        if (existingPairs.has(pairKey) || existingPairs.has(reversePairKey)) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('duplicate_candidates')
          .insert({
            project_id: project.id,
            entity_type,
            source_id: record.id,
            target_id: match.target_id,
            match_score: match.score,
            match_reasons: match.reasons,
            detection_source: 'bulk_scan',
            status: 'pending',
          });

        if (!insertError) {
          candidatesCreated++;
          existingPairs.add(pairKey);
        }
      }
    }

    return NextResponse.json({
      found: candidatesCreated,
      candidates_created: candidatesCreated,
      records_scanned: records.length,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/duplicates/scan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
