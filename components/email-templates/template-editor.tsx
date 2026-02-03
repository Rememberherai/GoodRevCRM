'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Plus, Trash2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createTemplateSchema, type CreateTemplateInput } from '@/lib/validators/email-template';
import type { EmailTemplate, EmailTemplateCategory, TemplateVariable } from '@/types/email-template';
import { categoryLabels, commonVariables } from '@/types/email-template';

interface TemplateEditorProps {
  template?: EmailTemplate;
  onSave: (data: CreateTemplateInput) => Promise<void>;
  onCancel: () => void;
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>(
    template?.variables || []
  );
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      subject: template?.subject || '',
      body_html: template?.body_html || '',
      body_text: template?.body_text || '',
      category: template?.category || 'other',
      is_active: template?.is_active ?? true,
      is_shared: template?.is_shared ?? false,
    },
  });

  const bodyHtml = watch('body_html');
  const subject = watch('subject');

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      {
        name: '',
        label: '',
        type: 'text',
        required: false,
      },
    ]);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleVariableChange = (
    index: number,
    field: keyof TemplateVariable,
    value: string | boolean
  ) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [field]: value } as TemplateVariable;
    setVariables(newVariables);
  };

  const insertVariable = (varName: string) => {
    const insertion = `{{${varName}}}`;
    const textarea = document.querySelector('textarea[name="body_html"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        bodyHtml.substring(0, start) + insertion + bodyHtml.substring(end);
      setValue('body_html', newValue);
      // Set cursor position after insertion
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertion.length, start + insertion.length);
      }, 0);
    }
  };

  const onSubmit = async (data: CreateTemplateInput) => {
    setSaving(true);
    try {
      await onSave({
        ...data,
        variables: variables.filter((v) => v.name && v.label),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {template ? 'Edit Template' : 'New Template'}
        </h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Template Name</Label>
          <Input id="name" {...register('name')} placeholder="Welcome Email" />
          {errors.name && (
            <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            defaultValue={template?.category || 'other'}
            onValueChange={(value) =>
              setValue('category', value as EmailTemplateCategory)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          {...register('description')}
          placeholder="Brief description of this template"
        />
      </div>

      <div>
        <Label htmlFor="subject">Subject Line</Label>
        <Input
          id="subject"
          {...register('subject')}
          placeholder="Welcome to {{company}}, {{first_name}}!"
        />
        {errors.subject && (
          <p className="text-sm text-red-500 mt-1">{errors.subject.message}</p>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={watch('is_active')}
            onCheckedChange={(checked) => setValue('is_active', checked)}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="is_shared"
            checked={watch('is_shared')}
            onCheckedChange={(checked) => setValue('is_shared', checked)}
          />
          <Label htmlFor="is_shared">Shared with team</Label>
        </div>
      </div>

      {/* Variables */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Available Variables</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddVariable}>
            <Plus className="h-3 w-3 mr-1" />
            Add Custom
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mb-4">
          {commonVariables.map((v) => (
            <Button
              key={v.name}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => insertVariable(v.name)}
            >
              {`{{${v.name}}}`}
            </Button>
          ))}
          {variables.map((v) =>
            v.name ? (
              <Button
                key={v.name}
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={() => insertVariable(v.name)}
              >
                {`{{${v.name}}}`}
              </Button>
            ) : null
          )}
        </div>

        {/* Custom variables */}
        {variables.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3">
            {variables.map((variable, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="name"
                  value={variable.name}
                  onChange={(e) =>
                    handleVariableChange(index, 'name', e.target.value)
                  }
                  className="w-32"
                />
                <Input
                  placeholder="Label"
                  value={variable.label}
                  onChange={(e) =>
                    handleVariableChange(index, 'label', e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveVariable(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-4">
          <Label htmlFor="body_html">Email Body (HTML)</Label>
          <Textarea
            id="body_html"
            {...register('body_html')}
            rows={15}
            className="font-mono text-sm"
            placeholder="<p>Hello {{first_name}},</p>..."
          />
          {errors.body_html && (
            <p className="text-sm text-red-500 mt-1">{errors.body_html.message}</p>
          )}
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <div className="border rounded-lg p-4 bg-white text-black">
            <div className="border-b pb-2 mb-4">
              <p className="text-sm text-gray-500">Subject:</p>
              <p className="font-medium">{subject || '(No subject)'}</p>
            </div>
            <div
              className="prose prose-sm max-w-none [&_*]:!text-black [&_a]:!text-blue-600"
              dangerouslySetInnerHTML={{ __html: bodyHtml || '<p>No content</p>' }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div>
        <Label htmlFor="body_text">Plain Text Version (optional)</Label>
        <Textarea
          id="body_text"
          {...register('body_text')}
          rows={8}
          placeholder="Hello {{first_name}},..."
        />
      </div>
    </form>
  );
}
