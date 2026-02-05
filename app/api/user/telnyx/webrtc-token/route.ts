import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/user/telnyx/webrtc-token - Get WebRTC credentials for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('telnyx_connections')
      .select('sip_username, sip_password, sip_connection_id, phone_number')
      .eq('user_id', user.id)
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
    console.error('Error in GET /api/user/telnyx/webrtc-token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
