import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/gmail/oauth';
import crypto from 'crypto';

// GET /api/gmail/connect - Initiate Gmail OAuth flow
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project slug from query params
    const projectSlug = searchParams.get('project');
    if (!projectSlug) {
      return NextResponse.json({ error: 'Project slug required' }, { status: 400 });
    }

    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', projectSlug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate a secure state parameter
    const stateData = {
      user_id: user.id,
      project_id: project.id,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };

    // Encode state as base64 for URL safety
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Store state in a short-lived manner (could use Redis in production)
    // For now, we'll verify the timestamp on callback

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(state);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error in GET /api/gmail/connect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
