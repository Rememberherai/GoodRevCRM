import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/projects/[slug]/email/unknown-senders/create-contact
 * Create a contact from an unknown email sender and backfill their emails.
 *
 * Body:
 *   from_email      - required, the sender's email address
 *   organization_id - required, the org to link the contact to
 *   first_name      - optional, auto-parsed from email headers if not provided
 *   last_name       - optional, auto-parsed from email headers if not provided
 *   job_title       - optional
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { from_email, organization_id, job_title } = body;
    let { first_name, last_name } = body;

    if (!from_email || !organization_id) {
      return NextResponse.json(
        { error: 'from_email and organization_id are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = from_email.toLowerCase().trim();

    // Check if a person with this email already exists in this project
    const { data: existingPerson } = await supabase
      .from('people')
      .select('id')
      .ilike('email', normalizedEmail)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (existingPerson) {
      return NextResponse.json(
        { error: 'A contact with this email already exists', person_id: existingPerson.id },
        { status: 409 }
      );
    }

    // If names not provided, try to parse from the most recent email's from_name
    if (!first_name && !last_name) {
      const { data: recentEmail } = await supabase
        .from('emails')
        .select('from_name')
        .ilike('from_email', normalizedEmail)
        .eq('organization_id', organization_id)
        .eq('project_id', project.id)
        .not('from_name', 'is', null)
        .order('email_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentEmail?.from_name) {
        const parts = recentEmail.from_name.trim().split(/\s+/);
        first_name = parts[0] ?? '';
        last_name = parts.slice(1).join(' ') || '';
      }
    }

    if (!first_name) {
      // Fallback: use the email local part as first name
      first_name = normalizedEmail.split('@')[0] ?? 'Unknown';
      last_name = last_name || '';
    }

    // Create the person
    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({
        first_name,
        last_name: last_name || '',
        email: normalizedEmail,
        job_title: job_title || null,
        project_id: project.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (personError || !person) {
      console.error('[create-contact] Failed to create person:', personError?.message);
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
    }

    // Link to organization
    await supabase
      .from('person_organizations')
      .insert({
        person_id: person.id,
        organization_id,
        project_id: project.id,
        is_primary: true,
        is_current: true,
      });

    // Backfill: update all matching emails to set person_id
    // Use service client to bypass RLS for bulk update
    const serviceClient = createServiceClient();
    const { count: updatedCount } = await serviceClient
      .from('emails')
      .update({ person_id: person.id }, { count: 'exact' })
      .ilike('from_email', normalizedEmail)
      .eq('organization_id', organization_id)
      .eq('project_id', project.id)
      .is('person_id', null);

    // Log a summary activity
    await serviceClient
      .from('activity_log')
      .insert({
        project_id: project.id,
        user_id: user.id,
        entity_type: 'person',
        entity_id: person.id,
        action: 'created',
        activity_type: 'system',
        person_id: person.id,
        organization_id,
        notes: `Contact created from unknown email sender. ${updatedCount ?? 0} historical emails linked.`,
        metadata: {
          from_email: normalizedEmail,
          emails_linked: updatedCount ?? 0,
          source: 'unknown_sender_review',
        },
      });

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'person',
      entityId: person.id,
      data: {
        ...person,
        source: 'unknown_sender_review',
        emails_linked: updatedCount ?? 0,
      },
    });

    return NextResponse.json({
      person,
      emails_linked: updatedCount ?? 0,
    });
  } catch (error) {
    console.error('[create-contact] Internal error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
