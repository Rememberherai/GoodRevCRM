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
const VALID_CATEGORIES = ['federal', 'state', 'corporate', 'foundation', 'individual'];
const VALID_URGENCIES = ['low', 'medium', 'high', 'critical'];

interface ImportRow {
  name: string;
  status?: string;
  category?: string;
  amount_requested?: number | string;
  amount_awarded?: number | string;
  funding_range_min?: number | string;
  funding_range_max?: number | string;
  funder_name?: string;
  mission_fit?: number | string;
  tier?: number | string;
  urgency?: string;
  loi_due_at?: string;
  application_due_at?: string;
  report_due_at?: string;
  application_url?: string;
  key_intel?: string;
  recommended_strategy?: string;
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
          // Look up existing org — escape SQL wildcards to prevent unintended matches
          const escapedName = funderName.replace(/[%_]/g, '\\$&');
          const { data: existingOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('project_id', project.id)
            .ilike('name', escapedName)
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

      // Parse amounts (use != null to preserve numeric 0)
      const amountRequested = row.amount_requested != null ? Number(row.amount_requested) : null;
      const amountAwarded = row.amount_awarded != null ? Number(row.amount_awarded) : null;

      if (amountRequested != null && (isNaN(amountRequested) || amountRequested < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid amount_requested: ${row.amount_requested}` });
        continue;
      }
      if (amountAwarded != null && (isNaN(amountAwarded) || amountAwarded < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid amount_awarded: ${row.amount_awarded}` });
        continue;
      }

      // Parse new numeric fields (use != null to preserve numeric 0)
      const fundingRangeMin = row.funding_range_min != null ? Number(row.funding_range_min) : null;
      const fundingRangeMax = row.funding_range_max != null ? Number(row.funding_range_max) : null;
      const missionFit = row.mission_fit != null ? Number(row.mission_fit) : null;
      const tier = row.tier != null ? Number(row.tier) : null;

      // Validate category
      const category = row.category?.toLowerCase().trim() || null;
      if (category && !VALID_CATEGORIES.includes(category)) {
        results.push({ row: i + 1, success: false, error: `Invalid category: ${row.category}` });
        continue;
      }

      // Validate urgency
      const urgency = row.urgency?.toLowerCase().trim() || null;
      if (urgency && !VALID_URGENCIES.includes(urgency)) {
        results.push({ row: i + 1, success: false, error: `Invalid urgency: ${row.urgency}` });
        continue;
      }

      // Validate mission_fit (1-5) and tier (1-3)
      if (missionFit != null && (isNaN(missionFit) || missionFit < 1 || missionFit > 5)) {
        results.push({ row: i + 1, success: false, error: `Invalid mission_fit (must be 1-5): ${row.mission_fit}` });
        continue;
      }
      if (tier != null && (isNaN(tier) || tier < 1 || tier > 3)) {
        results.push({ row: i + 1, success: false, error: `Invalid tier (must be 1-3): ${row.tier}` });
        continue;
      }

      // Validate funding range values
      if (fundingRangeMin != null && isNaN(fundingRangeMin)) {
        results.push({ row: i + 1, success: false, error: `Invalid funding_range_min: ${row.funding_range_min}` });
        continue;
      }
      if (fundingRangeMax != null && isNaN(fundingRangeMax)) {
        results.push({ row: i + 1, success: false, error: `Invalid funding_range_max: ${row.funding_range_max}` });
        continue;
      }
      if (fundingRangeMin != null && fundingRangeMax != null && fundingRangeMin > fundingRangeMax) {
        results.push({ row: i + 1, success: false, error: 'funding_range_min must be <= funding_range_max' });
        continue;
      }

      const insertData: GrantInsert = {
        project_id: project.id,
        name: row.name.trim(),
        status: (status as GrantInsert['status']) ?? 'researching',
        category: category as GrantInsert['category'],
        amount_requested: amountRequested,
        amount_awarded: amountAwarded,
        funding_range_min: fundingRangeMin,
        funding_range_max: fundingRangeMax,
        funder_organization_id: funderOrgId,
        mission_fit: missionFit,
        tier: tier,
        urgency: urgency as GrantInsert['urgency'],
        loi_due_at: row.loi_due_at || null,
        application_due_at: row.application_due_at || null,
        report_due_at: row.report_due_at || null,
        application_url: row.application_url || null,
        key_intel: row.key_intel || null,
        recommended_strategy: row.recommended_strategy || null,
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
