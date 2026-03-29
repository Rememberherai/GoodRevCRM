/**
 * GET /api/projects/[slug]/workflows/tools
 *
 * Returns the list of available internal CRM tools for use with the
 * CRM Action (mcp_tool) workflow node, grouped by module.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Human-friendly group names for tool namespaces
const GROUP_LABELS: Record<string, string> = {
  organizations: 'Organizations',
  people: 'People',
  opportunities: 'Opportunities',
  tasks: 'Tasks',
  notes: 'Notes',
  activities: 'Activities',
  tags: 'Tags',
  emails: 'Emails',
  sequences: 'Sequences',
  search: 'Search',
  workflows: 'Workflows',
  reports: 'Reports',
  contracts: 'Contracts',
  calendar: 'Calendar',
  products: 'Products',
  quotes: 'Quotes',
  documents: 'Documents',
  comments: 'Comments',
  accounting: 'Accounting',
  members: 'Members',
  content: 'Content Library',
  tags_manager: 'Tags Manager',
  community: 'Community',
};

/**
 * Reverse toApiName(): convert underscored API name back to dotted tool name.
 * toApiName() replaces "." with "_", so "bug_reports.update_status" → "bug_reports_update_status".
 * We recover the dot by matching against known namespace prefixes (which may themselves contain
 * underscores), then inserting the dot at the namespace boundary.
 * Falls back to replacing the last underscore if no known prefix matches.
 */
function apiNameToDotted(apiName: string): string {
  // Try known prefixes first (longest match wins, to handle "tags_manager" before "tags")
  const prefixes = Object.keys(GROUP_LABELS).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (apiName.startsWith(prefix + '_')) {
      return prefix + '.' + apiName.slice(prefix.length + 1);
    }
  }
  // Fallback: replace last underscore with a dot
  return apiName.replace(/_([^_]+)$/, '.$1');
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // Import server-side tool registry
    const { getWorkflowToolDefinitions } = await import('@/lib/chat/tool-registry');
    const defs = getWorkflowToolDefinitions();

    // Group tools by their namespace prefix (e.g., "organizations.list" → "organizations")
    const groupedMap: Record<string, { name: string; description: string; parameters: Record<string, unknown> }[]> = {};

    for (const def of defs) {
      const toolName = def.function.name; // underscored API name, e.g. "organizations_list"
      // Convert back to dotted name for display.
      // toApiName() replaces the FIRST dot with underscore, so we need to reverse
      // only the first underscore-to-dot conversion. Tool names are "namespace.action"
      // where the namespace may itself contain underscores (e.g. "bug_reports.update_status"
      // becomes "bug_reports_update_status"). We restore by finding the boundary between
      // namespace and action using the known namespace prefixes.
      const dottedName = apiNameToDotted(toolName);
      const prefix = dottedName.split('.')[0] ?? toolName;

      if (!groupedMap[prefix]) groupedMap[prefix] = [];
      groupedMap[prefix].push({
        name: dottedName,
        description: def.function.description,
        parameters: def.function.parameters as Record<string, unknown>,
      });
    }

    const groups = Object.entries(groupedMap).map(([key, toolList]) => ({
      key,
      label: GROUP_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
      tools: toolList,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('GET /workflows/tools error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
