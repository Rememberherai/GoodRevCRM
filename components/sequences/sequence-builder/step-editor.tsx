'use client';

import { useState } from 'react';
import { Mail, Clock, MessageSquare, Phone, CheckSquare, Linkedin } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariablePicker } from './variable-picker';
import type {
  SequenceStep,
  DelayUnit,
  StepPriority,
  LinkedInActionType,
  CallStepConfig,
  TaskStepConfig,
  LinkedInStepConfig,
} from '@/types/sequence';
import {
  DELAY_UNIT_LABELS,
  PRIORITY_LABELS,
  LINKEDIN_ACTION_LABELS,
  DEFAULT_CALL_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LINKEDIN_CONFIG,
} from '@/types/sequence';

interface StepEditorProps {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}

export function StepEditor({ step, onUpdate }: StepEditorProps) {
  if (step.step_type === 'delay') {
    return <DelayEditor step={step} onUpdate={onUpdate} />;
  }

  if (step.step_type === 'sms') {
    return <SmsEditor step={step} onUpdate={onUpdate} />;
  }

  if (step.step_type === 'call') {
    return <CallEditor step={step} onUpdate={onUpdate} />;
  }

  if (step.step_type === 'task') {
    return <TaskEditor step={step} onUpdate={onUpdate} />;
  }

  if (step.step_type === 'linkedin') {
    return <LinkedInEditor step={step} onUpdate={onUpdate} />;
  }

  // Default: email editor
  return <EmailEditor step={step} onUpdate={onUpdate} />;
}

// Email Editor Component
function EmailEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" />
        <span>Email Step</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject Line</Label>
          <div className="flex gap-2">
            <Input
              id="subject"
              value={step.subject || ''}
              onChange={(e) => onUpdate({ subject: e.target.value })}
              placeholder="Enter subject line..."
            />
            <VariablePicker
              onInsert={(variable) => {
                const input = document.getElementById('subject') as HTMLInputElement;
                if (input) {
                  const start = input.selectionStart || 0;
                  const end = input.selectionEnd || 0;
                  const value = step.subject || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  onUpdate({ subject: newValue });
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Keep it under 50 characters for best open rates.
            {step.subject && (
              <span className={step.subject.length > 50 ? ' text-orange-500' : ''}>
                {' '}({step.subject.length} characters)
              </span>
            )}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
          <div className="flex items-center justify-between">
            <Label>Email Body</Label>
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs px-2">
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-2">
                Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" className="mt-2">
            <div className="space-y-2">
              <div className="flex justify-end">
                <VariablePicker
                  onInsert={(variable) => {
                    const textarea = document.getElementById('body') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart || 0;
                      const end = textarea.selectionEnd || 0;
                      const value = step.body_html || '';
                      const newValue =
                        value.substring(0, start) +
                        `{{${variable}}}` +
                        value.substring(end);
                      onUpdate({ body_html: newValue, body_text: stripHtml(newValue) });
                    }
                  }}
                />
              </div>
              <Textarea
                id="body"
                value={step.body_html || ''}
                onChange={(e) => onUpdate({
                  body_html: e.target.value,
                  body_text: stripHtml(e.target.value),
                })}
                placeholder="Write your email content here..."
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use HTML for formatting. Variables like {'{{first_name}}'} will be replaced with actual values.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-2">
            <div className="border rounded-lg p-6 min-h-[300px] bg-white text-black">
              <div className="prose prose-sm max-w-none [&_*]:!text-black [&_a]:!text-blue-600">
                {step.body_html ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: step.body_html
                        .replace(/\{\{first_name\}\}/g, '<span class="bg-blue-100 px-1 rounded">John</span>')
                        .replace(/\{\{last_name\}\}/g, '<span class="bg-blue-100 px-1 rounded">Smith</span>')
                        .replace(/\{\{company_name\}\}/g, '<span class="bg-blue-100 px-1 rounded">Acme Corp</span>')
                        .replace(/\{\{job_title\}\}/g, '<span class="bg-blue-100 px-1 rounded">Director of Operations</span>')
                        .replace(/\{\{sender_name\}\}/g, '<span class="bg-green-100 px-1 rounded">You</span>'),
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No content to preview</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Delay Editor Component
function DelayEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Wait Step</span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delay_amount">Wait Duration</Label>
            <Input
              id="delay_amount"
              type="number"
              min="1"
              value={step.delay_amount || 1}
              onChange={(e) =>
                onUpdate({ delay_amount: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay_unit">Unit</Label>
            <Select
              value={step.delay_unit || 'days'}
              onValueChange={(value) => onUpdate({ delay_unit: value as DelayUnit })}
            >
              <SelectTrigger id="delay_unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DELAY_UNIT_LABELS) as DelayUnit[]).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {DELAY_UNIT_LABELS[unit]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          The next step will run {step.delay_amount || 1}{' '}
          {step.delay_unit ? DELAY_UNIT_LABELS[step.delay_unit].toLowerCase() : 'days'}{' '}
          after the previous step.
        </p>
      </div>
    </div>
  );
}

// SMS Editor Component
function SmsEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  const charCount = step.sms_body?.length || 0;
  const maxChars = 1600;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>SMS Step</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sms_body">Message</Label>
            <VariablePicker
              onInsert={(variable) => {
                const textarea = document.getElementById('sms_body') as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const value = step.sms_body || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  onUpdate({ sms_body: newValue });
                }
              }}
            />
          </div>
          <Textarea
            id="sms_body"
            value={step.sms_body || ''}
            onChange={(e) => onUpdate({ sms_body: e.target.value })}
            placeholder="Hi {{first_name}}, ..."
            rows={6}
            maxLength={maxChars}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Sends an SMS to the contact&apos;s phone number via Telnyx.
            </span>
            <span className={charCount > maxChars * 0.9 ? 'text-orange-500' : ''}>
              {charCount}/{maxChars}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Call Editor Component
function CallEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  const config = (step.config || DEFAULT_CALL_CONFIG) as CallStepConfig;

  const updateConfig = (updates: Partial<CallStepConfig>) => {
    onUpdate({ config: { ...config, ...updates } });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-4 w-4" />
        <span>Phone Call Step</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="call_title">Task Title</Label>
            <VariablePicker
              onInsert={(variable) => {
                const input = document.getElementById('call_title') as HTMLInputElement;
                if (input) {
                  const start = input.selectionStart || 0;
                  const end = input.selectionEnd || 0;
                  const value = config.title || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ title: newValue });
                }
              }}
            />
          </div>
          <Input
            id="call_title"
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Call {{first_name}} {{last_name}}"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="call_description">Description</Label>
            <VariablePicker
              onInsert={(variable) => {
                const textarea = document.getElementById('call_description') as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const value = config.description || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ description: newValue });
                }
              }}
            />
          </div>
          <Textarea
            id="call_description"
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Phone: {{phone}}"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="call_priority">Priority</Label>
            <Select
              value={config.priority || 'high'}
              onValueChange={(value) => updateConfig({ priority: value as StepPriority })}
            >
              <SelectTrigger id="call_priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as StepPriority[]).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="call_due_hours">Due In (hours)</Label>
            <Input
              id="call_due_hours"
              type="number"
              min="1"
              max="720"
              value={config.due_in_hours || 24}
              onChange={(e) => updateConfig({ due_in_hours: parseInt(e.target.value) || 24 })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Creates a task to call the contact when this step is reached. The task will be assigned to the user who enrolled the contact.
        </p>
      </div>
    </div>
  );
}

// Task Editor Component
function TaskEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  const config = (step.config || DEFAULT_TASK_CONFIG) as TaskStepConfig;

  const updateConfig = (updates: Partial<TaskStepConfig>) => {
    onUpdate({ config: { ...config, ...updates } });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckSquare className="h-4 w-4" />
        <span>Task Step</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task_title">Task Title</Label>
            <VariablePicker
              onInsert={(variable) => {
                const input = document.getElementById('task_title') as HTMLInputElement;
                if (input) {
                  const start = input.selectionStart || 0;
                  const end = input.selectionEnd || 0;
                  const value = config.title || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ title: newValue });
                }
              }}
            />
          </div>
          <Input
            id="task_title"
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Task for {{first_name}} {{last_name}}"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task_description">Description</Label>
            <VariablePicker
              onInsert={(variable) => {
                const textarea = document.getElementById('task_description') as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const value = config.description || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ description: newValue });
                }
              }}
            />
          </div>
          <Textarea
            id="task_description"
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Task details..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="task_priority">Priority</Label>
            <Select
              value={config.priority || 'medium'}
              onValueChange={(value) => updateConfig({ priority: value as StepPriority })}
            >
              <SelectTrigger id="task_priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as StepPriority[]).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task_due_hours">Due In (hours)</Label>
            <Input
              id="task_due_hours"
              type="number"
              min="1"
              max="720"
              value={config.due_in_hours || 48}
              onChange={(e) => updateConfig({ due_in_hours: parseInt(e.target.value) || 48 })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Creates a task when this step is reached. The task will be assigned to the user who enrolled the contact.
        </p>
      </div>
    </div>
  );
}

// LinkedIn Editor Component
function LinkedInEditor({
  step,
  onUpdate,
}: {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}) {
  const config = (step.config || DEFAULT_LINKEDIN_CONFIG) as LinkedInStepConfig;

  const updateConfig = (updates: Partial<LinkedInStepConfig>) => {
    onUpdate({ config: { ...config, ...updates } });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Linkedin className="h-4 w-4" />
        <span>LinkedIn Step</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="linkedin_action">Action Type</Label>
          <Select
            value={config.action || 'view_profile'}
            onValueChange={(value) => updateConfig({ action: value as LinkedInActionType })}
          >
            <SelectTrigger id="linkedin_action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LINKEDIN_ACTION_LABELS) as LinkedInActionType[]).map((action) => (
                <SelectItem key={action} value={action}>
                  {LINKEDIN_ACTION_LABELS[action]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="linkedin_title">Task Title</Label>
            <VariablePicker
              onInsert={(variable) => {
                const input = document.getElementById('linkedin_title') as HTMLInputElement;
                if (input) {
                  const start = input.selectionStart || 0;
                  const end = input.selectionEnd || 0;
                  const value = config.title || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ title: newValue });
                }
              }}
            />
          </div>
          <Input
            id="linkedin_title"
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="LinkedIn: View {{first_name}} {{last_name}}"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="linkedin_description">Description</Label>
            <VariablePicker
              onInsert={(variable) => {
                const textarea = document.getElementById('linkedin_description') as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const value = config.description || '';
                  const newValue =
                    value.substring(0, start) +
                    `{{${variable}}}` +
                    value.substring(end);
                  updateConfig({ description: newValue });
                }
              }}
            />
          </div>
          <Textarea
            id="linkedin_description"
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Profile: {{linkedin}}"
            rows={2}
          />
        </div>

        {config.action === 'send_message' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="linkedin_message">Message Template</Label>
              <VariablePicker
                onInsert={(variable) => {
                  const textarea = document.getElementById('linkedin_message') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart || 0;
                    const end = textarea.selectionEnd || 0;
                    const value = config.message_template || '';
                    const newValue =
                      value.substring(0, start) +
                      `{{${variable}}}` +
                      value.substring(end);
                    updateConfig({ message_template: newValue });
                  }
                }}
              />
            </div>
            <Textarea
              id="linkedin_message"
              value={config.message_template || ''}
              onChange={(e) => updateConfig({ message_template: e.target.value })}
              placeholder="Hi {{first_name}}, I noticed you work at {{company_name}}..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This message will be shown in the task description as a suggested template.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin_priority">Priority</Label>
            <Select
              value={config.priority || 'medium'}
              onValueChange={(value) => updateConfig({ priority: value as StepPriority })}
            >
              <SelectTrigger id="linkedin_priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as StepPriority[]).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_due_hours">Due In (hours)</Label>
            <Input
              id="linkedin_due_hours"
              type="number"
              min="1"
              max="720"
              value={config.due_in_hours || 24}
              onChange={(e) => updateConfig({ due_in_hours: parseInt(e.target.value) || 24 })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Creates a LinkedIn action task when this step is reached. The task will include the contact&apos;s LinkedIn URL.
        </p>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
