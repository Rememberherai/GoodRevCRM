'use client';

import { useState } from 'react';
import { Mail, Clock } from 'lucide-react';
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
import type { SequenceStep, DelayUnit } from '@/types/sequence';
import { DELAY_UNIT_LABELS } from '@/types/sequence';

interface StepEditorProps {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}

export function StepEditor({ step, onUpdate }: StepEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  if (step.step_type === 'delay') {
    return <DelayEditor step={step} onUpdate={onUpdate} />;
  }

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
            <div className="border rounded-lg p-6 min-h-[300px] bg-white">
              <div className="prose prose-sm max-w-none">
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
        <span>Delay Step</span>
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
          The next email will be sent {step.delay_amount || 1}{' '}
          {step.delay_unit ? DELAY_UNIT_LABELS[step.delay_unit].toLowerCase() : 'days'}{' '}
          after the previous step.
        </p>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
