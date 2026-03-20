import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPendingCommunityGeocodes } from '@/lib/community/geocoding-queue';

// POST /api/cron/process-geocodes — Geocodes pending households and community assets
export async function POST(request: Request) {
  const authorized = await verifyCronAuth(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Find all community projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('project_type', 'community')
      .is('deleted_at', null);

    if (!projects || projects.length === 0) {
      return NextResponse.json({ success: true, message: 'No community projects', results: [] });
    }

    const results = [];
    for (const project of projects) {
      const result = await processPendingCommunityGeocodes(supabase, project.id, 20);
      if (result.processed > 0) {
        results.push({ project_id: project.id, ...result });
      }
    }

    return NextResponse.json({
      success: true,
      projects_checked: projects.length,
      results,
    });
  } catch (err) {
    console.error('Process geocodes cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support GET for cron-job.org
export async function GET(request: Request) {
  return POST(request);
}
