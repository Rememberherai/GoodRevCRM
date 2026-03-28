'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Plus, Trash2, Blocks, Code } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createTemplateSchema, type CreateTemplateInput } from '@/lib/validators/email-template';
import { EmailBuilder } from '@/components/email-builder/email-builder';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { emailDesignSchema } from '@/lib/email-builder/schema';
import { createDefaultDesign } from '@/lib/email-builder/default-blocks';
import { renderDesignToInnerHtml } from '@/lib/email-builder/render-html';
import { renderDesignToText } from '@/lib/email-builder/render-text';
import { validateDesign, hasBlockingErrors, hasWarningsOnly } from '@/lib/email-builder/validation';
import type { EmailDesign } from '@/types/email-builder';
import type { EmailTemplate, EmailTemplateCategory, TemplateVariable } from '@/types/email-template';
import { categoryLabels, commonVariables } from '@/types/email-template';
import { getVariablesForProjectType } from '@/lib/email-builder/variables';
import type { BuilderVariable } from '@/lib/email-builder/variables';

type EditorMode = 'builder' | 'html';

interface TemplateEditorProps {
  template?: EmailTemplate;
  projectType?: string;
  onSave: (data: CreateTemplateInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * Try to parse design_json from a template record into a valid EmailDesign.
 * Returns null if not present or invalid.
 */
function parseDesignJson(raw: Record<string, unknown> | null | undefined): EmailDesign | null {
  if (!raw) return null;
  const result = emailDesignSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function TemplateEditor({ template, projectType = 'standard', onSave, onCancel }: TemplateEditorProps) {
  const existingDesign = parseDesignJson(template?.design_json);

  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>(existingDesign ? 'builder' : 'html');
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>(
    template?.variables || []
  );
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Builder variables — base set plus any custom variables the user has defined
  const builderVariables: BuilderVariable[] = useMemo(() => {
    const base = getVariablesForProjectType(projectType as 'standard' | 'community');
    const custom: BuilderVariable[] = variables
      .filter((v) => v.name && v.label)
      .map((v) => ({
        name: v.name,
        label: v.label,
        description: v.description || v.label,
        entity: 'person' as const,
        previewValue: v.default_value || `{{${v.name}}}`,
      }));
    return [...base, ...custom];
  }, [projectType, variables]);

  // Zustand store for builder mode
  const design = useEmailBuilderStore((s) => s.design);
  const loadDesign = useEmailBuilderStore((s) => s.loadDesign);
  const resetDesign = useEmailBuilderStore((s) => s.resetDesign);

  // Initialize builder store with existing design
  useEffect(() => {
    if (existingDesign) {
      loadDesign(existingDesign);
    } else {
      resetDesign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Seed design_json so the Zod refinement passes in builder mode
      // (the actual store design is injected in onSubmit)
      design_json: existingDesign ? (existingDesign as unknown as Record<string, unknown>) : undefined,
      category: template?.category || 'other',
      is_active: template?.is_active ?? true,
      is_shared: template?.is_shared ?? false,
    },
  });

  const bodyHtml = watch('body_html') ?? '';
  const subject = watch('subject');

  // ── Variable management ────────────────────────────────────────────────

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      { name: '', label: '', type: 'text', required: false },
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
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value } as TemplateVariable;
    setVariables(newVars);
  };

  const insertVariable = (varName: string) => {
    if (editorMode === 'html') {
      const insertion = `{{${varName}}}`;
      const textarea = document.querySelector('textarea[name="body_html"]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = bodyHtml.substring(0, start) + insertion + bodyHtml.substring(end);
        setValue('body_html', newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
      }
    }
    // In builder mode, variables are inserted via the text block toolbar picker
  };

  // ── Mode switching ─────────────────────────────────────────────────────

  const switchToBuilder = useCallback(() => {
    const html = bodyHtml?.trim();
    if (html) {
      // Convert legacy HTML → single text block
      const converted: EmailDesign = {
        ...createDefaultDesign(),
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text' as const,
            html,
          },
        ],
      };
      loadDesign(converted);
    } else {
      resetDesign();
    }
    setEditorMode('builder');
    // Set a sentinel so the Zod refinement sees design_json as present
    setValue('design_json', { _builder: true } as unknown as Record<string, unknown>);
    setShowConvertDialog(false);
  }, [bodyHtml, loadDesign, resetDesign, setValue]);

  const handleModeToggle = (mode: EditorMode) => {
    if (mode === editorMode) return;
    if (mode === 'builder' && bodyHtml?.trim()) {
      // Warn before converting
      setShowConvertDialog(true);
    } else if (mode === 'builder') {
      switchToBuilder();
    } else {
      // Switching to HTML mode — render block-level content (not full document)
      // into body_html/body_text so HTML mode reflects the current builder state
      const currentDesign = useEmailBuilderStore.getState().design;
      setValue('body_html', renderDesignToInnerHtml(currentDesign));
      setValue('body_text', renderDesignToText(currentDesign));
      setValue('design_json', undefined);
      setEditorMode('html');
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: CreateTemplateInput) => {
    setValidationErrors([]);

    if (editorMode === 'builder') {
      const vErrors = validateDesign(design);
      if (hasBlockingErrors(vErrors)) {
        setValidationErrors(vErrors.filter((e) => e.severity === 'error').map((e) => e.message));
        return;
      }
      if (hasWarningsOnly(vErrors)) {
        setValidationErrors(vErrors.map((e) => `Warning: ${e.message}`));
        // Warnings don't block — continue to save
      }
    }

    setSaving(true);
    try {
      const payload: CreateTemplateInput = {
        ...data,
        variables: variables.filter((v) => v.name && v.label),
      };

      if (editorMode === 'builder') {
        // Send design_json — API will derive body_html and body_text
        payload.design_json = design as unknown as Record<string, unknown>;
      } else {
        // HTML mode — clear design_json so legacy path is used
        payload.design_json = null;
      }

      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <Button
                type="button"
                variant={editorMode === 'builder' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => handleModeToggle('builder')}
              >
                <Blocks className="h-3.5 w-3.5" />
                Builder
              </Button>
              <Button
                type="button"
                variant={editorMode === 'html' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => handleModeToggle('html')}
              >
                <Code className="h-3.5 w-3.5" />
                HTML
              </Button>
            </div>
          </div>
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

        {/* Metadata fields */}
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
              onValueChange={(value) => setValue('category', value as EmailTemplateCategory)}
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

        {/* Variables — shown in HTML mode (builder has its own picker) */}
        {editorMode === 'html' && (
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

            {variables.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3">
                {variables.map((variable, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="name"
                      value={variable.name}
                      onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                      className="w-32"
                    />
                    <Input
                      placeholder="Label"
                      value={variable.label}
                      onChange={(e) => handleVariableChange(index, 'label', e.target.value)}
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
        )}

        {/* Validation messages */}
        {validationErrors.length > 0 && (
          <div className="space-y-1">
            {validationErrors.map((msg, i) => (
              <p key={i} className={`text-sm ${msg.startsWith('Warning:') ? 'text-yellow-600' : 'text-red-500'}`}>
                {msg}
              </p>
            ))}
          </div>
        )}

        {/* Body — Builder or HTML mode */}
        {editorMode === 'builder' ? (
          <div className="border rounded-lg overflow-hidden" style={{ height: 560 }}>
            <EmailBuilder showPreview variables={builderVariables} />
          </div>
        ) : (
          <>
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
          </>
        )}
      </form>

      {/* Convert to Builder confirmation */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Builder</AlertDialogTitle>
            <AlertDialogDescription>
              Your existing HTML will be placed in a single text block. Some formatting may change
              as the builder normalizes the HTML. The original HTML is preserved until you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={switchToBuilder}>Convert</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
