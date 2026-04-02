import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { getDefaultDisposition } from '@/lib/dispositions/service';
import type { Database } from '@/types/database';

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const VALID_STRING_FIELDS = new Set([
  'name', 'domain', 'website', 'industry', 'description', 'phone',
  'linkedin_url', 'address_street', 'address_city', 'address_state',
  'address_postal_code', 'address_country',
]);

interface ImportRow {
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  description?: string;
  phone?: string;
  employee_count?: number | string;
  annual_revenue?: number | string;
  linkedin_url?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
}

// POST /api/projects/[slug]/organizations/import - Bulk import organizations from mapped CSV data
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();
    const { rows } = body as { rows: ImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 });
    }

    // Get default disposition once for all rows
    const defaultDisp = await getDefaultDisposition(
      { supabase, projectId: project.id, userId: user.id },
      'organization'
    );

    const results: { row: number; success: boolean; error?: string; organization_id?: string }[] = [];

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

      // Parse numeric fields
      const employeeCount = row.employee_count != null && row.employee_count !== ''
        ? Number(String(row.employee_count).replace(/[,$]/g, ''))
        : null;
      const annualRevenue = row.annual_revenue != null && row.annual_revenue !== ''
        ? Number(String(row.annual_revenue).replace(/[,$]/g, ''))
        : null;

      if (employeeCount != null && (isNaN(employeeCount) || employeeCount < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid employee_count: ${row.employee_count}` });
        continue;
      }
      if (annualRevenue != null && (isNaN(annualRevenue) || annualRevenue < 0)) {
        results.push({ row: i + 1, success: false, error: `Invalid annual_revenue: ${row.annual_revenue}` });
        continue;
      }

      // Build string fields
      const stringData: Record<string, string | null> = {};
      for (const field of VALID_STRING_FIELDS) {
        if (field === 'name') continue; // handled separately
        const val = (row as unknown as Record<string, unknown>)[field];
        if (val != null && typeof val === 'string' && val.trim() !== '') {
          stringData[field] = val.trim();
        }
      }

      // Auto-derive domain from website if not provided
      if (!stringData.domain && stringData.website) {
        try {
          let url = stringData.website;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          stringData.domain = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          // ignore invalid URL
        }
      }

      const insertData: OrganizationInsert = {
        project_id: project.id,
        created_by: user.id,
        name: row.name.trim(),
        ...stringData,
        employee_count: employeeCount,
        annual_revenue: annualRevenue,
        disposition_id: defaultDisp?.id ?? null,
      };

      const { data: organization, error } = await supabase
        .from('organizations')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        results.push({ row: i + 1, success: false, error: error.message });
      } else {
        results.push({ row: i + 1, success: true, organization_id: organization.id });

        // Fire automation event (non-blocking)
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.created',
          entityType: 'organization',
          entityId: organization.id,
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
    console.error('Error in POST /organizations/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
