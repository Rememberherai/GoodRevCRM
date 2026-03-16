import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { detectPersonDuplicates, detectOrganizationDuplicates } from '@/lib/deduplication';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const processSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
  mapping: z.record(z.string(), z.string()),
  entity_type: z.enum(['person', 'organization', 'opportunity', 'task']),
  options: z.object({
    skip_duplicates: z.boolean().optional(),
    update_existing: z.boolean().optional(),
    duplicate_key: z.string().optional(),
  }).optional(),
});

// POST /api/projects/[slug]/import/[id]/process - Process imported CSV rows
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: jobId } = await context.params;
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
    const validation = processSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { rows, mapping, entity_type, options } = validation.data;
    const opts = options ?? { skip_duplicates: false, update_existing: false };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Load thresholds
    const { data: settings } = await sb
      .from('dedup_settings')
      .select('min_match_threshold, auto_merge_threshold')
      .eq('project_id', project.id)
      .single();

    const minThreshold = settings?.min_match_threshold ? Number(settings.min_match_threshold) : 0.60;
    const autoMergeThreshold = settings?.auto_merge_threshold ? Number(settings.auto_merge_threshold) : 0.95;

    const results = {
      created: 0,
      skipped_duplicates: 0,
      updated: 0,
      failed: 0,
      flagged_for_review: 0,
      errors: [] as Array<{ row: number; message: string; field?: string }>,
    };

    // Update job status to processing
    await sb
      .from('import_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), total_rows: rows.length })
      .eq('id', jobId)
      .eq('project_id', project.id);

    for (let i = 0; i < rows.length; i++) {
      try {
        // Map CSV columns to entity fields
        const record: Record<string, unknown> = {};
        const row = rows[i]!;
        for (const [csvCol, entityField] of Object.entries(mapping)) {
          if (entityField && row[csvCol] !== undefined && row[csvCol] !== '') {
            record[entityField] = row[csvCol];
          }
        }

        if (entity_type === 'person') {
          await processPersonRow(record, project.id, user.id, opts, minThreshold, autoMergeThreshold, results, i, sb);
        } else if (entity_type === 'organization') {
          await processOrgRow(record, project.id, user.id, opts, minThreshold, autoMergeThreshold, results, i, sb);
        } else {
          // For opportunity/task, simple insert without dedup
          const table = entity_type === 'opportunity' ? 'opportunities' : 'tasks';
          const { error } = await sb.from(table).insert({
            ...record,
            project_id: project.id,
            created_by: user.id,
          });
          if (error) {
            results.failed++;
            results.errors.push({ row: i + 1, message: error.message });
          } else {
            results.created++;
          }
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    // Update job with results
    await sb
      .from('import_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_rows: rows.length,
        successful_rows: results.created + results.updated,
        failed_rows: results.failed,
        error_log: results.errors.length > 0 ? results.errors.slice(0, 100) : null,
      })
      .eq('id', jobId)
      .eq('project_id', project.id);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/import/[id]/process:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface ProcessOptions {
  skip_duplicates?: boolean;
  update_existing?: boolean;
  duplicate_key?: string;
}

interface ProcessResults {
  created: number;
  skipped_duplicates: number;
  updated: number;
  failed: number;
  flagged_for_review: number;
  errors: Array<{ row: number; message: string }>;
}

async function processPersonRow(
  record: Record<string, unknown>,
  projectId: string,
  userId: string,
  options: ProcessOptions,
  minThreshold: number,
  autoMergeThreshold: number,
  results: ProcessResults,
  rowIndex: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const dupes = await detectPersonDuplicates(
    {
      email: (record.email as string) ?? null,
      first_name: (record.first_name as string) ?? null,
      last_name: (record.last_name as string) ?? null,
      phone: (record.phone as string) ?? null,
      mobile_phone: (record.mobile_phone as string) ?? null,
      linkedin_url: (record.linkedin_url as string) ?? null,
    },
    { entityType: 'person', projectId, minThreshold },
    supabase as SupabaseClient
  );

  if (dupes.length > 0) {
    const bestMatch = dupes[0]!;

    if (bestMatch.score >= autoMergeThreshold && options.update_existing) {
      const updateFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (value && !bestMatch.record[key]) {
          updateFields[key] = value;
        }
      }
      if (Object.keys(updateFields).length > 0) {
        await supabase.from('people').update(updateFields).eq('id', bestMatch.target_id);
      }
      results.updated++;
      return;
    }

    if (options.skip_duplicates) {
      results.skipped_duplicates++;
      return;
    }

    const { data: person, error } = await supabase
      .from('people')
      .insert({ ...record, project_id: projectId, created_by: userId })
      .select('id')
      .single();

    if (error || !person) {
      results.failed++;
      results.errors.push({ row: rowIndex + 1, message: error?.message ?? 'Insert failed' });
      return;
    }

    await supabase.from('duplicate_candidates').insert({
      project_id: projectId,
      entity_type: 'person',
      source_id: person.id,
      target_id: bestMatch.target_id,
      match_score: bestMatch.score,
      match_reasons: bestMatch.reasons,
      detection_source: 'csv_import',
      status: 'pending',
    });

    results.created++;
    results.flagged_for_review++;
    return;
  }

  const { error } = await supabase
    .from('people')
    .insert({ ...record, project_id: projectId, created_by: userId });

  if (error) {
    results.failed++;
    results.errors.push({ row: rowIndex + 1, message: error.message });
  } else {
    results.created++;
  }
}

async function processOrgRow(
  record: Record<string, unknown>,
  projectId: string,
  userId: string,
  options: ProcessOptions,
  minThreshold: number,
  autoMergeThreshold: number,
  results: ProcessResults,
  rowIndex: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const dupes = await detectOrganizationDuplicates(
    {
      name: (record.name as string) ?? null,
      domain: (record.domain as string) ?? null,
      website: (record.website as string) ?? null,
      linkedin_url: (record.linkedin_url as string) ?? null,
    },
    { entityType: 'organization', projectId, minThreshold },
    supabase as SupabaseClient
  );

  if (dupes.length > 0) {
    const bestMatch = dupes[0]!;

    if (bestMatch.score >= autoMergeThreshold && options.update_existing) {
      const updateFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (value && !bestMatch.record[key]) {
          updateFields[key] = value;
        }
      }
      if (Object.keys(updateFields).length > 0) {
        await supabase.from('organizations').update(updateFields).eq('id', bestMatch.target_id);
      }
      results.updated++;
      return;
    }

    if (options.skip_duplicates) {
      results.skipped_duplicates++;
      return;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({ ...record, project_id: projectId, created_by: userId })
      .select('id')
      .single();

    if (error || !org) {
      results.failed++;
      results.errors.push({ row: rowIndex + 1, message: error?.message ?? 'Insert failed' });
      return;
    }

    await supabase.from('duplicate_candidates').insert({
      project_id: projectId,
      entity_type: 'organization',
      source_id: org.id,
      target_id: bestMatch.target_id,
      match_score: bestMatch.score,
      match_reasons: bestMatch.reasons,
      detection_source: 'csv_import',
      status: 'pending',
    });

    results.created++;
    results.flagged_for_review++;
    return;
  }

  const { error } = await supabase
    .from('organizations')
    .insert({ ...record, project_id: projectId, created_by: userId });

  if (error) {
    results.failed++;
    results.errors.push({ row: rowIndex + 1, message: error.message });
  } else {
    results.created++;
  }
}
