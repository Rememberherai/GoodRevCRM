import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';
import { verifyResendDomain, getResendDomainStatus } from '@/lib/email/resend';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/projects/[slug]/settings/email-providers/verify-domain
 * Trigger domain verification check with Resend and update the config.
 * Expects { config_id }.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Check admin/owner
    const isOwner = project.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await supabase
        .from('project_memberships')
        .select('role')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .single();
      const role = (membership as { role?: string } | null)?.role;
      if (role !== 'admin' && role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { config_id } = body;

    if (!config_id) {
      return NextResponse.json({ error: 'config_id is required' }, { status: 400 });
    }

    // Fetch the config to get API key
    const { data: config } = await supabase
      .from('email_send_configs')
      .select('*')
      .eq('id', config_id)
      .eq('project_id', project.id)
      .eq('provider', 'resend')
      .single();

    if (!config || !config.resend_api_key_encrypted) {
      return NextResponse.json({ error: 'Resend config not found' }, { status: 404 });
    }
    if (!config.resend_domain_id) {
      return NextResponse.json({ error: 'This Resend config has no registered domain id.' }, { status: 400 });
    }

    const apiKey = decrypt(config.resend_api_key_encrypted);

    // Trigger verification
    const verifyResult = await verifyResendDomain(apiKey, config.resend_domain_id);

    // Get current DNS records
    const domainStatus = await getResendDomainStatus(apiKey, config.resend_domain_id);

    // Update verification status in DB
    if (verifyResult.verified) {
      await supabase
        .from('email_send_configs')
        .update({ domain_verified: true })
        .eq('id', config_id);
    }

    return NextResponse.json({
      verified: verifyResult.verified,
      records: domainStatus?.records ?? [],
      error: verifyResult.error,
    });
  } catch (error) {
    console.error('Error in verify-domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
