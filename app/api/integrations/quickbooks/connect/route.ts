import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicAppUrl } from '@/lib/url/get-public-url';
import { buildQuickBooksConnectUrl } from '@/lib/assistant/quickbooks';
import { signQuickBooksOAuthState } from '@/lib/assistant/quickbooks-oauth-state';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('project');
    if (!slug) {
      return NextResponse.json({ error: 'Project slug is required' }, { status: 400 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type === 'community') {
      await requireCommunityPermission(supabase, user.id, project.id, 'settings', 'update');
    } else {
      await requireProjectRole(supabase, user.id, project.id, 'admin');
    }

    const state = signQuickBooksOAuthState({
      project_id: project.id,
      user_id: user.id,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      type: 'quickbooks',
    });

    const origin = getPublicAppUrl(request);
    return NextResponse.redirect(buildQuickBooksConnectUrl({
      requestOrigin: origin,
      state,
    }));
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[QUICKBOOKS_CONNECT] Error starting OAuth flow:', error);
    return NextResponse.json({ error: 'Failed to start QuickBooks OAuth flow' }, { status: 500 });
  }
}
