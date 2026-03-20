import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createProjectSchema } from '@/lib/validators/project';
import { cloneFrameworkToProject, getFrameworkTemplate } from '@/lib/community/frameworks';
import type { Database } from '@/types/database';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

// GET /api/projects - List all projects for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error in GET /api/projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, slug, description, settings, project_type, accounting_target, framework_type } = validationResult.data;

    // Use service client to bypass RLS for project creation
    const serviceClient = createServiceClient();

    const insertData: ProjectInsert = {
      name,
      slug,
      description: description ?? null,
      settings: settings ?? {},
      owner_id: user.id,
    };

    if (project_type) {
      insertData.project_type = project_type;
    }
    if (accounting_target) {
      insertData.accounting_target = accounting_target;
    }

    const { data: project, error } = await serviceClient
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A project with this slug already exists' },
          { status: 409 }
        );
      }
      console.error('Project creation error details:', { message: error.message, code: error.code });
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // For community projects, framework setup must succeed or the project is rolled back.
    if (project_type === 'community' && framework_type && framework_type !== 'custom') {
      try {
        const template = getFrameworkTemplate(framework_type);
        const { framework, dimensions } = cloneFrameworkToProject(template, project.id);

        const { data: insertedFramework, error: fwError } = await serviceClient
          .from('impact_frameworks')
          .insert(framework)
          .select('id')
          .single();

        if (fwError || !insertedFramework) {
          throw fwError ?? new Error('Failed to create community framework');
        }

        const { error: dimensionsError } = await serviceClient
          .from('impact_dimensions')
          .insert(dimensions);

        if (dimensionsError) {
          throw dimensionsError;
        }

        const { error: updateProjectError } = await serviceClient
          .from('projects')
          .update({ impact_framework_id: insertedFramework.id })
          .eq('id', project.id);

        if (updateProjectError) {
          throw updateProjectError;
        }

        project.impact_framework_id = insertedFramework.id;
      } catch (fwError) {
        console.error('Error setting up community project framework:', fwError);
        await serviceClient
          .from('projects')
          .delete()
          .eq('id', project.id);

        return NextResponse.json(
          { error: 'Failed to finish community project setup. The project was not created.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
