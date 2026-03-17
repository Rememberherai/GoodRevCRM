import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Built-in workflow templates that are always available
const BUILTIN_TEMPLATES = [
  {
    id: 'template-lead-qualification',
    name: 'Lead Qualification',
    description: 'Automatically qualify new leads based on criteria and route to the right team member',
    trigger_type: 'entity.created',
    tags: ['lead', 'qualification', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'New Lead Created', config: {} } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 120 }, data: { label: 'Has Email?', config: { field: 'email', operator: 'is_not_empty', value: '' } } },
        { id: 'ai-1', type: 'ai_agent', position: { x: 100, y: 260 }, data: { label: 'Score Lead', config: { model: 'google/gemini-2.5-flash', prompt: 'Analyze this lead and provide a qualification score from 1-10 based on their title, company, and industry.' } } },
        { id: 'cond-2', type: 'condition', position: { x: 100, y: 400 }, data: { label: 'Score > 7?', config: { field: 'ai_result.score', operator: 'greater_than', value: 7 } } },
        { id: 'action-1', type: 'action', position: { x: -50, y: 540 }, data: { label: 'Create Task for Sales', config: { action_type: 'create_task', config: { title: 'Follow up with qualified lead' } } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 540 }, data: { label: 'Add to Nurture', config: { action_type: 'update_field', config: { field: 'status', value: 'nurture' } } } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 680 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 260 }, data: { label: 'Skip (No Email)', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'ai-1', sourceHandle: 'true', label: 'Yes' },
        { id: 'e3', source: 'cond-1', target: 'end-2', sourceHandle: 'false', label: 'No' },
        { id: 'e4', source: 'ai-1', target: 'cond-2' },
        { id: 'e5', source: 'cond-2', target: 'action-1', sourceHandle: 'true', label: 'Qualified' },
        { id: 'e6', source: 'cond-2', target: 'action-2', sourceHandle: 'false', label: 'Not Yet' },
        { id: 'e7', source: 'action-1', target: 'end-1' },
        { id: 'e8', source: 'action-2', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-deal-stage-notify',
    name: 'Deal Stage Change Notification',
    description: 'Send notifications and update records when opportunities move between stages',
    trigger_type: 'opportunity.stage_changed',
    tags: ['deals', 'notifications', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Stage Changed', config: {} } },
        { id: 'switch-1', type: 'switch', position: { x: 250, y: 120 }, data: { label: 'Which Stage?', config: { field: 'to_stage', cases: [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }, { value: 'negotiation', label: 'Negotiation' }], default_label: 'Other' } } },
        { id: 'action-won', type: 'action', position: { x: -50, y: 280 }, data: { label: 'Send Won Email', config: { action_type: 'send_email', config: { template: 'deal_won' } } } },
        { id: 'action-lost', type: 'action', position: { x: 150, y: 280 }, data: { label: 'Log Lost Reason', config: { action_type: 'create_task', config: { title: 'Review lost deal' } } } },
        { id: 'action-nego', type: 'action', position: { x: 350, y: 280 }, data: { label: 'Alert Manager', config: { action_type: 'send_notification', config: { message: 'Deal entered negotiation' } } } },
        { id: 'end-1', type: 'end', position: { x: 150, y: 420 }, data: { label: 'Done', config: {} } },
        { id: 'end-2', type: 'end', position: { x: 550, y: 280 }, data: { label: 'No Action', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'switch-1' },
        { id: 'e2', source: 'switch-1', target: 'action-won', sourceHandle: 'Won', label: 'Won' },
        { id: 'e3', source: 'switch-1', target: 'action-lost', sourceHandle: 'Lost', label: 'Lost' },
        { id: 'e4', source: 'switch-1', target: 'action-nego', sourceHandle: 'Negotiation', label: 'Negotiation' },
        { id: 'e5', source: 'switch-1', target: 'end-2', sourceHandle: 'Other', label: 'Other' },
        { id: 'e6', source: 'action-won', target: 'end-1' },
        { id: 'e7', source: 'action-lost', target: 'end-1' },
        { id: 'e8', source: 'action-nego', target: 'end-1' },
      ],
    },
  },
  {
    id: 'template-onboarding-sequence',
    name: 'Customer Onboarding',
    description: 'Multi-step onboarding sequence with delays and conditional follow-ups',
    trigger_type: 'manual',
    tags: ['onboarding', 'sequence', 'built-in'],
    is_builtin: true,
    definition: {
      schema_version: '1.0.0',
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start Onboarding', config: {} } },
        { id: 'action-1', type: 'action', position: { x: 250, y: 120 }, data: { label: 'Send Welcome Email', config: { action_type: 'send_email', config: { template: 'welcome' } } } },
        { id: 'delay-1', type: 'delay', position: { x: 250, y: 240 }, data: { label: 'Wait 2 Days', config: { delay_type: 'duration', duration_ms: 172800000 } } },
        { id: 'action-2', type: 'action', position: { x: 250, y: 360 }, data: { label: 'Send Setup Guide', config: { action_type: 'send_email', config: { template: 'setup_guide' } } } },
        { id: 'delay-2', type: 'delay', position: { x: 250, y: 480 }, data: { label: 'Wait 5 Days', config: { delay_type: 'duration', duration_ms: 432000000 } } },
        { id: 'cond-1', type: 'condition', position: { x: 250, y: 600 }, data: { label: 'Completed Setup?', config: { field: 'setup_complete', operator: 'equals', value: true } } },
        { id: 'action-3', type: 'action', position: { x: 100, y: 740 }, data: { label: 'Schedule Check-in', config: { action_type: 'create_task', config: { title: 'Customer check-in call' } } } },
        { id: 'action-4', type: 'action', position: { x: 400, y: 740 }, data: { label: 'Send Reminder', config: { action_type: 'send_email', config: { template: 'setup_reminder' } } } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 880 }, data: { label: 'Complete', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'action-2' },
        { id: 'e4', source: 'action-2', target: 'delay-2' },
        { id: 'e5', source: 'delay-2', target: 'cond-1' },
        { id: 'e6', source: 'cond-1', target: 'action-3', sourceHandle: 'true', label: 'Yes' },
        { id: 'e7', source: 'cond-1', target: 'action-4', sourceHandle: 'false', label: 'No' },
        { id: 'e8', source: 'action-3', target: 'end-1' },
        { id: 'e9', source: 'action-4', target: 'end-1' },
      ],
    },
  },
];

// GET /api/projects/[slug]/workflows/templates - List template workflows
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Fetch user-created templates
    const { data: userTemplates } = await supabaseAny
      .from('workflows')
      .select('id, name, description, trigger_type, tags, definition, created_at')
      .eq('project_id', project.id)
      .eq('is_template', true)
      .order('name', { ascending: true });

    // Combine built-in + user templates
    const templates = [...BUILTIN_TEMPLATES, ...(userTemplates ?? [])];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error in GET /workflows/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
