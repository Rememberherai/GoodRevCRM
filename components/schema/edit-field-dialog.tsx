'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCustomFields } from '@/hooks/use-custom-fields';
import { updateCustomFieldDefinitionSchema } from '@/lib/validators/custom-field';
import {
  FIELD_TYPE_LABELS,
  ENTITY_TYPE_LABELS,
  type CustomFieldDefinition,
} from '@/types/custom-field';

interface EditFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
}

interface FormData {
  label: string;
  description: string;
  is_required: boolean;
  is_unique: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_visible_in_list: boolean;
  group_name: string;
  options: { value: string; label: string }[];
  // AI extraction settings
  is_ai_extractable: boolean;
  ai_extraction_hint: string;
  ai_confidence_threshold: number;
}

export function EditFieldDialog({ open, onOpenChange, field }: EditFieldDialogProps) {
  const { update, isLoading } = useCustomFields();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      label: '',
      description: '',
      is_required: false,
      is_unique: false,
      is_searchable: false,
      is_filterable: false,
      is_visible_in_list: true,
      group_name: '',
      options: [],
      // AI extraction defaults
      is_ai_extractable: true,
      ai_extraction_hint: '',
      ai_confidence_threshold: 0.7,
    },
  });

  const { fields: optionFields, append, remove, replace } = useFieldArray({
    control,
    name: 'options',
  });

  const needsOptions = field?.field_type === 'select' || field?.field_type === 'multi_select';

  // Reset form when field changes
  useEffect(() => {
    if (field) {
      const options = Array.isArray(field.options)
        ? (field.options as unknown as { value: string; label: string }[])
        : [];

      reset({
        label: field.label,
        description: field.description ?? '',
        is_required: field.is_required,
        is_unique: field.is_unique,
        is_searchable: field.is_searchable,
        is_filterable: field.is_filterable,
        is_visible_in_list: field.is_visible_in_list,
        group_name: field.group_name ?? '',
        options,
        // AI extraction settings - cast to access the new fields
        is_ai_extractable: (field as { is_ai_extractable?: boolean }).is_ai_extractable ?? true,
        ai_extraction_hint: (field as { ai_extraction_hint?: string | null }).ai_extraction_hint ?? '',
        ai_confidence_threshold: (field as { ai_confidence_threshold?: number | null }).ai_confidence_threshold ?? 0.7,
      });
      replace(options);
    }
  }, [field, reset, replace]);

  const onSubmit = async (formData: FormData) => {
    if (!field) return;
    setFormError(null);

    const data = {
      label: formData.label,
      description: formData.description || null,
      is_required: formData.is_required,
      is_unique: formData.is_unique,
      is_searchable: formData.is_searchable,
      is_filterable: formData.is_filterable,
      is_visible_in_list: formData.is_visible_in_list,
      group_name: formData.group_name || null,
      options: formData.options.filter(o => o.value && o.label),
      // AI extraction settings
      is_ai_extractable: formData.is_ai_extractable,
      ai_extraction_hint: formData.ai_extraction_hint || null,
      ai_confidence_threshold: formData.ai_confidence_threshold,
    };

    // Validate with Zod
    const result = updateCustomFieldDefinitionSchema.safeParse(data);
    if (!result.success) {
      const firstError = result.error.issues[0];
      setFormError(firstError?.message ?? 'Validation failed');
      return;
    }

    try {
      await update(field.id, result.data);
      onOpenChange(false);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    reset();
    setFormError(null);
    onOpenChange(false);
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Custom Field</DialogTitle>
          <DialogDescription>
            Update the &quot;{field.label}&quot; field for {ENTITY_TYPE_LABELS[field.entity_type]}.
            Note: Field name and type cannot be changed after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {formError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Read-only info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Field Name</Label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm">
                {field.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Field Type</Label>
              <div className="px-3 py-2 rounded-md bg-muted text-sm">
                {FIELD_TYPE_LABELS[field.field_type]}
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                {...register('label', { required: 'Label is required' })}
                placeholder="e.g. Contract Type"
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of what this field captures"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_name">Group Name</Label>
              <Input
                id="group_name"
                {...register('group_name')}
                placeholder="e.g. Contract Details"
              />
            </div>
          </div>

          {/* Options for select/multi_select */}
          {needsOptions && (
            <div className="space-y-4">
              <Label>Options</Label>
              <div className="space-y-2">
                {optionFields.map((optionField, index) => (
                  <div key={optionField.id} className="flex items-center gap-2">
                    <Input
                      {...register(`options.${index}.value`)}
                      placeholder="Value"
                      className="font-mono flex-1"
                    />
                    <Input
                      {...register(`options.${index}.label`)}
                      placeholder="Label"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: '', label: '' })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Option
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Warning: Removing options may affect existing records that use those values.
              </p>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-4">
            <Label className="text-base">Field Settings</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_required" className="text-sm font-normal">
                    Required
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Must be filled when creating/editing
                  </p>
                </div>
                <Switch
                  id="is_required"
                  checked={watch('is_required')}
                  onCheckedChange={(checked) => setValue('is_required', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_unique" className="text-sm font-normal">
                    Unique
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Values must be unique across records
                  </p>
                </div>
                <Switch
                  id="is_unique"
                  checked={watch('is_unique')}
                  onCheckedChange={(checked) => setValue('is_unique', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_searchable" className="text-sm font-normal">
                    Searchable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include in search results
                  </p>
                </div>
                <Switch
                  id="is_searchable"
                  checked={watch('is_searchable')}
                  onCheckedChange={(checked) => setValue('is_searchable', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_filterable" className="text-sm font-normal">
                    Filterable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Available as a filter option
                  </p>
                </div>
                <Switch
                  id="is_filterable"
                  checked={watch('is_filterable')}
                  onCheckedChange={(checked) => setValue('is_filterable', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_visible_in_list" className="text-sm font-normal">
                    Visible in List
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show as a column in list views
                  </p>
                </div>
                <Switch
                  id="is_visible_in_list"
                  checked={watch('is_visible_in_list')}
                  onCheckedChange={(checked) => setValue('is_visible_in_list', checked)}
                />
              </div>
            </div>
          </div>

          {/* AI Extraction Settings */}
          <div className="space-y-4">
            <Label className="text-base">AI Research Settings</Label>
            <p className="text-sm text-muted-foreground">
              Configure how AI research extracts values for this field.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_ai_extractable" className="text-sm font-normal">
                    AI Extractable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow AI research to extract this field
                  </p>
                </div>
                <Switch
                  id="is_ai_extractable"
                  checked={watch('is_ai_extractable')}
                  onCheckedChange={(checked) => setValue('is_ai_extractable', checked)}
                />
              </div>

              {watch('is_ai_extractable') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ai_extraction_hint">Extraction Hint</Label>
                    <Textarea
                      id="ai_extraction_hint"
                      {...register('ai_extraction_hint')}
                      placeholder="e.g. Look for the company's founding year on their About page or LinkedIn. Usually found in company history sections."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Instructions for AI on how to find and extract this field value.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_confidence_threshold">
                      Confidence Threshold: {Math.round(watch('ai_confidence_threshold') * 100)}%
                    </Label>
                    <input
                      type="range"
                      id="ai_confidence_threshold"
                      min="0"
                      max="1"
                      step="0.05"
                      value={watch('ai_confidence_threshold')}
                      onChange={(e) => setValue('ai_confidence_threshold', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum confidence required before auto-applying this field.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
