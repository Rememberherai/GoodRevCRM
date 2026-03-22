import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchHouseholdsByPlaces,
  fetchHouseholdsByZipCodes,
} from '@/lib/enrichment/census-households';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const requestSchema = z.object({
  type: z.enum(['municipality', 'zip_codes']),
  municipalities: z
    .array(z.object({ city: z.string().min(1), state: z.string().min(2) }))
    .optional(),
  zipCodes: z.array(z.string().regex(/^\d{5}$/)).optional(),
});

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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership (admin/owner only)
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, municipalities, zipCodes } = parsed.data;

    if (type === 'municipality') {
      if (!municipalities || municipalities.length === 0) {
        return NextResponse.json({ error: 'At least one municipality required' }, { status: 400 });
      }
      const results = await fetchHouseholdsByPlaces(municipalities, project.id);
      const total = results.reduce((sum, r) => sum + r.households, 0);
      const totalPopulation = results.reduce((sum, r) => sum + r.population, 0);
      return NextResponse.json({ results, total, totalPopulation });
    }

    if (type === 'zip_codes') {
      if (!zipCodes || zipCodes.length === 0) {
        return NextResponse.json({ error: 'At least one zip code required' }, { status: 400 });
      }
      const results = await fetchHouseholdsByZipCodes(zipCodes, project.id);
      const total = results.reduce((sum, r) => sum + r.households, 0);
      const totalPopulation = results.reduce((sum, r) => sum + r.population, 0);
      return NextResponse.json({ results, total, totalPopulation });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/census-households:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
