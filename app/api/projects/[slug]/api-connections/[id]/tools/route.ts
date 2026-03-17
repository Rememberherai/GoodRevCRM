import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';
import { isBlockedUrl } from '@/lib/workflows/ssrf-guard';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/api-connections/[id]/tools - List available tools for MCP/Zapier connections
export async function GET(request: Request, context: RouteContext) {
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
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data: connection } = await supabaseAny
      .from('api_connections').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    if (!['zapier', 'mcp'].includes(connection.service_type)) {
      return NextResponse.json({ error: 'Tool listing only available for Zapier and MCP connections' }, { status: 400 });
    }

    // Check for ?refresh=true query param
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Check cached tool manifest first (unless force refresh)
    if (!forceRefresh) {
      const { data: mcpServer } = await supabaseAny
        .from('mcp_external_servers')
        .select('tool_manifest')
        .eq('project_id', project.id)
        .eq('connection_id', id)
        .single();

      if (mcpServer?.tool_manifest?.tools) {
        return NextResponse.json({ tools: mcpServer.tool_manifest.tools, cached: true });
      }
    }

    // Decrypt connection credentials
    let config: { api_key?: string; server_url?: string };
    try {
      config = JSON.parse(decrypt(connection.config_enc));
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt connection credentials' }, { status: 500 });
    }

    const serverUrl = config.server_url || (connection.service_type === 'zapier' ? 'https://actions.zapier.com/mcp' : '');
    if (!serverUrl) {
      return NextResponse.json({ error: 'No server URL configured' }, { status: 400 });
    }

    if (isBlockedUrl(serverUrl)) {
      return NextResponse.json({ error: 'URL points to a blocked internal address' }, { status: 400 });
    }

    // Fetch tool list from the MCP server using JSON-RPC tools/list
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.api_key) {
        headers['Authorization'] = `Bearer ${config.api_key}`;
      }

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json({
          error: `MCP server returned ${response.status}`,
          tools: [],
        }, { status: 502 });
      }

      const data = await response.json();
      const tools = data.result?.tools || data.tools || [];

      // Cache the tool manifest
      await supabaseAny.from('mcp_external_servers').upsert({
        project_id: project.id,
        connection_id: id,
        name: connection.name,
        server_url: serverUrl,
        transport_type: 'http',
        is_active: true,
        tool_manifest: { tools, fetched_at: new Date().toISOString() },
      }, { onConflict: 'project_id,connection_id' }).select();

      // Update connection health check
      await supabaseAny
        .from('api_connections')
        .update({ last_health_check: new Date().toISOString(), status: 'active' })
        .eq('id', id);

      return NextResponse.json({ tools, cached: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      // Update connection status to error
      await supabaseAny
        .from('api_connections')
        .update({ status: 'error', last_health_check: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({
        error: `Failed to fetch tools: ${message}`,
        tools: [],
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Error in GET /api-connections/[id]/tools:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
