import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/telnyx/webrtc-token - Get WebRTC credentials
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('telnyx_connections')
      .select('sip_username, sip_password, sip_connection_id, phone_number')
      .eq('project_id', project.id)
      .eq('status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active Telnyx connection' },
        { status: 404 }
      );
    }

    if (!connection.sip_username || !connection.sip_password) {
      return NextResponse.json(
        { error: 'WebRTC credentials not configured. Set SIP username and password in Phone settings.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      username: connection.sip_username,
      password: connection.sip_password,
      callerNumber: connection.phone_number,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/telnyx/webrtc-token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
