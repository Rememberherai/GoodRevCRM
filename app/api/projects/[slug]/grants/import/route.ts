import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type GrantInsert = Database['public']['Tables']['grants']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const VALID_STATUSES = ['researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined'];

interface ImportRow {
  name: string;
  status?: string;
  amount_requested?: number | string;
  amount_awarded?: number | string;
  funder_name?: string;
  loi_due_at?: string;
  application_due_at?: string;
  report_due_at?: string;
  notes?: string;
  source_url?: string;
  is_discovered?: boolean;
}

// POST /api/projects/[slug]/grants/import - Bulk import grants from mapped CSV data
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create');

    const body = await request.json();
    const { rows, is_discovered: bulkDiscovered } = body as { rows: ImportRow[]; is_discovered?: boolean };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 });
    }

    const results: { row: number; success: boolean; error?: string; grant_id?: string }[] = [];

    // Cache org lookups to avoid repeated queries
    const orgCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ImportRow | undefined;
      if (!row) {
        results.push({ row: i + 1, success: false, error: 'Empty row' });
        continue;
      }

      // Validate required field
      if (!row.name || typeof row.name !== 'string' || row.name.trim().length === 0) {
        results.push({ row: i + 1, success: false, error: 'Name is required' });
        continue;
      }

      // Validate status if provided
      const status = row.status?.toLowerCase().trim();
      if (status && !VALID_STATUSES.includes(status)) {
        results.push({ row: i + 1, success: false, error: `Invalid status: ${row.status}` });
        continue;
      }

      // Resolve funder organization
      let funderOrgId: string | null = null;
      if (row.funder_name && row.funder_name.trim()) {
        const funderName = row.funder_name.trim();

        if (orgCache.has(funderName.toLowerCase())) {
          funderOrgId = orgCache.get(funderName.toLowerCase())!;
        } else {
          // Look up existing org
          const { data: existingOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('project_id', project.id)
            .ilike('name', funderName)
            .is('deleted_at', null)
            .limit(1)
            .single();

          if (existingOrg) {
            funderOrgId = existingOrg.id;
          } else {
            // Create the organization
            const { data: newOrg } = await supabase
              .from('organizations')
              .insert({ name: funderName, project_id: project.id })
              .select('id')
              .single();

            if (newOrg) {
              funderOrgId = newOrg.id;
            }
          }

          if (funderOrgId) {
            orgCache.set(funderName.toLowerCase(), funderOrgId);
          }
        }
      }

      // Parse amounts
      const amountRequested = row.amount_requested ? Number(row.amount_requested) : null;
      const amountAwarded = row.amount_awarded ? Number(row.amount_awarded) : null;

      if (row.amount_requested && (isNaN(amountRequested!) || amountRequested! < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid amount_requested: ${row.amount_requested}` });
        continue;
      }
      if (row.amount_awarded && (isNaN(amountAwarded!) || amountAwarded! < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid amount_awarded: ${row.amount_awarded}` });
        continue;
      }

      const insertData: GrantInsert = {
        project_id: project.id,
        name: row.name.trim(),
        status: (status as GrantInsert['status']) ?? 'researching',
        amount_requested: amountRequested,
        amount_awarded: amountAwarded,
        funder_organization_id: funderOrgId,
        loi_due_at: row.loi_due_at || null,
        application_due_at: row.application_due_at || null,
        report_due_at: row.report_due_at || null,
        notes: row.notes || null,
        source_url: row.source_url || null,
        is_discovered: row.is_discovered ?? bulkDiscovered ?? false,
      };

      const { data: grant, error } = await supabase
        .from('grants')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        results.push({ row: i + 1, success: false, error: error.message });
      } else {
        results.push({ row: i + 1, success: true, grant_id: grant.id });

        // Fire automation event (non-blocking)
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.created',
          entityType: 'grant',
          entityId: grant.id,
          data: insertData as unknown as Record<string, unknown>,
        }).catch(() => {});
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      total: rows.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /grants/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
