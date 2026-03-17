import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';
import { isBlockedUrl } from '@/lib/workflows/ssrf-guard';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/api-connections/[id]/test
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { data: connection } = await supabaseAny
      .from('api_connections').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    let testResult: { success: boolean; message: string; latency_ms?: number } = {
      success: false,
      message: 'Unknown service type',
    };

    try {
      const config = connection.config_enc ? JSON.parse(decrypt(connection.config_enc)) : {};
      const startTime = Date.now();

      switch (connection.service_type) {
        case 'webhook': {
          const url = config.url;
          if (!url) {
            testResult = { success: false, message: 'No URL configured' };
            break;
          }
          if (isBlockedUrl(url)) {
            testResult = { success: false, message: 'URL points to a blocked internal address' };
            break;
          }
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10000),
          });
          testResult = {
            success: response.ok,
            message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
            latency_ms: Date.now() - startTime,
          };
          break;
        }

        case 'zapier':
        case 'mcp': {
          const serverUrl = config.url || config.server_url;
          if (!serverUrl) {
            testResult = { success: false, message: 'No server URL configured' };
            break;
          }
          if (isBlockedUrl(serverUrl)) {
            testResult = { success: false, message: 'URL points to a blocked internal address' };
            break;
          }
          const response = await fetch(serverUrl, {
            method: 'GET',
            headers: config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {},
            signal: AbortSignal.timeout(10000),
          });
          testResult = {
            success: response.ok || response.status === 405,
            message: response.ok || response.status === 405 ? 'Server reachable' : `HTTP ${response.status}`,
            latency_ms: Date.now() - startTime,
          };
          break;
        }

        case 'api_key': {
          testResult = { success: !!config.api_key, message: config.api_key ? 'API key configured' : 'No API key configured' };
          break;
        }

        case 'oauth2': {
          testResult = {
            success: !!config.access_token,
            message: config.access_token ? 'OAuth token present' : 'No OAuth token configured',
          };
          break;
        }
      }
    } catch (err) {
      testResult = {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      };
    }

    // Update health status
    await supabaseAny
      .from('api_connections')
      .update({
        status: testResult.success ? 'active' : 'error',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json(testResult);
  } catch (error) {
    console.error('Error in POST /api-connections/[id]/test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
