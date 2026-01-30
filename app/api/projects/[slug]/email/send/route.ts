import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmailSchema } from '@/lib/validators/gmail';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/email/send - Send an email
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

    const body = await request.json();

    // Extract connection ID separately
    const { from_connection_id, ...emailData } = body;

    if (!from_connection_id) {
      return NextResponse.json({ error: 'Gmail connection required' }, { status: 400 });
    }

    // Validate email data
    const validationResult = sendEmailSchema.safeParse(emailData);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get Gmail connection
    const { data: connection, error: connectionError } = await supabaseAny
      .from('gmail_connections')
      .select('*')
      .eq('id', from_connection_id)
      .eq('user_id', user.id)
      .eq('project_id', project.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Gmail connection not found' }, { status: 404 });
    }

    if (connection.status !== 'connected') {
      return NextResponse.json(
        { error: 'Gmail connection is not active. Please reconnect.' },
        { status: 400 }
      );
    }

    // Send the email
    const result = await sendEmail(
      connection as GmailConnection,
      validationResult.data,
      user.id
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/email/send:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
