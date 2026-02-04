'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type {
  Automation,
  TriggerType,
  AutomationCondition,
  AutomationAction,
  ActionType,
  ConditionOperator,
  AutomationEntityType,
} from '@/types/automation';
import {
  triggerTypeGroups,
  actionTypeOptions,
  conditionOperatorLabels,
  opportunityStages,
  rfpStatuses,
} from '@/types/automation';
import { ACTIVITY_TYPE_LABELS } from '@/types/activity';
import type { ActivityType } from '@/types/activity';
import { MEETING_TYPE_LABELS, MEETING_OUTCOME_LABELS } from '@/types/meeting';
import type { MeetingType, MeetingOutcome } from '@/types/meeting';

interface AutomationFormProps {
  automation?: Automation;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  slug: string;
}

const entityTypeOptions: { value: AutomationEntityType; label: string }[] = [
  { value: 'organization', label: 'Organization' },
  { value: 'person', label: 'Person' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'rfp', label: 'RFP' },
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
];

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

// Entity fields available for conditions, keyed by entity type
const entityFieldOptions: Record<string, { value: string; label: string }[]> = {
  organization: [
    { value: 'name', label: 'Name' },
    { value: 'domain', label: 'Domain' },
    { value: 'website', label: 'Website' },
    { value: 'industry', label: 'Industry' },
    { value: 'employee_count', label: 'Employee Count' },
    { value: 'annual_revenue', label: 'Annual Revenue' },
    { value: 'description', label: 'Description' },
    { value: 'phone', label: 'Phone' },
    { value: 'address_city', label: 'City' },
    { value: 'address_state', label: 'State' },
    { value: 'address_country', label: 'Country' },
    { value: 'owner_id', label: 'Owner' },
  ],
  person: [
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'job_title', label: 'Job Title' },
    { value: 'department', label: 'Department' },
    { value: 'timezone', label: 'Timezone' },
    { value: 'preferred_contact_method', label: 'Preferred Contact' },
    { value: 'address_city', label: 'City' },
    { value: 'address_state', label: 'State' },
    { value: 'address_country', label: 'Country' },
    { value: 'enrichment_status', label: 'Enrichment Status' },
    { value: 'owner_id', label: 'Owner' },
  ],
  opportunity: [
    { value: 'name', label: 'Name' },
    { value: 'stage', label: 'Stage' },
    { value: 'amount', label: 'Amount' },
    { value: 'currency', label: 'Currency' },
    { value: 'probability', label: 'Probability' },
    { value: 'expected_close_date', label: 'Expected Close Date' },
    { value: 'source', label: 'Source' },
    { value: 'campaign', label: 'Campaign' },
    { value: 'competitor', label: 'Competitor' },
    { value: 'lost_reason', label: 'Lost Reason' },
    { value: 'won_reason', label: 'Won Reason' },
    { value: 'days_in_stage', label: 'Days in Stage' },
    { value: 'owner_id', label: 'Owner' },
  ],
  rfp: [
    { value: 'title', label: 'Title' },
    { value: 'status', label: 'Status' },
    { value: 'estimated_value', label: 'Estimated Value' },
    { value: 'currency', label: 'Currency' },
    { value: 'win_probability', label: 'Win Probability' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'decision_date', label: 'Decision Date' },
    { value: 'submission_method', label: 'Submission Method' },
    { value: 'go_no_go_decision', label: 'Go/No-Go Decision' },
    { value: 'budget_range', label: 'Budget Range' },
    { value: 'outcome_reason', label: 'Outcome Reason' },
    { value: 'awarded_to', label: 'Awarded To' },
    { value: 'owner_id', label: 'Owner' },
  ],
  task: [
    { value: 'title', label: 'Title' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'description', label: 'Description' },
  ],
  meeting: [
    { value: 'title', label: 'Title' },
    { value: 'meeting_type', label: 'Meeting Type' },
    { value: 'status', label: 'Status' },
    { value: 'outcome', label: 'Outcome' },
    { value: 'duration_minutes', label: 'Duration (min)' },
    { value: 'location', label: 'Location' },
    { value: 'outcome_notes', label: 'Outcome Notes' },
    { value: 'next_steps', label: 'Next Steps' },
  ],
};

// Known value options for condition fields — when a user picks one of these fields,
// show a dropdown instead of a text input for the Value column.
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
    // Task statuses
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    // Meeting statuses
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'no_show', label: 'No Show' },
  ],
  priority: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
  meeting_type: [
    { value: 'discovery', label: 'Discovery' },
    { value: 'demo', label: 'Demo' },
    { value: 'proposal_review', label: 'Proposal Review' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'check_in', label: 'Check-in' },
    { value: 'qbr', label: 'QBR' },
    { value: 'general', label: 'General' },
  ],
  outcome: [
    { value: 'positive', label: 'Positive' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'negative', label: 'Negative' },
    { value: 'follow_up_needed', label: 'Follow-up Needed' },
    { value: 'deal_advanced', label: 'Deal Advanced' },
    { value: 'no_outcome', label: 'No Outcome' },
  ],
  go_no_go_decision: [
    { value: 'go', label: 'Go' },
    { value: 'no_go', label: 'No Go' },
    { value: 'pending', label: 'Pending' },
  ],
  submission_method: [
    { value: 'email', label: 'Email' },
    { value: 'portal', label: 'Portal' },
    { value: 'mail', label: 'Mail' },
    { value: 'in_person', label: 'In Person' },
    { value: 'other', label: 'Other' },
  ],
  preferred_contact_method: [
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'other', label: 'Other' },
  ],
  enrichment_status: [
    { value: 'pending', label: 'Pending' },
    { value: 'enriched', label: 'Enriched' },
    { value: 'failed', label: 'Failed' },
    { value: 'not_found', label: 'Not Found' },
  ],
  currency: [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' },
    { value: 'CAD', label: 'CAD' },
    { value: 'AUD', label: 'AUD' },
  ],
  source: [
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'referral', label: 'Referral' },
    { value: 'partner', label: 'Partner' },
    { value: 'event', label: 'Event' },
    { value: 'other', label: 'Other' },
  ],
};

// User-facing activity types for the create_activity action
const activityTypeOptionsForAction: { value: ActivityType; label: string }[] = (
  Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]
)
  .filter(([v]) => v !== 'system' && v !== 'sequence_completed')
  .map(([value, label]) => ({ value, label }));

export function AutomationForm({
  automation,
  onSubmit,
  onCancel,
  loading,
  slug,
}: AutomationFormProps) {
  const [name, setName] = useState(automation?.name ?? '');
  const [description, setDescription] = useState(automation?.description ?? '');
  const [isActive, setIsActive] = useState(automation?.is_active ?? false);
  const [triggerType, setTriggerType] = useState<TriggerType | ''>(
    automation?.trigger_type ?? ''
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    (automation?.trigger_config as Record<string, unknown>) ?? {}
  );
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    automation?.conditions ?? []
  );
  const [actions, setActions] = useState<AutomationAction[]>(
    automation?.actions ?? [{ type: 'create_task', config: {} }]
  );

  // Project resource data for dropdowns
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [sequences, setSequences] = useState<ProjectSequence[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);

  // Fetch project resources for dropdowns
  useEffect(() => {
    async function fetchResources() {
      const [membersRes, tagsRes, sequencesRes, templatesRes] = await Promise.allSettled([
        fetch(`/api/projects/${slug}/members?limit=100`),
        fetch(`/api/projects/${slug}/tags?limit=100`),
        fetch(`/api/projects/${slug}/sequences?status=active&limit=100`),
        fetch(`/api/projects/${slug}/templates?is_active=true&limit=100`),
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
    }

    fetchResources();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerType || !name || actions.length === 0) return;

    await onSubmit({
      name,
      description: description || null,
      is_active: isActive,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      conditions,
      actions,
    });
  };

  // Check if trigger type needs entity_type selector
  const needsEntityType = [
    'entity.created',
    'entity.updated',
    'entity.deleted',
    'field.changed',
    'time.entity_inactive',
    'time.created_ago',
  ].includes(triggerType);

  const needsStageConfig = triggerType === 'opportunity.stage_changed';
  const needsStatusConfig = triggerType === 'rfp.status_changed';
  const needsDaysConfig = [
    'time.entity_inactive',
    'time.close_date_approaching',
    'time.created_ago',
  ].includes(triggerType);
  const needsFieldConfig = triggerType === 'field.changed';
  const needsMeetingTypeConfig = triggerType === 'meeting.scheduled';
  const needsMeetingOutcomeConfig = triggerType === 'meeting.outcome';
  const needsSequenceConfig = ['sequence.completed', 'sequence.replied'].includes(triggerType);

  // Determine the effective entity type for condition field options
  const effectiveEntityType: string | null = (() => {
    if (!triggerType) return null;
    if (triggerConfig.entity_type) return triggerConfig.entity_type as string;
    if (triggerType.startsWith('opportunity.')) return 'opportunity';
    if (triggerType.startsWith('rfp.')) return 'rfp';
    if (triggerType.startsWith('meeting.')) return 'meeting';
    if (triggerType === 'task.completed' || triggerType === 'time.task_overdue') return 'task';
    if (triggerType.startsWith('sequence.') || triggerType.startsWith('email.')) return 'person';
    return null;
  })();

  // Get field options for condition dropdowns
  const conditionFieldOptions = effectiveEntityType
    ? entityFieldOptions[effectiveEntityType] ?? []
    : Object.values(entityFieldOptions).flat()
        .filter((f, i, arr) => arr.findIndex(x => x.value === f.value) === i);

  // Add condition
  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    field: keyof AutomationCondition,
    value: unknown
  ) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  // Add action
  const addAction = () => {
    setActions([...actions, { type: 'create_task', config: {} }]);
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, type: ActionType) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, type, config: {} } : a)));
  };

  const updateActionConfig = (
    index: number,
    key: string,
    value: unknown
  ) => {
    setActions(
      actions.map((a, i) =>
        i === index ? { ...a, config: { ...a.config, [key]: value } } : a
      )
    );
  };

  // Helper to get member display name
  const getMemberLabel = (member: ProjectMember) =>
    member.user.full_name || member.user.email;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Create legal task on negotiation"
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this automation do?"
            className="resize-none"
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Enable automation</Label>
        </div>
      </div>

      <Separator />

      {/* Trigger */}
      <div className="space-y-4">
        <h3 className="font-medium">When this happens...</h3>
        <div>
          <Label>Trigger</Label>
          <Select
            value={triggerType}
            onValueChange={(v) => {
              setTriggerType(v as TriggerType);
              setTriggerConfig({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a trigger..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(triggerTypeGroups).map(([key, group]) => (
                <div key={key}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </div>
                  {group.triggers.map((trigger) => (
                    <SelectItem key={trigger.type} value={trigger.type}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show trigger description for triggers with no extra config */}
        {triggerType && (() => {
          const noConfigTriggers: Record<string, string> = {
            'email.opened': 'Fires when a tracked email is opened by the recipient.',
            'email.clicked': 'Fires when a tracked link in an email is clicked.',
            'email.replied': 'Fires when a reply to a tracked email is detected.',
            'email.bounced': 'Fires when a sent email bounces.',
            'task.completed': 'Fires when any task is marked as complete.',
            'time.task_overdue': 'Fires when a task is past its due date and still open. Checked every 5 minutes.',
          };
          const desc = noConfigTriggers[triggerType];
          return desc ? (
            <p className="text-sm text-muted-foreground">{desc}</p>
          ) : null;
        })()}

        {needsEntityType && (
          <div>
            <Label>Entity Type</Label>
            <Select
              value={(triggerConfig.entity_type as string) ?? ''}
              onValueChange={(v) =>
                setTriggerConfig({ ...triggerConfig, entity_type: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entity type..." />
              </SelectTrigger>
              <SelectContent>
                {entityTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsFieldConfig && (
          <>
            <div>
              <Label>Field Name</Label>
              <Select
                value={(triggerConfig.field_name as string) ?? ''}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, field_name: v, to_value: undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {conditionFieldOptions.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Value (optional)</Label>
              {triggerConfig.field_name && fieldValueOptions[triggerConfig.field_name as string] ? (
                <Select
                  value={(triggerConfig.to_value as string) ?? 'any'}
                  onValueChange={(v) =>
                    setTriggerConfig({ ...triggerConfig, to_value: v === 'any' ? undefined : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any value</SelectItem>
                    {(fieldValueOptions[triggerConfig.field_name as string] ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={(triggerConfig.to_value as string) ?? ''}
                  onChange={(e) =>
                    setTriggerConfig({ ...triggerConfig, to_value: e.target.value || undefined })
                  }
                  placeholder="Only trigger when field changes to this value"
                />
              )}
            </div>
          </>
        )}

        {needsStageConfig && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Stage (optional)</Label>
              <Select
                value={(triggerConfig.from_stage as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, from_stage: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any stage</SelectItem>
                  {opportunityStages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Stage (optional)</Label>
              <Select
                value={(triggerConfig.to_stage as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, to_stage: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any stage</SelectItem>
                  {opportunityStages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {needsStatusConfig && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Status (optional)</Label>
              <Select
                value={(triggerConfig.from_status as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, from_status: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  {rfpStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Status (optional)</Label>
              <Select
                value={(triggerConfig.to_status as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, to_status: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  {rfpStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {needsDaysConfig && (
          <div>
            <Label>
              {triggerType === 'time.close_date_approaching' ? 'Days Before' : 'Days'}
            </Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={
                (triggerConfig.days as number) ??
                (triggerConfig.days_before as number) ??
                7
              }
              onChange={(e) => {
                const key =
                  triggerType === 'time.close_date_approaching' ? 'days_before' : 'days';
                setTriggerConfig({ ...triggerConfig, [key]: parseInt(e.target.value) || 7 });
              }}
            />
          </div>
        )}

        {needsMeetingTypeConfig && (
          <div>
            <Label>Meeting Type (optional)</Label>
            <Select
              value={(triggerConfig.meeting_type as string) ?? 'any'}
              onValueChange={(v) =>
                setTriggerConfig({ ...triggerConfig, meeting_type: v === 'any' ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any type</SelectItem>
                {(Object.entries(MEETING_TYPE_LABELS) as [MeetingType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsMeetingOutcomeConfig && (
          <div className="space-y-4">
            <div>
              <Label>Meeting Type (optional)</Label>
              <Select
                value={(triggerConfig.meeting_type as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, meeting_type: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  {(Object.entries(MEETING_TYPE_LABELS) as [MeetingType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome (optional)</Label>
              <Select
                value={(triggerConfig.outcome as string) ?? 'any'}
                onValueChange={(v) =>
                  setTriggerConfig({ ...triggerConfig, outcome: v === 'any' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any outcome</SelectItem>
                  {(Object.entries(MEETING_OUTCOME_LABELS) as [MeetingOutcome, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {needsSequenceConfig && (
          <div>
            <Label>Sequence (optional)</Label>
            <Select
              value={(triggerConfig.sequence_id as string) ?? 'any'}
              onValueChange={(v) =>
                setTriggerConfig({ ...triggerConfig, sequence_id: v === 'any' ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any sequence</SelectItem>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* Conditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">If these conditions match... (optional)</h3>
          <Button type="button" variant="outline" size="sm" onClick={addCondition}>
            <Plus className="mr-1 h-3 w-3" />
            Add Condition
          </Button>
        </div>

        {conditions.map((condition, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Field</Label>
              <Select
                value={condition.field || ''}
                onValueChange={(v) => updateCondition(index, 'field', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {conditionFieldOptions.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs">Operator</Label>
              <Select
                value={condition.operator}
                onValueChange={(v) =>
                  updateCondition(index, 'operator', v as ConditionOperator)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(conditionOperatorLabels).map(([op, label]) => (
                    <SelectItem key={op} value={op}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
              <div className="flex-1">
                <Label className="text-xs">Value</Label>
                {fieldValueOptions[condition.field] ? (
                  <Select
                    value={String(condition.value ?? '')}
                    onValueChange={(v) => updateCondition(index, 'value', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(fieldValueOptions[condition.field] ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : condition.field === 'owner_id' ? (
                  <Select
                    value={String(condition.value ?? '')}
                    onValueChange={(v) => updateCondition(index, 'value', v)}
                  >
                    <SelectTrigger>
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
                    value={String(condition.value ?? '')}
                    onChange={(e) => updateCondition(index, 'value', e.target.value)}
                    placeholder="Value"
                  />
                )}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeCondition(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Then do this...</h3>
          <Button type="button" variant="outline" size="sm" onClick={addAction}>
            <Plus className="mr-1 h-3 w-3" />
            Add Action
          </Button>
        </div>

        {actions.map((action, index) => (
          <div key={index} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-xs">Action Type</Label>
                <Select
                  value={action.type}
                  onValueChange={(v) => updateAction(index, v as ActionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypeOptions.map((opt) => (
                      <SelectItem key={opt.type} value={opt.type}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {actions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-2"
                  onClick={() => removeAction(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            {/* Action-specific config */}
            {action.type === 'create_task' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Task Title</Label>
                  <Input
                    value={(action.config.title as string) ?? ''}
                    onChange={(e) => updateActionConfig(index, 'title', e.target.value)}
                    placeholder="e.g., Review legal terms"
                  />
                </div>
                <div>
                  <Label className="text-xs">Description (optional)</Label>
                  <Input
                    value={(action.config.description as string) ?? ''}
                    onChange={(e) => updateActionConfig(index, 'description', e.target.value)}
                    placeholder="Task description"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={(action.config.priority as string) ?? 'medium'}
                      onValueChange={(v) => updateActionConfig(index, 'priority', v)}
                    >
                      <SelectTrigger>
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
                  <div>
                    <Label className="text-xs">Due in (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={(action.config.due_in_days as number) ?? 3}
                      onChange={(e) =>
                        updateActionConfig(index, 'due_in_days', parseInt(e.target.value) || 3)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Assign To</Label>
                    <Select
                      value={(action.config.assign_to as string) ?? 'unassigned'}
                      onValueChange={(v) =>
                        updateActionConfig(index, 'assign_to', v === 'unassigned' ? undefined : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {getMemberLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {action.type === 'update_field' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Field Name</Label>
                  <Select
                    value={(action.config.field_name as string) ?? ''}
                    onValueChange={(v) => {
                      updateActionConfig(index, 'field_name', v);
                      updateActionConfig(index, 'value', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionFieldOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  {action.config.field_name && fieldValueOptions[action.config.field_name as string] ? (
                    <Select
                      value={(action.config.value as string) ?? ''}
                      onValueChange={(v) => updateActionConfig(index, 'value', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select value..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(fieldValueOptions[action.config.field_name as string] ?? []).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : action.config.field_name === 'owner_id' ? (
                    <Select
                      value={(action.config.value as string) ?? ''}
                      onValueChange={(v) => updateActionConfig(index, 'value', v)}
                    >
                      <SelectTrigger>
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
                      value={(action.config.value as string) ?? ''}
                      onChange={(e) => updateActionConfig(index, 'value', e.target.value)}
                      placeholder="New value"
                    />
                  )}
                </div>
              </div>
            )}

            {action.type === 'change_stage' && (
              <div>
                <Label className="text-xs">Stage</Label>
                <Select
                  value={(action.config.stage as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'stage', v)}
                >
                  <SelectTrigger>
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

            {action.type === 'change_status' && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={(action.config.status as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'status', v)}
                >
                  <SelectTrigger>
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

            {action.type === 'assign_owner' && (
              <div>
                <Label className="text-xs">New Owner</Label>
                <Select
                  value={(action.config.user_id as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'user_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No team members found
                      </div>
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

            {action.type === 'send_notification' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Notify</Label>
                  <Select
                    value={(action.config.user_id as string) ?? ''}
                    onValueChange={(v) => updateActionConfig(index, 'user_id', v)}
                  >
                    <SelectTrigger>
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
                <div>
                  <Label className="text-xs">Message</Label>
                  <Input
                    value={(action.config.message as string) ?? ''}
                    onChange={(e) => updateActionConfig(index, 'message', e.target.value)}
                    placeholder="Notification message..."
                  />
                </div>
              </div>
            )}

            {action.type === 'send_email' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Email Template</Label>
                  <Select
                    value={(action.config.template_id as string) ?? ''}
                    onValueChange={(v) => updateActionConfig(index, 'template_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No active templates found
                        </div>
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
                <div>
                  <Label className="text-xs">Send to field</Label>
                  <Input
                    value={(action.config.to_field as string) ?? 'email'}
                    onChange={(e) => updateActionConfig(index, 'to_field', e.target.value)}
                    placeholder="Entity field containing the email address"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Field on the entity that contains the recipient email (default: email)
                  </p>
                </div>
              </div>
            )}

            {action.type === 'enroll_in_sequence' && (
              <div>
                <Label className="text-xs">Sequence</Label>
                <Select
                  value={(action.config.sequence_id as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'sequence_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sequence..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sequences.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No active sequences found
                      </div>
                    ) : (
                      sequences.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only applies to person entities
                </p>
              </div>
            )}

            {action.type === 'add_tag' && (
              <div>
                <Label className="text-xs">Tag</Label>
                <Select
                  value={(action.config.tag_id as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'tag_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No tags found — create tags first
                      </div>
                    ) : (
                      tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action.type === 'remove_tag' && (
              <div>
                <Label className="text-xs">Tag to Remove</Label>
                <Select
                  value={(action.config.tag_id as string) ?? ''}
                  onValueChange={(v) => updateActionConfig(index, 'tag_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No tags found
                      </div>
                    ) : (
                      tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action.type === 'run_ai_research' && (
              <p className="text-sm text-muted-foreground">
                Triggers AI research on the entity. No additional configuration needed.
              </p>
            )}

            {action.type === 'create_activity' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Activity Type</Label>
                  <Select
                    value={(action.config.type as string) ?? 'note'}
                    onValueChange={(v) => updateActionConfig(index, 'type', v)}
                  >
                    <SelectTrigger>
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
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={(action.config.subject as string) ?? ''}
                    onChange={(e) => updateActionConfig(index, 'subject', e.target.value)}
                    placeholder="Activity subject"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={(action.config.notes as string) ?? ''}
                    onChange={(e) => updateActionConfig(index, 'notes', e.target.value)}
                    placeholder="Activity notes"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {action.type === 'fire_webhook' && (
              <div>
                <Label className="text-xs">Webhook URL</Label>
                <Input
                  value={(action.config.webhook_url as string) ?? ''}
                  onChange={(e) => updateActionConfig(index, 'webhook_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !triggerType || !name}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {automation ? 'Update Automation' : 'Create Automation'}
        </Button>
      </div>
    </form>
  );
}
