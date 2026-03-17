'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
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
import { useWorkflowStore } from '@/stores/workflow-store';
import {
  actionTypeOptions,
  conditionOperatorLabels,
  opportunityStages,
  rfpStatuses,
} from '@/types/automation';
import { ACTIVITY_TYPE_LABELS } from '@/types/activity';
import type { ActivityType } from '@/types/activity';
import type { WorkflowNodeType } from '@/types/workflow';

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

// ── Hook: fetch project resources ────────────────────────────────────────────

function useProjectResources(slug: string | undefined) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [sequences, setSequences] = useState<ProjectSequence[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);

  useEffect(() => {
    if (!slug) return;

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

  return { members, tags, sequences, templates };
}

function getMemberLabel(m: ProjectMember) {
  return m.user.full_name || m.user.email;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowPropertyPanel() {
  const params = useParams();
  const slug = params.slug as string | undefined;
  const resources = useProjectResources(slug);

  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    setPropertyPanelOpen,
    updateNodeData,
    removeNode,
  } = useWorkflowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const { type, data } = selectedNode;
  const config = data.config || {};

  function updateConfig(key: string, value: unknown) {
    updateNodeData(selectedNode!.id, {
      config: { ...config, [key]: value },
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
      {renderTypeConfig(type, config, updateConfig, resources)}

      {/* Delete button */}
      {type !== 'start' && (
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => removeNode(selectedNode.id)}
          >
            Delete Node
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Type-specific config rendering ───────────────────────────────────────────

function renderTypeConfig(
  type: WorkflowNodeType,
  config: Record<string, unknown>,
  updateConfig: (key: string, value: unknown) => void,
  resources: ReturnType<typeof useProjectResources>
) {
  const { members, tags, sequences, templates } = resources;

  switch (type) {
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
                {actionTypeOptions.map((opt) => (
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select
              value={(config.mode as string) || 'manual'}
              onValueChange={(v) => updateConfig('mode', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (select tool + params)</SelectItem>
                <SelectItem value="ai_params">AI Parameters (tool selected, AI fills params)</SelectItem>
                <SelectItem value="ai_selection">AI Selection (AI picks the tool)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {((config.mode as string) === 'manual' || (config.mode as string) === 'ai_params' || !config.mode) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={(config.tool_name as string) || ''}
                onChange={(e) => updateConfig('tool_name', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. organizations.list"
              />
            </div>
          )}
          {((config.mode as string) === 'ai_params' || (config.mode as string) === 'ai_selection') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Natural Language Prompt</Label>
              <Textarea
                value={(config.task_description as string) || ''}
                onChange={(e) => updateConfig('task_description', e.target.value)}
                className="text-sm min-h-[80px]"
                placeholder="Describe what tool to use and how..."
              />
            </div>
          )}
        </div>
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Connection</Label>
            <Input
              value={(config.connection_id as string) || ''}
              onChange={(e) => updateConfig('connection_id', e.target.value)}
              className="h-8 text-sm"
              placeholder="API Connection ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Input
              value={(config.action as string) || ''}
              onChange={(e) => updateConfig('action', e.target.value)}
              className="h-8 text-sm"
              placeholder="Zapier action name"
            />
          </div>
        </div>
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
