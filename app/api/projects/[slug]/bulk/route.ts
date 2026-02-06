import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  bulkOperationSchema,
  bulkPersonUpdateSchema,
  bulkOrganizationUpdateSchema,
  bulkOpportunityUpdateSchema,
  bulkTaskUpdateSchema,
} from '@/lib/validators/bulk';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/bulk - Execute bulk operation
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
    const validationResult = bulkOperationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_ids, operation, data } = validationResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let affectedCount = 0;

    switch (entity_type) {
      case 'person':
        affectedCount = await handlePersonBulkOperation(
          supabaseAny,
          project.id,
          entity_ids,
          operation,
          data
        );
        break;

      case 'organization':
        affectedCount = await handleOrganizationBulkOperation(
          supabaseAny,
          project.id,
          entity_ids,
          operation,
          data
        );
        break;

      case 'opportunity':
        affectedCount = await handleOpportunityBulkOperation(
          supabaseAny,
          project.id,
          entity_ids,
          operation,
          data
        );
        break;

      case 'task':
        affectedCount = await handleTaskBulkOperation(
          supabaseAny,
          project.id,
          entity_ids,
          operation,
          data
        );
        break;

      case 'rfp':
        affectedCount = await handleRfpBulkOperation(
          supabaseAny,
          project.id,
          entity_ids,
          operation
        );
        break;
    }

    return NextResponse.json({
      success: true,
      affected_count: affectedCount,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/bulk:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePersonBulkOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  entityIds: string[],
  operation: string,
  data?: Record<string, unknown>
): Promise<number> {
  switch (operation) {
    case 'update': {
      const updateData = bulkPersonUpdateSchema.safeParse(data);
      if (!updateData.success) {
        throw new Error('Invalid update data for people');
      }
      const { data: count } = await supabase.rpc('bulk_update_people', {
        p_project_id: projectId,
        p_person_ids: entityIds,
        p_updates: updateData.data,
      });
      return count ?? 0;
    }

    case 'delete': {
      const { data: count } = await supabase.rpc('bulk_delete_people', {
        p_project_id: projectId,
        p_person_ids: entityIds,
      });
      return count ?? 0;
    }

    case 'restore': {
      const { data: count } = await supabase.rpc('bulk_restore_people', {
        p_project_id: projectId,
        p_person_ids: entityIds,
      });
      return count ?? 0;
    }

    default:
      throw new Error(`Unsupported operation for people: ${operation}`);
  }
}

async function handleOrganizationBulkOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  entityIds: string[],
  operation: string,
  data?: Record<string, unknown>
): Promise<number> {
  switch (operation) {
    case 'update': {
      const updateData = bulkOrganizationUpdateSchema.safeParse(data);
      if (!updateData.success) {
        throw new Error('Invalid update data for organizations');
      }
      const { data: count } = await supabase.rpc('bulk_update_organizations', {
        p_project_id: projectId,
        p_organization_ids: entityIds,
        p_updates: updateData.data,
      });
      return count ?? 0;
    }

    case 'delete': {
      const { data: count } = await supabase.rpc('bulk_delete_organizations', {
        p_project_id: projectId,
        p_organization_ids: entityIds,
      });
      return count ?? 0;
    }

    default:
      throw new Error(`Unsupported operation for organizations: ${operation}`);
  }
}

async function handleOpportunityBulkOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  entityIds: string[],
  operation: string,
  data?: Record<string, unknown>
): Promise<number> {
  switch (operation) {
    case 'update': {
      const updateData = bulkOpportunityUpdateSchema.safeParse(data);
      if (!updateData.success) {
        throw new Error('Invalid update data for opportunities');
      }
      const { data: count } = await supabase.rpc('bulk_update_opportunities', {
        p_project_id: projectId,
        p_opportunity_ids: entityIds,
        p_updates: updateData.data,
      });
      return count ?? 0;
    }

    case 'delete': {
      const { data: count } = await supabase.rpc('bulk_delete_opportunities', {
        p_project_id: projectId,
        p_opportunity_ids: entityIds,
      });
      return count ?? 0;
    }

    default:
      throw new Error(`Unsupported operation for opportunities: ${operation}`);
  }
}

async function handleTaskBulkOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  entityIds: string[],
  operation: string,
  data?: Record<string, unknown>
): Promise<number> {
  switch (operation) {
    case 'update': {
      const updateData = bulkTaskUpdateSchema.safeParse(data);
      if (!updateData.success) {
        throw new Error('Invalid update data for tasks');
      }
      const { data: count } = await supabase.rpc('bulk_update_tasks', {
        p_project_id: projectId,
        p_task_ids: entityIds,
        p_updates: updateData.data,
      });
      return count ?? 0;
    }

    case 'delete': {
      const { data: count } = await supabase.rpc('bulk_delete_tasks', {
        p_project_id: projectId,
        p_task_ids: entityIds,
      });
      return count ?? 0;
    }

    case 'complete': {
      const { data: count } = await supabase.rpc('bulk_complete_tasks', {
        p_project_id: projectId,
        p_task_ids: entityIds,
      });
      return count ?? 0;
    }

    default:
      throw new Error(`Unsupported operation for tasks: ${operation}`);
  }
}

async function handleRfpBulkOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  entityIds: string[],
  operation: string
): Promise<number> {
  switch (operation) {
    case 'delete': {
      const { data: count } = await supabase.rpc('bulk_delete_rfps', {
        p_project_id: projectId,
        p_rfp_ids: entityIds,
      });
      return count ?? 0;
    }

    default:
      throw new Error(`Unsupported operation for RFPs: ${operation}`);
  }
}
