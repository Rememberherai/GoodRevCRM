import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { timingSafeEqual } from 'crypto';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/projects/[slug]/webhooks/incoming/zapier
 *
 * Incoming webhook endpoint for Zapier actions to push data into the CRM.
 * Authenticated via Bearer token matching an api_connections record of type 'zapier'.
 *
 * Body: { action: string, payload: object }
 *
 * Supported actions:
 *   - create_contact: Create a person (requires first_name + last_name)
 *   - update_contact: Update a person (requires id)
 *   - create_organization: Create an org (requires name)
 *   - create_deal: Create an opportunity (requires name + stage)
 *   - create_activity: Log an activity (requires entity_type + entity_id)
 *   - add_tag: Add a tag to an entity (requires entity_type + entity_id + tag_name)
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;

    // Authenticate via Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const bearerToken = authHeader.slice(7);

    // Use admin client — this is an external webhook with no user session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Find a matching Zapier connection by decrypting and comparing API keys
    const { data: connections } = await supabase
      .from('api_connections')
      .select('id, config_enc, status, created_by')
      .eq('project_id', project.id)
      .eq('service_type', 'zapier')
      .eq('status', 'active');

    let matchedConnectionId: string | null = null;
    let connectionCreatedBy: string | null = null;
    for (const conn of connections ?? []) {
      try {
        const config = JSON.parse(decrypt(conn.config_enc));
        if (config.api_key && safeEqual(config.api_key, bearerToken)) {
          matchedConnectionId = conn.id;
          connectionCreatedBy = conn.created_by;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedConnectionId) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Update last_used_at
    await supabase
      .from('api_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', matchedConnectionId);

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

    if (!action || !payload) {
      return NextResponse.json({ error: 'Missing required fields: action, payload' }, { status: 400 });
    }

    switch (action) {
      case 'create_contact': {
        if (!payload.first_name || !payload.last_name) {
          return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
        }

        const personFields = filterSafeFields(payload, PERSON_FIELDS);
        const organizationId = payload.organization_id ? String(payload.organization_id) : null;

        const insertData: Record<string, unknown> = {
          project_id: project.id,
          ...personFields,
        };

        const { data: person, error } = await supabase
          .from('people').insert(insertData).select().single();
        if (error) return NextResponse.json({ error: `Failed to create contact: ${error.message}` }, { status: 500 });

        // Link to organization via person_organizations if provided
        if (organizationId) {
          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('id', organizationId)
            .eq('project_id', project.id)
            .is('deleted_at', null)
            .single();

          if (org) {
            await supabase
              .from('person_organizations')
              .insert({
                person_id: person.id,
                organization_id: organizationId,
                project_id: project.id,
                is_primary: true,
              });
          }
        }

        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.created',
          entityType: 'person',
          entityId: person.id,
          data: person as Record<string, unknown>,
        }).catch(console.error);

        return NextResponse.json({ success: true, result: { id: person.id, type: 'person' } }, { status: 201 });
      }

      case 'update_contact': {
        if (!payload.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const safeFields = filterSafeFields(payload, PERSON_FIELDS);
        if (Object.keys(safeFields).length === 0) {
          return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data: person, error } = await supabase
          .from('people')
          .update(safeFields)
          .eq('id', payload.id)
          .eq('project_id', project.id)
          .is('deleted_at', null)
          .select()
          .single();
        if (error) return NextResponse.json({ error: `Failed to update contact: ${error.message}` }, { status: 500 });

        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.updated',
          entityType: 'person',
          entityId: person.id,
          data: person as Record<string, unknown>,
        }).catch(console.error);

        return NextResponse.json({ success: true, result: { id: person.id, type: 'person' } });
      }

      case 'create_organization': {
        if (!payload.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

        const insertData: Record<string, unknown> = {
          project_id: project.id,
          ...filterSafeFields(payload, ORG_FIELDS),
        };

        const { data: org, error } = await supabase
          .from('organizations').insert(insertData).select().single();
        if (error) return NextResponse.json({ error: `Failed to create organization: ${error.message}` }, { status: 500 });

        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.created',
          entityType: 'organization',
          entityId: org.id,
          data: org as Record<string, unknown>,
        }).catch(console.error);

        return NextResponse.json({ success: true, result: { id: org.id, type: 'organization' } }, { status: 201 });
      }

      case 'create_deal': {
        if (!payload.name || !payload.stage) return NextResponse.json({ error: 'name and stage are required' }, { status: 400 });

        // Validate FKs belong to this project
        if (payload.organization_id) {
          const { data: org } = await supabase
            .from('organizations').select('id')
            .eq('id', payload.organization_id).eq('project_id', project.id)
            .is('deleted_at', null).single();
          if (!org) return NextResponse.json({ error: 'Organization not found in this project' }, { status: 400 });
        }
        if (payload.primary_contact_id) {
          const { data: contact } = await supabase
            .from('people').select('id')
            .eq('id', payload.primary_contact_id).eq('project_id', project.id)
            .is('deleted_at', null).single();
          if (!contact) return NextResponse.json({ error: 'Primary contact not found in this project' }, { status: 400 });
        }
        if (payload.owner_id) {
          const { data: member } = await supabase
            .from('project_memberships').select('user_id')
            .eq('user_id', payload.owner_id).eq('project_id', project.id)
            .single();
          if (!member) return NextResponse.json({ error: 'Owner is not a member of this project' }, { status: 400 });
        }

        const dealFields = filterSafeFields(payload, DEAL_FIELDS);
        const insertData: Record<string, unknown> = {
          project_id: project.id,
          currency: 'USD',
          ...dealFields,
        };

        const { data: opp, error } = await supabase
          .from('opportunities').insert(insertData).select().single();
        if (error) return NextResponse.json({ error: `Failed to create deal: ${error.message}` }, { status: 500 });

        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'entity.created',
          entityType: 'opportunity',
          entityId: opp.id,
          data: opp as Record<string, unknown>,
        }).catch(console.error);

        return NextResponse.json({ success: true, result: { id: opp.id, type: 'opportunity' } }, { status: 201 });
      }

      case 'create_activity': {
        if (!payload.entity_type || !payload.entity_id) {
          return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
        }

        const activityFields = filterSafeFields(payload, ACTIVITY_FIELDS);
        const insertData: Record<string, unknown> = {
          project_id: project.id,
          user_id: connectionCreatedBy,
          action: 'created',
          activity_type: 'note',
          ...activityFields,
        };

        const { data: activity, error } = await supabase
          .from('activity_log').insert(insertData).select().single();
        if (error) return NextResponse.json({ error: `Failed to create activity: ${error.message}` }, { status: 500 });

        return NextResponse.json({ success: true, result: { id: activity.id, type: 'activity' } }, { status: 201 });
      }

      case 'add_tag': {
        if (!payload.entity_type || !payload.entity_id || !payload.tag_name) {
          return NextResponse.json({ error: 'entity_type, entity_id, and tag_name are required' }, { status: 400 });
        }

        const entityType = String(payload.entity_type);
        const entityId = String(payload.entity_id);
        const tagName = String(payload.tag_name);

        // Validate entity_type and verify entity belongs to this project
        const TAGGABLE_ENTITIES: Record<string, string> = {
          person: 'people',
          organization: 'organizations',
          opportunity: 'opportunities',
        };
        const tableName = TAGGABLE_ENTITIES[entityType];
        if (!tableName) {
          return NextResponse.json({ error: `Invalid entity_type: ${entityType}. Must be person, organization, or opportunity` }, { status: 400 });
        }
        const { data: entity } = await supabase
          .from(tableName).select('id')
          .eq('id', entityId).eq('project_id', project.id)
          .is('deleted_at', null).single();
        if (!entity) {
          return NextResponse.json({ error: `${entityType} not found in this project` }, { status: 404 });
        }

        // Find or create the tag in entity_tags (upsert to handle concurrent requests)
        const { data: tag, error: tagError } = await supabase
          .from('entity_tags')
          .upsert(
            { project_id: project.id, name: tagName },
            { onConflict: 'project_id,name', ignoreDuplicates: true }
          )
          .select('id')
          .single();

        // If upsert with ignoreDuplicates doesn't return the row, fetch it
        let tagId: string;
        if (tag) {
          tagId = tag.id;
        } else {
          const { data: existingTag } = await supabase
            .from('entity_tags')
            .select('id')
            .eq('project_id', project.id)
            .eq('name', tagName)
            .single();
          if (!existingTag) return NextResponse.json({ error: `Failed to create tag: ${tagError?.message ?? 'unknown error'}` }, { status: 500 });
          tagId = existingTag.id;
        }

        // Create assignment in entity_tag_assignments
        const { error: linkError } = await supabase
          .from('entity_tag_assignments')
          .upsert(
            { tag_id: tagId, entity_type: entityType, entity_id: entityId },
            { onConflict: 'tag_id,entity_type,entity_id' }
          );

        if (linkError) return NextResponse.json({ error: `Failed to add tag: ${linkError.message}` }, { status: 500 });

        return NextResponse.json({ success: true, result: { tag_id: tagId, entity_type: entityType, entity_id: entityId } });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          supported_actions: ['create_contact', 'update_contact', 'create_organization', 'create_deal', 'create_activity', 'add_tag'],
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in POST /webhooks/incoming/zapier:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PERSON_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'linkedin_url',
  'twitter_handle', 'job_title', 'department', 'notes', 'timezone',
  'preferred_contact_method',
]);

const ORG_FIELDS = new Set([
  'name', 'domain', 'website', 'industry', 'employee_count', 'annual_revenue',
  'description', 'logo_url', 'linkedin_url', 'phone',
]);

const DEAL_FIELDS = new Set([
  'name', 'stage', 'description', 'amount', 'probability', 'currency',
  'expected_close_date', 'organization_id', 'primary_contact_id', 'owner_id',
  'source', 'campaign',
]);

const ACTIVITY_FIELDS = new Set([
  'entity_type', 'entity_id', 'activity_type', 'subject', 'notes',
  'outcome', 'direction', 'duration_minutes', 'person_id',
  'organization_id', 'opportunity_id',
]);

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function filterSafeFields(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (allowed.has(key) && value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

