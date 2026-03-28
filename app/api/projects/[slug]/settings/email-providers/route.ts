import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt } from '@/lib/encryption';
import { addResendDomain, findResendDomainByName } from '@/lib/email/resend';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const createConfigSchema = z.object({
  provider: z.enum(['gmail', 'resend']),
  gmail_connection_id: z.string().uuid().nullable().optional(),
  resend_api_key: z.string().min(1).optional(),
  from_email: z.string().email().optional(),
  from_name: z.string().max(100).optional(),
  domain: z.string().max(253).optional(),
  is_default: z.boolean().optional(),
});

const updateConfigSchema = z.object({
  resend_api_key: z.string().min(1).optional(),
  from_email: z.string().email().optional(),
  from_name: z.string().max(100).optional(),
  is_default: z.boolean().optional(),
});

async function requireAdminOrOwner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, slug: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return null;

  const isOwner = project.owner_id === userId;
  if (isOwner) return project;

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', userId)
    .single();

  const role = (membership as { role?: string } | null)?.role;
  if (role === 'admin' || role === 'owner') return project;

  return null;
}

async function getScopedGmailConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  gmailConnectionId: string
) {
  const { data } = await supabase
    .from('gmail_connections')
    .select('id, email, project_id, status')
    .eq('id', gmailConnectionId)
    .eq('project_id', projectId)
    .eq('status', 'active')
    .maybeSingle();

  return data;
}

/**
 * GET /api/projects/[slug]/settings/email-providers
 * List email send configs for a project. API keys are masked.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: configs, error } = await supabase
      .from('email_send_configs')
      .select('*, gmail_connections(email)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching email_send_configs:', error);
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }

    // Mask API keys in response
    const masked = (configs ?? []).map((config) => {
      const gmailEmail = Array.isArray(config.gmail_connections)
        ? config.gmail_connections[0]?.email
        : (config.gmail_connections as { email: string } | null)?.email;

      return {
        id: config.id,
        provider: config.provider,
        gmail_connection_id: config.gmail_connection_id,
        gmail_email: gmailEmail ?? null,
        from_email: config.from_email,
        from_name: config.from_name,
        domain: config.domain,
        domain_verified: config.domain_verified,
        is_default: config.is_default,
        resend_api_key_masked: config.resend_api_key_encrypted
          ? '••••••••'
          : null,
        created_at: config.created_at,
        updated_at: config.updated_at,
      };
    });

    return NextResponse.json({ configs: masked });
  } catch (error) {
    console.error('Error in GET email-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/settings/email-providers
 * Create a new email send config.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await requireAdminOrOwner(supabase, user.id, slug);
    if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const validation = createConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, gmail_connection_id, resend_api_key, from_email, from_name, domain, is_default } = validation.data;
    let gmailEmail: string | null = null;

    // Provider-specific validation
    if (provider === 'resend') {
      if (!resend_api_key) {
        return NextResponse.json({ error: 'Resend API key is required' }, { status: 400 });
      }
      if (!from_email) {
        return NextResponse.json({ error: 'From email is required for Resend' }, { status: 400 });
      }
      if (!domain) {
        return NextResponse.json({ error: 'Domain is required for Resend' }, { status: 400 });
      }
    }

    if (provider === 'gmail') {
      if (!gmail_connection_id) {
        return NextResponse.json({ error: 'Gmail connection is required' }, { status: 400 });
      }

      const gmailConnection = await getScopedGmailConnection(supabase, project.id, gmail_connection_id);
      if (!gmailConnection) {
        return NextResponse.json({ error: 'Gmail connection not found for this project or is inactive.' }, { status: 400 });
      }
      gmailEmail = gmailConnection.email;
    }

    // For Resend: register domain with Resend API
    let domainVerified = false;
    let resendDomainId: string | null = null;
    if (provider === 'resend' && resend_api_key && domain) {
      const domainResult = await addResendDomain(resend_api_key, domain);
      if ('error' in domainResult) {
        const existingDomain = await findResendDomainByName(resend_api_key, domain);
        if (existingDomain) {
          resendDomainId = existingDomain.id;
          domainVerified = existingDomain.verified;
        } else {
          console.warn('Resend domain registration:', domainResult.error);
        }
      } else {
        resendDomainId = domainResult.id;
        domainVerified = false;
      }
    }

    // If setting as default, clear other defaults first
    if (is_default) {
      if (provider === 'resend' && !domainVerified) {
        return NextResponse.json({ error: 'Verify the Resend domain before setting it as the default provider.' }, { status: 400 });
      }
      await supabase
        .from('email_send_configs')
        .update({ is_default: false })
        .eq('project_id', project.id)
        .eq('is_default', true);
    }

    const insertData = {
      project_id: project.id,
      provider,
      gmail_connection_id: provider === 'gmail' ? (gmail_connection_id ?? null) : null,
      resend_api_key_encrypted: resend_api_key ? encrypt(resend_api_key) : null,
      from_email: provider === 'gmail' ? gmailEmail : (from_email ?? null),
      from_name: from_name ?? null,
      domain: domain ?? null,
      resend_domain_id: resendDomainId,
      domain_verified: domainVerified,
      is_default: provider === 'resend' ? (domainVerified && is_default ? true : false) : (is_default ?? false),
    };

    const { data: config, error } = await supabase
      .from('email_send_configs')
      .insert(insertData)
      .select('id, provider, from_email, from_name, domain, resend_domain_id, domain_verified, is_default, created_at')
      .single();

    if (error) {
      console.error('Error creating email_send_config:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A config with this provider and from_email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error('Error in POST email-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[slug]/settings/email-providers
 * Update an existing email send config. Expects { id, ...fields }.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await requireAdminOrOwner(supabase, user.id, slug);
    if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const configId = body.id;
    if (!configId || typeof configId !== 'string') {
      return NextResponse.json({ error: 'Config id is required' }, { status: 400 });
    }

    const validation = updateConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { data: existingConfig } = await supabase
      .from('email_send_configs')
      .select('id, provider, domain_verified')
      .eq('id', configId)
      .eq('project_id', project.id)
      .single();

    if (!existingConfig) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (validation.data.from_email !== undefined) updateData.from_email = validation.data.from_email;
    if (validation.data.from_name !== undefined) updateData.from_name = validation.data.from_name;
    if (validation.data.resend_api_key) {
      updateData.resend_api_key_encrypted = encrypt(validation.data.resend_api_key);
    }

    // If setting as default, clear other defaults first
    if (validation.data.is_default === true) {
      if (existingConfig.provider === 'resend' && !existingConfig.domain_verified) {
        return NextResponse.json({ error: 'Verify the Resend domain before setting it as the default provider.' }, { status: 400 });
      }
      await supabase
        .from('email_send_configs')
        .update({ is_default: false })
        .eq('project_id', project.id)
        .eq('is_default', true);
      updateData.is_default = true;
    } else if (validation.data.is_default === false) {
      updateData.is_default = false;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: config, error } = await supabase
      .from('email_send_configs')
      .update(updateData)
      .eq('id', configId)
      .eq('project_id', project.id)
      .select('id, provider, from_email, from_name, domain, resend_domain_id, domain_verified, is_default, updated_at')
      .single();

    if (error) {
      console.error('Error updating email_send_config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error in PATCH email-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[slug]/settings/email-providers
 * Delete an email send config. Expects { id }.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await requireAdminOrOwner(supabase, user.id, slug);
    if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const configId = body.id;
    if (!configId || typeof configId !== 'string') {
      return NextResponse.json({ error: 'Config id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('email_send_configs')
      .delete()
      .eq('id', configId)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting email_send_config:', error);
      return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE email-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
