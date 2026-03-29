'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown, Copy, Loader2, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useWorkflowStore } from '@/stores/workflow-store';
import {
  actionTypeOptions,
  conditionOperatorLabels,
  opportunityStages,
  rfpStatuses,
  triggerTypeGroups,
} from '@/types/automation';
import { ACTIVITY_TYPE_LABELS } from '@/types/activity';
import type { ActivityType } from '@/types/activity';
import type { WorkflowNodeType, WorkflowTriggerType } from '@/types/workflow';

// ── Resource types (matching automation-form.tsx) ────────────────────────────

interface ProjectMember {
  user_id: string;
  role: string;
  user: { id: string; full_name: string | null; email: string };
}

interface ProjectTag {
  id: string;
  name: string;
  color: string;
}

interface ProjectSequence {
  id: string;
  name: string;
  status: string;
}

interface ProjectTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
}

interface ZapierConnection {
  id: string;
  name: string;
  service_type: string;
  status: string;
}

// Known value options for update_field action
const fieldValueOptions: Record<string, { value: string; label: string }[]> = {
  stage: [
    { value: 'prospecting', label: 'Prospecting' },
    { value: 'qualification', label: 'Qualification' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'closed_won', label: 'Closed Won' },
    { value: 'closed_lost', label: 'Closed Lost' },
  ],
  status: [
    { value: 'identified', label: 'Identified' },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
    { value: 'no_bid', label: 'No Bid' },
  ],
  priority: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
};

// Entity fields available for the update_field action
const updateFieldOptions = [
  { value: 'stage', label: 'Stage (Opportunity)' },
  { value: 'status', label: 'Status (RFP)' },
  { value: 'priority', label: 'Priority (Task)' },
  { value: 'owner_id', label: 'Owner' },
  { value: 'name', label: 'Name' },
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'close_date', label: 'Close Date' },
];

const activityTypeOptionsForAction: { value: ActivityType; label: string }[] = (
  Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]
)
  .filter(([v]) => v !== 'system' && v !== 'sequence_completed')
  .map(([value, label]) => ({ value, label }));

// ── Community workflow constants ──────────────────────────────────────────────

// Trigger group keys visible in community projects
const COMMUNITY_TRIGGER_GROUP_KEYS = ['entity', 'time', 'community', 'events', 'assetAccess', 'email', 'sms', 'task', 'meeting'];
// Trigger group keys visible in standard/grants projects
const STANDARD_TRIGGER_GROUP_KEYS = ['entity', 'pipeline', 'email', 'sequence', 'meeting', 'task', 'time', 'call', 'sms', 'news', 'document', 'accounting', 'booking'];

// Shared triggers always shown regardless of project type
const SHARED_TRIGGER_TYPES: WorkflowTriggerType[] = ['workflow.completed', 'workflow.failed', 'workflow.step_failed'];

function getFilteredTriggerGroups(projectType: string) {
  const allowedKeys = projectType === 'community' ? COMMUNITY_TRIGGER_GROUP_KEYS : STANDARD_TRIGGER_GROUP_KEYS;
  return Object.entries(triggerTypeGroups)
    .filter(([key]) => allowedKeys.includes(key))
    .map(([, group]) => group);
}

// Action types available for community projects
const COMMUNITY_ACTION_TYPES = new Set([
  'create_task', 'send_notification', 'send_email', 'send_sms',
  'update_field', 'add_tag', 'remove_tag', 'fire_webhook',
  'run_workflow', 'run_ai_research', 'create_activity',
  'enroll_in_program', 'update_enrollment_status', 'record_attendance',
  'create_contribution', 'assign_job', 'update_job_status',
  'create_referral', 'update_referral_status', 'send_broadcast',
  'update_grant_status', 'flag_household_risk',
]);

// Action types available for standard projects
const STANDARD_ACTION_TYPES = new Set([
  'create_task', 'update_field', 'change_stage', 'change_status', 'assign_owner',
  'send_notification', 'send_email', 'send_sms', 'enroll_in_sequence',
  'add_tag', 'remove_tag', 'run_ai_research', 'create_activity', 'fire_webhook', 'run_workflow',
]);

// Context fields available per trigger prefix (for the Start node reference panel)
const TRIGGER_CONTEXT_FIELDS: Partial<Record<WorkflowTriggerType, string[]>> = {
  'household.created': ['household.id', 'household.name', 'household.address', 'household.city', 'household.state', 'household.zip', 'household.household_size', 'household.risk_score', 'household.primary_contact_id'],
  'household.member_added': ['household.id', 'household.name', 'member.id', 'member.person_id', 'member.relationship_type'],
  'program.enrollment.created': ['enrollment.id', 'enrollment.household_id', 'enrollment.person_id', 'enrollment.program_id', 'enrollment.status', 'enrollment.waiver_status', 'enrollment.enrolled_at'],
  'program.attendance.batch': ['program.id', 'program.name', 'attendance.date', 'attendance.present_count', 'attendance.absent_count'],
  'contribution.created': ['contribution.id', 'contribution.type', 'contribution.value', 'contribution.hours', 'contribution.dimension_id', 'contribution.household_id', 'contribution.date'],
  'grant.created': ['grant.id', 'grant.name', 'grant.status', 'grant.amount_requested', 'grant.deadline', 'grant.category', 'grant.tier'],
  'grant.status_changed': ['grant.id', 'grant.name', 'grant.status', 'grant.amount_requested', 'grant.amount_awarded'],
  'grant.deadline_approaching': ['grant.id', 'grant.name', 'grant.deadline', 'grant.amount_requested', 'grant.amount_awarded', 'grant.report_due_date'],
  'grant.report_due_soon': ['grant.id', 'grant.name', 'grant.report_due_date', 'grant.amount_awarded'],
  'grant.report_overdue': ['grant.id', 'grant.name', 'grant.report_due_date'],
  'grant.report_submitted': ['grant.id', 'grant.name', 'grant.report_submitted_at'],
  'grant.document_uploaded': ['grant.id', 'grant.name', 'document.name', 'document.type'],
  'grant.agreement_executed': ['grant.id', 'grant.name', 'grant.award_number', 'grant.amount_awarded'],
  'job.assigned': ['job.id', 'job.title', 'job.status', 'job.priority', 'job.contractor_id', 'job.service_address', 'job.assigned_by'],
  'job.accepted': ['job.id', 'job.title', 'job.contractor_id', 'job.service_address'],
  'job.declined': ['job.id', 'job.title', 'job.contractor_id'],
  'job.completed': ['job.id', 'job.title', 'job.contractor_id', 'job.completed_at', 'job.service_address'],
  'job.inaction_warning': ['job.id', 'job.title', 'job.status', 'job.assigned_at', 'job.contractor_id'],
  'contractor.onboarded': ['contractor.id', 'contractor.name', 'contractor.service_categories', 'contractor.certifications'],
  'referral.created': ['referral.id', 'referral.person_id', 'referral.household_id', 'referral.service_type', 'referral.status', 'referral.partner_organization_id'],
  'referral.completed': ['referral.id', 'referral.service_type', 'referral.outcome', 'referral.completed_at'],
  'referral.overdue': ['referral.id', 'referral.service_type', 'referral.status', 'referral.created_at', 'referral.household_id'],
  'broadcast.sent': ['broadcast.id', 'broadcast.subject', 'broadcast.channel', 'broadcast.recipient_count', 'broadcast.sent_at'],
  'risk_score.high': ['household.id', 'household.name', 'household.risk_score', 'household.primary_contact_id'],
  'event.created': ['event.id', 'event.title', 'event.start_at', 'event.end_at', 'event.location', 'event.capacity'],
  'event.published': ['event.id', 'event.title', 'event.start_at', 'event.registration_count'],
  'event.cancelled': ['event.id', 'event.title', 'event.start_at'],
  'event.registration.created': ['registration.id', 'registration.event_id', 'registration.person_id', 'registration.waiver_status'],
  'event.registration.confirmed': ['registration.id', 'registration.event_id', 'registration.person_id'],
  'event.registration.cancelled': ['registration.id', 'registration.event_id'],
  'event.registration.checked_in': ['registration.id', 'registration.event_id', 'registration.person_id', 'registration.checked_in_at'],
  'event.capacity_reached': ['event.id', 'event.title', 'event.capacity', 'event.registration_count'],
  'asset_access.submitted': ['access.id', 'access.asset_id', 'access.person_id', 'access.start_time', 'access.end_time', 'access.purpose'],
  'asset_access.confirmed': ['access.id', 'access.asset_id', 'access.person_id', 'access.start_time', 'access.end_time'],
  'asset_access.denied': ['access.id', 'access.asset_id', 'access.person_id', 'access.denial_reason'],
  'asset_access.returned': ['access.id', 'access.asset_id', 'access.person_id', 'access.returned_at'],
  webhook_inbound: ['webhook_payload', 'webhook_headers.content-type', 'webhook_headers.user-agent', 'triggered_at'],
};

// Community entity fields for condition node suggestions
const COMMUNITY_ENTITY_FIELD_SUGGESTIONS: Record<string, string[]> = {
  household: ['name', 'household_size', 'address', 'city', 'state', 'zip', 'risk_score', 'primary_contact_id', 'created_at'],
  enrollment: ['status', 'waiver_status', 'enrolled_at', 'completed_at', 'program_id', 'household_id'],
  contribution: ['type', 'value', 'hours', 'status', 'dimension_id', 'household_id', 'date'],
  grant: ['status', 'amount_requested', 'amount_awarded', 'deadline', 'report_due_date', 'tier', 'urgency', 'category', 'mission_fit'],
  job: ['status', 'priority', 'service_address', 'contractor_id', 'assigned_at', 'completed_at'],
  referral: ['service_type', 'status', 'outcome', 'partner_organization_id', 'created_at'],
  registration: ['waiver_status', 'check_in_at', 'event_id', 'person_id'],
  access: ['status', 'start_time', 'end_time', 'approved_by', 'purpose'],
  broadcast: ['status', 'channel', 'recipient_count', 'sent_at'],
};

// Community loop collection sources
const COMMUNITY_LOOP_COLLECTIONS = [
  { value: 'household.members', label: 'Household members' },
  { value: 'household.enrollments', label: 'Household program enrollments' },
  { value: 'household.contributions', label: 'Household contributions' },
  { value: 'household.referrals', label: 'Household referrals' },
  { value: 'program.enrollments', label: 'Program enrollments' },
  { value: 'event.registrations', label: 'Event registrations' },
  { value: 'job.time_entries', label: 'Job time entries' },
  { value: 'grant.milestones', label: 'Grant report milestones' },
];

// Community AI agent prompt suggestions
const COMMUNITY_AI_PROMPTS = [
  "Summarize this household's service history and identify gaps in coverage",
  "Draft a compassionate follow-up email to a program participant who missed their last session",
  "Review this grant narrative and identify potential compliance risks or missing required elements",
  "Analyze this household's contribution and engagement history and suggest an appropriate recognition level",
  "Generate a clear, professional job brief for a contractor based on the scope description and service address",
  "Identify households that may be at risk of dropping out based on recent attendance patterns",
  "Draft a thank-you note for a volunteer contribution, personalizing it based on hours contributed",
];

// ── Hook: fetch project resources ────────────────────────────────────────────

function useProjectResources(slug: string | undefined) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [sequences, setSequences] = useState<ProjectSequence[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [zapierConnections, setZapierConnections] = useState<ZapierConnection[]>([]);

  useEffect(() => {
    if (!slug) return;

    async function fetchResources() {
      const [membersRes, tagsRes, sequencesRes, templatesRes, connectionsRes] = await Promise.allSettled([
        fetch(`/api/projects/${slug}/members?limit=100`),
        fetch(`/api/projects/${slug}/tags?limit=100`),
        fetch(`/api/projects/${slug}/sequences?status=active&limit=100`),
        fetch(`/api/projects/${slug}/templates?is_active=true&limit=100`),
        fetch(`/api/projects/${slug}/api-connections`),
      ]);

      if (membersRes.status === 'fulfilled' && membersRes.value.ok) {
        const data = await membersRes.value.json();
        setMembers(data.members ?? []);
      }
      if (tagsRes.status === 'fulfilled' && tagsRes.value.ok) {
        const data = await tagsRes.value.json();
        setTags(data.tags ?? []);
      }
      if (sequencesRes.status === 'fulfilled' && sequencesRes.value.ok) {
        const data = await sequencesRes.value.json();
        setSequences(data.sequences ?? []);
      }
      if (templatesRes.status === 'fulfilled' && templatesRes.value.ok) {
        const data = await templatesRes.value.json();
        setTemplates(data.data ?? []);
      }
      if (connectionsRes.status === 'fulfilled' && connectionsRes.value.ok) {
        const data = await connectionsRes.value.json();
        const conns: ZapierConnection[] = (data.connections ?? []).filter(
          (c: ZapierConnection) => c.service_type === 'zapier' && c.status === 'active'
        );
        setZapierConnections(conns);
      }
    }

    fetchResources();
  }, [slug]);

  return { members, tags, sequences, templates, zapierConnections };
}

function getMemberLabel(m: ProjectMember) {
  return m.user.full_name || m.user.email;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowPropertyPanel({ projectType }: { projectType?: string }) {
  const params = useParams();
  const slug = params.slug as string | undefined;
  const workflowId = params.id as string | undefined;
  const resources = useProjectResources(slug);

  const {
    nodes,
    triggerType,
    triggerConfig,
    selectedNodeId,
    setSelectedNodeId,
    setPropertyPanelOpen,
    setTriggerType,
    setTriggerConfig,
    updateNodeData,
    removeNode,
  } = useWorkflowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const { type, data } = selectedNode;
  const config = type === 'start'
    ? { ...(data.config || {}), ...triggerConfig, trigger_type: triggerType }
    : data.config || {};

  function updateConfig(key: string, value: unknown) {
    if (type === 'start') {
      if (key === 'trigger_type') {
        setTriggerType(String(value || 'manual'));
        return;
      }
      setTriggerConfig({ ...triggerConfig, [key]: value });
      return;
    }

    updateNodeData(selectedNode!.id, {
      config: { ...config, [key]: value },
    });
  }

  function batchUpdateConfig(updates: Record<string, unknown>) {
    updateNodeData(selectedNode!.id, {
      config: { ...config, ...updates },
    });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Node Properties</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setSelectedNodeId(null);
            setPropertyPanelOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Node label */}
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={data.label}
          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Node description */}
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={data.description || ''}
          onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
          className="text-sm min-h-[60px]"
          placeholder="Optional description..."
        />
      </div>

      {/* Type-specific config */}
      {renderTypeConfig(type, config, updateConfig, resources, slug, batchUpdateConfig, projectType, workflowId)}

      {/* Delete button */}
      {type !== 'start' && (
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => { removeNode(selectedNode.id); setSelectedNodeId(null); }}
          >
            Delete Node
          </Button>
        </div>
      )}
    </div>
  );
}

// ── WebhookInboundConfig component ───────────────────────────────────────────

interface WebhookTokenState {
  hasToken: boolean;
  maskedToken: string | null;
  receiverUrl: string;
  revealedToken: string | null;
  loading: boolean;
  regenerating: boolean;
  copied: boolean;
  tokenCopied: boolean;
}

function WebhookInboundConfig({ slug, workflowId }: { slug: string; workflowId: string }) {
  const [state, setState] = useState<WebhookTokenState>({
    hasToken: false,
    maskedToken: null,
    receiverUrl: '',
    revealedToken: null,
    loading: true,
    regenerating: false,
    copied: false,
    tokenCopied: false,
  });
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (!slug || !workflowId) return;
    fetch(`/api/projects/${slug}/workflows/${workflowId}/webhook-token`)
      .then((r) => r.json())
      .then((d) => setState((s) => ({
        ...s,
        hasToken: d.has_token ?? false,
        maskedToken: d.masked_token ?? null,
        receiverUrl: d.receiver_url ?? '',
        loading: false,
      })))
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, [slug, workflowId]);

  async function generateToken() {
    setState((s) => ({ ...s, regenerating: true }));
    setConfirmRegen(false);
    try {
      const res = await fetch(`/api/projects/${slug}/workflows/${workflowId}/webhook-token`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setState((s) => ({
          ...s,
          hasToken: true,
          maskedToken: null,
          receiverUrl: d.receiver_url ?? s.receiverUrl,
          revealedToken: d.token ?? null,
          regenerating: false,
        }));
      } else {
        setState((s) => ({ ...s, regenerating: false }));
      }
    } catch {
      setState((s) => ({ ...s, regenerating: false }));
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(state.receiverUrl).then(() => {
      setState((s) => ({ ...s, copied: true }));
      setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
    }).catch(() => {});
  }

  function copyToken() {
    const tok = state.revealedToken ?? '';
    navigator.clipboard.writeText(tok).then(() => {
      setState((s) => ({ ...s, tokenCopied: true }));
      setTimeout(() => setState((s) => ({ ...s, tokenCopied: false })), 2000);
    }).catch(() => {});
  }

  if (state.loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 space-y-1">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This workflow triggers when an external service POSTs to your unique webhook URL.
          Compatible with Typeform, Stripe, n8n, and any service that sends HTTP webhooks.
        </p>
      </div>

      {/* Receiver URL */}
      <div className="space-y-1.5">
        <Label className="text-xs">Receiver URL</Label>
        <div className="flex gap-1.5">
          <Input
            readOnly
            value={state.receiverUrl || '(save workflow first)'}
            className="h-8 text-xs font-mono flex-1 bg-muted/50"
          />
          <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={copyUrl} disabled={!state.receiverUrl}>
            {state.copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Secret Token */}
      <div className="space-y-1.5">
        <Label className="text-xs">Secret Token</Label>
        {state.revealedToken ? (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <Input
                readOnly
                value={state.revealedToken}
                className="h-8 text-xs font-mono flex-1 bg-green-50 dark:bg-green-950 border-green-300"
              />
              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={copyToken}>
                {state.tokenCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              Copy this token now — it cannot be shown again after you leave this panel.
            </p>
          </div>
        ) : state.hasToken ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{state.maskedToken ?? '••••••••••••'}</span>
            <span className="text-[10px]">(token set)</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No token generated yet.</p>
        )}
      </div>

      {/* Generate / Regenerate button */}
      {!confirmRegen ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => {
            if (state.hasToken) {
              setConfirmRegen(true);
            } else {
              generateToken();
            }
          }}
          disabled={state.regenerating}
        >
          {state.regenerating ? (
            <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Generating…</>
          ) : state.hasToken ? (
            <><RefreshCw className="h-3 w-3 mr-1.5" />Regenerate Token</>
          ) : (
            'Generate Token'
          )}
        </Button>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-2.5 space-y-2">
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            Regenerating will invalidate the existing token. Any services using the old token will stop working immediately.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" className="flex-1 h-7 text-xs" onClick={generateToken}>
              Regenerate
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setConfirmRegen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Usage instructions */}
      <div className="space-y-1 pt-1">
        <Label className="text-xs text-muted-foreground">How to use</Label>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          POST to the URL above with your token as <code className="font-mono bg-muted px-0.5 rounded">?token=…</code> or as <code className="font-mono bg-muted px-0.5 rounded">Authorization: Bearer …</code>. The request body (JSON or text) will be available as <code className="font-mono bg-muted px-0.5 rounded">{'{{context.webhook_payload}}'}</code> in downstream nodes.
        </p>
      </div>
    </div>
  );
}

// ── CrmActionPanel component ──────────────────────────────────────────────────

interface CrmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface CrmToolGroup {
  key: string;
  label: string;
  tools: CrmTool[];
}

interface CrmActionPanelProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  batchUpdateConfig: (updates: Record<string, unknown>) => void;
  slug: string;
}

function CrmActionPanel({ config, updateConfig, batchUpdateConfig, slug }: CrmActionPanelProps) {
  const mode = (config.mode as string) || 'manual';
  const toolName = (config.tool_name as string) || '';

  const [groups, setGroups] = useState<CrmToolGroup[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!slug) return;
    setToolsLoading(true);
    fetch(`/api/projects/${slug}/workflows/tools`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => setGroups([]))
      .finally(() => setToolsLoading(false));
  }, [slug]);

  const allTools = groups.flatMap((g) => g.tools);
  const selectedTool = allTools.find((t) => t.name === toolName);

  const filteredGroups = search.trim()
    ? [{
        key: 'results',
        label: 'Results',
        tools: allTools.filter((t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
        ),
      }]
    : groups;

  const schemaProps = selectedTool?.parameters
    ? ((selectedTool.parameters as { properties?: Record<string, { type?: string; description?: string }> }).properties ?? null)
    : null;
  const requiredFields: string[] = selectedTool?.parameters
    ? ((selectedTool.parameters as { required?: string[] }).required ?? [])
    : [];

  const params = (config.params as Record<string, unknown>) || {};

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Mode</Label>
        <Select value={mode} onValueChange={(v) => updateConfig('mode', v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">CRM Action (specify tool + params)</SelectItem>
            <SelectItem value="ai_params">AI-Assisted (you pick tool, AI fills params)</SelectItem>
            <SelectItem value="ai_selection">Fully Automatic (AI picks tool and params)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tool picker — shown for manual and ai_params */}
      {(mode === 'manual' || mode === 'ai_params' || !mode) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Popover open={toolOpen} onOpenChange={setToolOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={toolOpen}
                className="w-full justify-between h-8 text-sm font-normal"
              >
                {selectedTool
                  ? <span className="truncate">{selectedTool.description || toolName}</span>
                  : <span className="text-muted-foreground truncate">Search CRM actions…</span>
                }
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search actions…"
                  value={search}
                  onValueChange={setSearch}
                  className="text-sm"
                />
                <CommandList className="max-h-64">
                  {toolsLoading && (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />Loading actions…
                    </div>
                  )}
                  {!toolsLoading && filteredGroups.length === 0 && (
                    <CommandEmpty>No actions found.</CommandEmpty>
                  )}
                  {!toolsLoading && filteredGroups.map((group) => (
                    <CommandGroup key={group.key} heading={group.label}>
                      {group.tools.map((tool) => (
                        <CommandItem
                          key={tool.name}
                          value={tool.name}
                          onSelect={() => {
                            batchUpdateConfig({ tool_name: tool.name, params: {}, server_url: 'internal' });
                            setToolOpen(false);
                            setSearch('');
                          }}
                        >
                          <Check className={cn('mr-2 h-3.5 w-3.5 shrink-0', toolName === tool.name ? 'opacity-100' : 'opacity-0')} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{tool.description}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{tool.name}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected tool description */}
          {selectedTool?.description && (
            <p className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
              {selectedTool.description}
              <span className="ml-1 font-mono opacity-60">({toolName})</span>
            </p>
          )}
        </div>
      )}

      {/* Parameter form — manual mode with a selected tool */}
      {mode === 'manual' && schemaProps && Object.keys(schemaProps).length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-medium">Parameters</Label>
          {Object.entries(schemaProps).map(([key, prop]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                {key}
                {requiredFields.includes(key) && <span className="text-red-500 ml-0.5">*</span>}
                {prop.description && <span className="ml-1 opacity-60">— {prop.description}</span>}
              </Label>
              <Input
                value={(params[key] as string) ?? ''}
                onChange={(e) => updateConfig('params', { ...params, [key]: e.target.value })}
                className="h-7 text-xs"
                placeholder={`{{context.${key}}}`}
              />
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Use <code className="font-mono bg-muted px-0.5 rounded">{'{{context.field}}'}</code> for dynamic values from previous nodes.
          </p>
        </div>
      )}

      {/* Manual mode — raw JSON params fallback when no schema */}
      {mode === 'manual' && toolName && !schemaProps && (
        <div className="space-y-1.5">
          <Label className="text-xs">Parameters (JSON)</Label>
          <Textarea
            value={Object.keys(params).length > 0 ? JSON.stringify(params, null, 2) : ''}
            onChange={(e) => {
              try { updateConfig('params', JSON.parse(e.target.value)); } catch { /* let user keep typing */ }
            }}
            className="text-xs font-mono min-h-[80px]"
            placeholder={'{\n  "name": "{{context.name}}"\n}'}
          />
          <p className="text-[10px] text-muted-foreground">
            Use <code className="font-mono bg-muted px-0.5 rounded">{'{{context.field}}'}</code> for dynamic values.
          </p>
        </div>
      )}

      {/* AI prompt — shown for ai_params and ai_selection */}
      {(mode === 'ai_params' || mode === 'ai_selection') && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            {mode === 'ai_params' ? 'Describe parameters' : 'Describe what to do'}
          </Label>
          <Textarea
            value={(config.task_description as string) || ''}
            onChange={(e) => updateConfig('task_description', e.target.value)}
            className="text-sm min-h-[80px]"
            placeholder={
              mode === 'ai_params'
                ? 'e.g. Create a follow-up task assigned to the deal owner, due in 3 days'
                : 'e.g. Look up the contact and log a call activity with a summary'
            }
          />
          {mode === 'ai_selection' && (
            <p className="text-[10px] text-muted-foreground">
              The AI will choose the best CRM action based on your description.
            </p>
          )}
        </div>
      )}

      {/* Output key */}
      <div className="space-y-1.5">
        <Label className="text-xs">Output Key</Label>
        <Input
          value={(config.output_key as string) || ''}
          onChange={(e) => updateConfig('output_key', e.target.value)}
          className="h-8 text-sm"
          placeholder="crm_result"
        />
        <p className="text-[10px] text-muted-foreground">
          Result stored as <code className="font-mono bg-muted px-0.5 rounded">{'{{context.<output_key>}}'}</code>
        </p>
      </div>
    </div>
  );
}

// ── Type-specific config rendering ───────────────────────────────────────────

function renderTypeConfig(
  type: WorkflowNodeType,
  config: Record<string, unknown>,
  updateConfig: (key: string, value: unknown) => void,
  resources: ReturnType<typeof useProjectResources>,
  slug?: string,
  batchUpdateConfig?: (updates: Record<string, unknown>) => void,
  projectType?: string,
  workflowId?: string,
) {
  const { members, tags, sequences, templates } = resources;
  const isCommunity = projectType === 'community';

  // Filter action options by project type
  const visibleActionOptions = actionTypeOptions.filter((opt) =>
    isCommunity ? COMMUNITY_ACTION_TYPES.has(opt.type) : STANDARD_ACTION_TYPES.has(opt.type)
  );

  switch (type) {
    case 'start': {
      const selectedTrigger = (config.trigger_type as WorkflowTriggerType) || null;
      const contextFields = selectedTrigger ? (TRIGGER_CONTEXT_FIELDS[selectedTrigger] ?? []) : [];
      const filteredGroups = getFilteredTriggerGroups(projectType ?? 'standard');
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Trigger Type</Label>
            <Select
              value={(config.trigger_type as string) || ''}
              onValueChange={(v) => updateConfig('trigger_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select trigger..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {/* Shared neutral triggers */}
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">General</div>
                <SelectItem value="manual">Manual (triggered by user)</SelectItem>
                <SelectItem value="webhook_inbound">Inbound Webhook</SelectItem>
                <SelectItem value="schedule">Schedule (cron)</SelectItem>
                {SHARED_TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/\./g, ' › ')}</SelectItem>
                ))}
                {/* Project-type-specific groups */}
                {filteredGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">{group.label}</div>
                    {group.triggers.map((t) => (
                      <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger config fields for time-based triggers */}
          {selectedTrigger && (selectedTrigger === 'time.entity_inactive' || selectedTrigger === 'time.created_ago' || selectedTrigger === 'referral.overdue' || selectedTrigger === 'job.inaction_warning') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Days</Label>
              <Input
                type="number"
                value={(config.days as number) ?? 14}
                onChange={(e) => updateConfig('days', Number(e.target.value))}
                className="h-8 text-sm"
                min={1}
              />
            </div>
          )}
          {selectedTrigger && (selectedTrigger === 'grant.deadline_approaching' || selectedTrigger === 'grant.report_due_soon') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Days Before</Label>
              <Input
                type="number"
                value={(config.days_before as number) ?? 7}
                onChange={(e) => updateConfig('days_before', Number(e.target.value))}
                className="h-8 text-sm"
                min={1}
              />
            </div>
          )}
          {selectedTrigger === 'schedule' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Cron Expression</Label>
                <Input
                  value={(config.cron_expression as string) ?? ''}
                  onChange={(e) => updateConfig('cron_expression', e.target.value)}
                  className="h-8 text-sm font-mono"
                  placeholder="0 9 * * 1"
                />
                <p className="text-[10px] text-muted-foreground">
                  5-field cron: minute hour day month weekday
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Or Interval Minutes</Label>
                <Input
                  type="number"
                  value={(config.interval_minutes as number) ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateConfig('interval_minutes', value ? Number(value) : undefined);
                  }}
                  className="h-8 text-sm"
                  min={1}
                  placeholder="60"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank if using cron. The scheduler will use whichever is configured.
                </p>
              </div>
            </>
          )}
          {selectedTrigger === 'webhook_inbound' && slug && workflowId && (
            <WebhookInboundConfig slug={slug} workflowId={workflowId} />
          )}

          {/* Context variable reference */}
          {contextFields.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Available context variables</Label>
              <div className="rounded-md border bg-muted/50 p-2 space-y-0.5">
                {contextFields.map((f) => (
                  <div key={f} className="text-[10px] font-mono text-muted-foreground">{'{{context.' + f + '}}'}</div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Use these in action templates and conditions downstream.</p>
            </div>
          )}
        </div>
      );
    }

    case 'action':
      return (
        <div className="space-y-3">
          {/* Action type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Action Type</Label>
            <Select
              value={(config.action_type as string) || ''}
              onValueChange={(v) => updateConfig('action_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {visibleActionOptions.map((opt) => (
                  <SelectItem key={opt.type} value={opt.type}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Action-specific config fields ── */}

          {config.action_type === 'create_task' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Task Title</Label>
                <Input
                  value={(config.title as string) ?? ''}
                  onChange={(e) => updateConfig('title', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g. Follow up with {{name}}"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={(config.description as string) ?? ''}
                  onChange={(e) => updateConfig('description', e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Optional task description..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={(config.priority as string) ?? 'medium'}
                  onValueChange={(v) => updateConfig('priority', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due in (days)</Label>
                <Input
                  type="number"
                  value={(config.due_in_days as number) ?? 3}
                  onChange={(e) => updateConfig('due_in_days', Number(e.target.value))}
                  className="h-8 text-sm"
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assign to</Label>
                <Select
                  value={(config.assign_to as string) ?? ''}
                  onValueChange={(v) => updateConfig('assign_to', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select member (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {getMemberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {config.action_type === 'update_field' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Field</Label>
                <Select
                  value={(config.field_name as string) ?? ''}
                  onValueChange={(v) => updateConfig('field_name', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {updateFieldOptions.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value</Label>
                {config.field_name && fieldValueOptions[config.field_name as string] ? (
                  <Select
                    value={(config.value as string) ?? ''}
                    onValueChange={(v) => updateConfig('value', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(fieldValueOptions[config.field_name as string] ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : config.field_name === 'owner_id' ? (
                  <Select
                    value={(config.value as string) ?? ''}
                    onValueChange={(v) => updateConfig('value', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {getMemberLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={(config.value as string) ?? ''}
                    onChange={(e) => updateConfig('value', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="New value"
                  />
                )}
              </div>
            </div>
          )}

          {config.action_type === 'change_stage' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <Select
                value={(config.stage as string) ?? ''}
                onValueChange={(v) => updateConfig('stage', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {opportunityStages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.action_type === 'change_status' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={(config.status as string) ?? ''}
                onValueChange={(v) => updateConfig('status', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {rfpStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.action_type === 'assign_owner' && (
            <div className="space-y-1.5">
              <Label className="text-xs">New Owner</Label>
              <Select
                value={(config.user_id as string) ?? ''}
                onValueChange={(v) => updateConfig('user_id', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No team members found</div>
                  ) : (
                    members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {getMemberLabel(m)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.action_type === 'send_notification' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Notify</Label>
                <Select
                  value={(config.user_id as string) ?? ''}
                  onValueChange={(v) => updateConfig('user_id', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {getMemberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Input
                  value={(config.message as string) ?? ''}
                  onChange={(e) => updateConfig('message', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Notification message..."
                />
              </div>
            </div>
          )}

          {config.action_type === 'send_email' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email Template</Label>
                <Select
                  value={(config.template_id as string) ?? ''}
                  onValueChange={(v) => updateConfig('template_id', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No active templates found</div>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — {t.subject}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send to field</Label>
                <Input
                  value={(config.to_field as string) ?? 'email'}
                  onChange={(e) => updateConfig('to_field', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Field containing recipient email"
                />
                <p className="text-[10px] text-muted-foreground">
                  Entity field with the recipient email (default: email)
                </p>
              </div>
            </div>
          )}

          {config.action_type === 'send_sms' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                value={(config.message as string) ?? ''}
                onChange={(e) => updateConfig('message', e.target.value)}
                className="text-sm min-h-[80px]"
                placeholder="SMS text. Use {{first_name}}, {{last_name}}, {{email}}, {{phone}} for variables."
              />
              <p className="text-[10px] text-muted-foreground">Max 1600 characters</p>
            </div>
          )}

          {config.action_type === 'enroll_in_sequence' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sequence</Label>
              <Select
                value={(config.sequence_id as string) ?? ''}
                onValueChange={(v) => updateConfig('sequence_id', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {sequences.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active sequences found</div>
                  ) : (
                    sequences.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Only applies to person entities</p>
            </div>
          )}

          {config.action_type === 'add_tag' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tag</Label>
              <Select
                value={(config.tag_id as string) ?? ''}
                onValueChange={(v) => updateConfig('tag_id', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No tags found — create tags first</div>
                  ) : (
                    tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.action_type === 'remove_tag' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tag to Remove</Label>
              <Select
                value={(config.tag_id as string) ?? ''}
                onValueChange={(v) => updateConfig('tag_id', v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No tags found</div>
                  ) : (
                    tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.action_type === 'create_activity' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Activity Type</Label>
                <Select
                  value={(config.type as string) ?? 'note'}
                  onValueChange={(v) => updateConfig('type', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypeOptionsForAction.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={(config.subject as string) ?? ''}
                  onChange={(e) => updateConfig('subject', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Activity subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={(config.notes as string) ?? ''}
                  onChange={(e) => updateConfig('notes', e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Activity notes..."
                />
              </div>
            </div>
          )}

          {config.action_type === 'fire_webhook' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                value={(config.webhook_url as string) ?? ''}
                onChange={(e) => updateConfig('webhook_url', e.target.value)}
                className="h-8 text-sm"
                placeholder="https://..."
              />
            </div>
          )}

          {config.action_type === 'run_ai_research' && (
            <p className="text-xs text-muted-foreground">
              Triggers AI research on the entity. No additional configuration needed.
            </p>
          )}

          {config.action_type === 'run_workflow' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Workflow ID</Label>
              <Input
                value={(config.workflow_id as string) ?? ''}
                onChange={(e) => updateConfig('workflow_id', e.target.value)}
                className="h-8 text-sm"
                placeholder="Target workflow ID"
              />
            </div>
          )}

          {/* ── Community-specific action configs ── */}

          {config.action_type === 'enroll_in_program' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Program ID or context field</Label>
                <Input value={(config.program_id as string) ?? ''} onChange={(e) => updateConfig('program_id', e.target.value)} className="h-8 text-sm" placeholder="e.g. {{context.program_id}} or UUID" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Person ID field</Label>
                <Input value={(config.person_id_field as string) ?? 'household.primary_contact_id'} onChange={(e) => updateConfig('person_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Household ID field</Label>
                <Input value={(config.household_id_field as string) ?? 'household.id'} onChange={(e) => updateConfig('household_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Initial Status</Label>
                <Select value={(config.status as string) ?? 'active'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {config.action_type === 'update_enrollment_status' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Enrollment ID field</Label>
                <Input value={(config.enrollment_id_field as string) ?? 'enrollment.id'} onChange={(e) => updateConfig('enrollment_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select value={(config.status as string) ?? 'active'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {config.action_type === 'record_attendance' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Program ID field</Label>
                <Input value={(config.program_id_field as string) ?? 'program.id'} onChange={(e) => updateConfig('program_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Person ID field</Label>
                <Input value={(config.person_id_field as string) ?? 'person.id'} onChange={(e) => updateConfig('person_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Attendance Status</Label>
                <Select value={(config.status as string) ?? 'present'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hours</Label>
                <Input value={(config.hours as string) ?? ''} onChange={(e) => updateConfig('hours', e.target.value)} className="h-8 text-sm" placeholder="number (default 0)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date (leave blank for today)</Label>
                <Input value={(config.date as string) ?? ''} onChange={(e) => updateConfig('date', e.target.value)} className="h-8 text-sm" placeholder="YYYY-MM-DD or context field" />
              </div>
            </div>
          )}

          {config.action_type === 'create_contribution' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Contribution Type</Label>
                <Select value={(config.type as string) ?? 'monetary'} onValueChange={(v) => updateConfig('type', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monetary">Monetary</SelectItem>
                    <SelectItem value="in_kind">In-Kind</SelectItem>
                    <SelectItem value="volunteer_hours">Volunteer Hours</SelectItem>
                    <SelectItem value="grant">Grant</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Household ID field</Label>
                <Input value={(config.household_id_field as string) ?? 'household.id'} onChange={(e) => updateConfig('household_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value / Amount</Label>
                <Input value={(config.value as string) ?? ''} onChange={(e) => updateConfig('value', e.target.value)} className="h-8 text-sm" placeholder="number or context field" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hours (for volunteer_hours)</Label>
                <Input value={(config.hours as string) ?? ''} onChange={(e) => updateConfig('hours', e.target.value)} className="h-8 text-sm" placeholder="number or context field" />
              </div>
            </div>
          )}

          {config.action_type === 'assign_job' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Job ID field</Label>
                <Input value={(config.job_id_field as string) ?? 'job.id'} onChange={(e) => updateConfig('job_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contractor ID field</Label>
                <Input value={(config.contractor_id_field as string) ?? ''} onChange={(e) => updateConfig('contractor_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path or UUID" />
              </div>
            </div>
          )}

          {config.action_type === 'update_job_status' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Job ID field</Label>
                <Input value={(config.job_id_field as string) ?? 'job.id'} onChange={(e) => updateConfig('job_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select value={(config.status as string) ?? 'in_progress'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {config.action_type === 'create_referral' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Household ID field</Label>
                <Input value={(config.household_id_field as string) ?? 'household.id'} onChange={(e) => updateConfig('household_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Service Type</Label>
                <Input value={(config.service_type as string) ?? ''} onChange={(e) => updateConfig('service_type', e.target.value)} className="h-8 text-sm" placeholder="e.g. Food Assistance" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={(config.notes as string) ?? ''} onChange={(e) => updateConfig('notes', e.target.value)} className="text-sm min-h-[60px]" placeholder="Optional referral notes..." />
              </div>
            </div>
          )}

          {config.action_type === 'update_referral_status' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Referral ID field</Label>
                <Input value={(config.referral_id_field as string) ?? 'referral.id'} onChange={(e) => updateConfig('referral_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select value={(config.status as string) ?? 'in_progress'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Outcome (optional)</Label>
                <Input value={(config.outcome as string) ?? ''} onChange={(e) => updateConfig('outcome', e.target.value)} className="h-8 text-sm" placeholder="Outcome notes..." />
              </div>
            </div>
          )}

          {config.action_type === 'send_broadcast' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input value={(config.subject as string) ?? ''} onChange={(e) => updateConfig('subject', e.target.value)} className="h-8 text-sm" placeholder="Broadcast subject..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body</Label>
                <Textarea value={(config.body as string) ?? ''} onChange={(e) => updateConfig('body', e.target.value)} className="text-sm min-h-[80px]" placeholder="Message body. Use {{context.field}} for variables." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select value={(config.channel as string) ?? 'email'} onValueChange={(v) => updateConfig('channel', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email only</SelectItem>
                    <SelectItem value="sms">SMS only</SelectItem>
                    <SelectItem value="both">Email + SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">⚠ This will send to all matching recipients. Use carefully.</p>
            </div>
          )}

          {config.action_type === 'update_grant_status' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Grant ID field</Label>
                <Input value={(config.grant_id_field as string) ?? 'grant.id'} onChange={(e) => updateConfig('grant_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select value={(config.status as string) ?? 'under_review'} onValueChange={(v) => updateConfig('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="researching">Researching</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="awarded">Awarded</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {config.action_type === 'flag_household_risk' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Household ID field</Label>
                <Input value={(config.household_id_field as string) ?? 'household.id'} onChange={(e) => updateConfig('household_id_field', e.target.value)} className="h-8 text-sm" placeholder="context field path" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Risk Level</Label>
                <Select value={(config.risk_level as string) ?? 'high'} onValueChange={(v) => updateConfig('risk_level', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="none">None (clear flag)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason (optional)</Label>
                <Input value={(config.reason as string) ?? ''} onChange={(e) => updateConfig('reason', e.target.value)} className="h-8 text-sm" placeholder="Reason for flag..." />
              </div>
            </div>
          )}
        </div>
      );

    case 'ai_agent':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select
              value={(config.model as string) || 'google/gemini-2.5-flash'}
              onValueChange={(v) => updateConfig('model', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                <SelectItem value="anthropic/claude-haiku-4">Claude Haiku 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prompt</Label>
            <Textarea
              value={(config.prompt as string) || ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              className="text-sm min-h-[100px]"
              placeholder="Describe what the AI should do..."
            />
          </div>
          {isCommunity && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Community prompt suggestions</Label>
              <div className="space-y-1">
                {COMMUNITY_AI_PROMPTS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="w-full text-left text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded px-2 py-1 transition-colors truncate"
                    onClick={() => updateConfig('prompt', suggestion)}
                    title={suggestion}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Output Key</Label>
            <Input
              value={(config.output_key as string) || ''}
              onChange={(e) => updateConfig('output_key', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. ai_response"
            />
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Input
              value={(config.field as string) || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.stage"
            />
          </div>
          {isCommunity && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Field suggestions</Label>
              {Object.entries(COMMUNITY_ENTITY_FIELD_SUGGESTIONS).map(([entity, fields]) => (
                <div key={entity} className="space-y-0.5">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{entity}</div>
                  <div className="flex flex-wrap gap-1">
                    {fields.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="text-[9px] bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono transition-colors"
                        onClick={() => updateConfig('field', `context.${entity}.${f}`)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Operator</Label>
            <Select
              value={(config.operator as string) || 'equals'}
              onValueChange={(v) => updateConfig('operator', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionOperatorLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              value={String(config.value ?? '')}
              onChange={(e) => updateConfig('value', e.target.value)}
              className="h-8 text-sm"
              placeholder="Value to compare..."
            />
          </div>
        </div>
      );

    case 'delay':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Delay Type</Label>
            <Select
              value={(config.delay_type as string) || 'duration'}
              onValueChange={(v) => updateConfig('delay_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="until_date">Until Date</SelectItem>
                <SelectItem value="until_field">Until Field Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(!config.delay_type || (config.delay_type as string) === 'duration') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={((config.duration_ms as number) || 0) / 60000}
                onChange={(e) => updateConfig('duration_ms', Number(e.target.value) * 60000)}
                className="h-8 text-sm"
              />
            </div>
          )}
          {(config.delay_type as string) === 'until_date' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Until Date (ISO 8601)</Label>
              <Input
                value={(config.until_date as string) || ''}
                onChange={(e) => updateConfig('until_date', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 2026-04-01T09:00:00Z"
              />
            </div>
          )}
          {(config.delay_type as string) === 'until_field' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Field Path</Label>
              <Input
                value={(config.field_path as string) || ''}
                onChange={(e) => updateConfig('field_path', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. context.due_date"
              />
            </div>
          )}
        </div>
      );

    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              value={(config.url as string) || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              className="h-8 text-sm"
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select
              value={(config.method as string) || 'POST'}
              onValueChange={(v) => updateConfig('method', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'mcp_tool':
      return (
        <CrmActionPanel
          config={config}
          updateConfig={updateConfig}
          batchUpdateConfig={batchUpdateConfig ?? (() => {})}
          slug={slug ?? ''}
        />
      );

    case 'loop':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Collection Path</Label>
            <Input
              value={(config.collection_path as string) || ''}
              onChange={(e) => updateConfig('collection_path', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.organizations"
            />
          </div>
          {isCommunity && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Collection quick-picks</Label>
              <div className="flex flex-wrap gap-1">
                {COMMUNITY_LOOP_COLLECTIONS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    className="text-[9px] bg-muted hover:bg-accent rounded px-1.5 py-0.5 transition-colors"
                    onClick={() => updateConfig('collection_path', `context.${col.value}`)}
                    title={col.label}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Item Key</Label>
            <Input
              value={(config.item_key as string) || 'item'}
              onChange={(e) => updateConfig('item_key', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      );

    case 'zapier':
      return (
        <ZapierConfigPanel
          config={config}
          updateConfig={updateConfig}
          batchUpdateConfig={batchUpdateConfig!}
          slug={slug ?? ''}
          connections={resources.zapierConnections}
        />
      );

    case 'sub_workflow':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Workflow ID (external)</Label>
            <Input
              value={(config.workflow_id as string) || ''}
              onChange={(e) => updateConfig('workflow_id', e.target.value)}
              className="h-8 text-sm"
              placeholder="Leave empty for inline sub-workflow"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Double-click this node on the canvas to edit its inline definition.
          </p>
        </div>
      );

    case 'switch':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Input
              value={(config.field as string) || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.status"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Cases can be configured by adding edges with labels from this node.
          </p>
        </div>
      );

    default:
      return null;
  }
}

// ── Zapier Config Panel (extracted as component for hooks) ────────────────────

interface ZapierTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

interface ZapierConfigPanelProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  batchUpdateConfig: (updates: Record<string, unknown>) => void;
  slug: string;
  connections: ZapierConnection[];
}

function ZapierConfigPanel({ config, updateConfig, batchUpdateConfig, slug, connections }: ZapierConfigPanelProps) {
  const connectionId = (config.connection_id as string) || '';
  const action = (config.action as string) || '';
  const params = (config.params as Record<string, unknown>) || {};

  const [tools, setTools] = useState<ZapierTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);

  const fetchTools = useCallback(async (connId: string, refresh = false) => {
    if (!connId || !slug) return;
    setToolsLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/api-connections/${connId}/tools${refresh ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools ?? []);
      }
    } catch {
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  }, [slug]);

  // Fetch tools when connection changes
  useEffect(() => {
    if (connectionId) {
      fetchTools(connectionId);
    } else {
      setTools([]);
    }
  }, [connectionId, fetchTools]);

  const selectedTool = tools.find((t) => t.name === action);
  const schemaProps = selectedTool?.inputSchema?.properties;
  const requiredFields = selectedTool?.inputSchema?.required ?? [];

  return (
    <div className="space-y-3">
      {/* Connection dropdown */}
      <div className="space-y-1.5">
        <Label className="text-xs">Connection</Label>
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active Zapier connections. Add one in Settings → API Connections.
          </p>
        ) : (
          <Select
            value={connectionId}
            onValueChange={(v) => {
              const conn = connections.find((c) => c.id === v);
              batchUpdateConfig({
                connection_id: v,
                connection_name: conn?.name ?? '',
                action: '',
                params: {},
              });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select a connection..." />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  <span className="flex items-center gap-2">
                    {conn.name}
                    <Badge variant="outline" className="text-[10px] py-0">
                      {conn.status}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Action combobox */}
      {connectionId && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Action</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => fetchTools(connectionId, true)}
              disabled={toolsLoading}
              title="Refresh available actions"
            >
              {toolsLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {toolsLoading && tools.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching available actions...
            </div>
          ) : (
            <Popover open={actionOpen} onOpenChange={setActionOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={actionOpen}
                  className="w-full h-8 justify-between text-sm font-normal"
                >
                  <span className="truncate">
                    {action || 'Select an action...'}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search actions..." />
                  <CommandList>
                    {tools.length === 0 ? (
                      <CommandEmpty>No actions found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {tools.map((tool) => (
                          <CommandItem
                            key={tool.name}
                            value={tool.name}
                            onSelect={() => {
                              batchUpdateConfig({ action: tool.name, params: {} });
                              setActionOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-3 w-3',
                                action === tool.name ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm truncate">{tool.name}</span>
                              {tool.description && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {tool.description}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Selected action description */}
      {selectedTool?.description && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          {selectedTool.description}
        </p>
      )}

      {/* Dynamic params form from inputSchema */}
      {schemaProps && Object.keys(schemaProps).length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-medium">Parameters</Label>
          {Object.entries(schemaProps).map(([key, prop]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                {key}
                {requiredFields.includes(key) && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              <Input
                value={(params[key] as string) ?? ''}
                onChange={(e) =>
                  updateConfig('params', { ...params, [key]: e.target.value })
                }
                className="h-7 text-xs"
                placeholder={prop.description || `{{context.${key}}}`}
              />
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Use {'{{context.field}}'} syntax for dynamic values from previous nodes.
          </p>
        </div>
      )}
    </div>
  );
}
