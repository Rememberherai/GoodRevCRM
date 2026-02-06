import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { addDiscoveredContactsSchema } from '@/lib/validators/contact-discovery';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/organizations/[id]/add-contacts - Add discovered contacts as people
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: organizationId } = await context.params;
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

    // Verify organization exists
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = addDiscoveredContactsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { contacts } = validationResult.data;

    // Create people records
    const createdPeople: { id: string; first_name: string; last_name: string }[] = [];
    const errors: { contact: (typeof contacts)[0]; error: string }[] = [];

    for (const contact of contacts) {
      try {
        // Create person
        const { data: person, error: personError } = await supabase
          .from('people')
          .insert({
            project_id: project.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email || null,
            job_title: contact.job_title || null,
            linkedin_url: contact.linkedin_url || null,
            created_by: user.id,
          })
          .select('id, first_name, last_name')
          .single();

        if (personError || !person) {
          console.error('Error creating person:', personError);
          errors.push({
            contact,
            error: 'Failed to create contact',
          });
          continue;
        }

        // Create person-organization link
        const { error: linkError } = await supabase.from('person_organizations').insert({
          person_id: person.id,
          organization_id: organizationId,
          project_id: project.id,
          job_title: contact.job_title || null,
          is_primary: true,
          is_current: true,
        });

        if (linkError) {
          console.error('Error linking person to organization:', linkError);
          errors.push({
            contact,
            error: 'Contact created but failed to link to organization',
          });
        }

        createdPeople.push(person);
      } catch (err) {
        console.error('Error processing contact:', err);
        errors.push({
          contact,
          error: 'Failed to process contact',
        });
      }
    }

    return NextResponse.json({
      created: createdPeople,
      created_count: createdPeople.length,
      errors: errors.length > 0 ? errors : undefined,
      organization: {
        id: organization.id,
        name: organization.name,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/organizations/[id]/add-contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
