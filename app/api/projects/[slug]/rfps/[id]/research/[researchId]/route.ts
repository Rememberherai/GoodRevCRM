import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { RfpResearchResult } from '@/types/rfp-research';

interface RouteContext {
  params: Promise<{ slug: string; id: string; researchId: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/research/[researchId] - Get specific research result (for polling)
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId, researchId } = await context.params;
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

    // Verify RFP exists and belongs to project
    const { data: rfp, error: rfpError } = await supabase
      .from('rfps')
      .select('id')
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Fetch the specific research result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any)
      .from('rfp_research_results')
      .select('*')
      .eq('id', researchId)
      .eq('rfp_id', rfpId)
      .single();

    if (error || !result) {
      return NextResponse.json({ error: 'Research result not found' }, { status: 404 });
    }

    return NextResponse.json({
      result: result as RfpResearchResult,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/[id]/research/[researchId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
