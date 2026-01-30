'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomFields } from '@/hooks/use-custom-fields';
import {
  createCustomFieldDefinitionSchema,
  type CreateCustomFieldDefinitionInput,
} from '@/lib/validators/custom-field';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_DESCRIPTIONS,
  ENTITY_TYPE_LABELS,
  type EntityType,
  type FieldType,
} from '@/types/custom-field';

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
}

interface FormData {
  name: string;
  label: string;
  description: string;
  field_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_visible_in_list: boolean;
  display_order: number;
  group_name: string;
  options: { value: string; label: string }[];
  // AI extraction settings
  is_ai_extractable: boolean;
  ai_extraction_hint: string;
  ai_confidence_threshold: number;
}

export function AddFieldDialog({ open, onOpenChange, entityType }: AddFieldDialogProps) {
  const { create, isLoading } = useCustomFields();
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>('text');
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
      name: '',
      label: '',
      description: '',
      field_type: 'text',
      is_required: false,
      is_unique: false,
      is_searchable: false,
      is_filterable: false,
      is_visible_in_list: true,
      display_order: 0,
      group_name: '',
      options: [],
      // AI extraction defaults
      is_ai_extractable: true,
      ai_extraction_hint: '',
      ai_confidence_threshold: 0.7,
    },
  });

  const { fields: optionFields, append, remove } = useFieldArray({
    control,
    name: 'options',
  });

  const currentFieldType = watch('field_type');
  const needsOptions = currentFieldType === 'select' || currentFieldType === 'multi_select';

  const onSubmit = async (formData: FormData) => {
    setFormError(null);

    // Build the data for validation
    const data: CreateCustomFieldDefinitionInput = {
      name: formData.name,
      label: formData.label,
      description: formData.description || null,
      entity_type: entityType,
      field_type: formData.field_type,
      is_required: formData.is_required,
      is_unique: formData.is_unique,
      is_searchable: formData.is_searchable,
      is_filterable: formData.is_filterable,
      is_visible_in_list: formData.is_visible_in_list,
      display_order: formData.display_order,
      group_name: formData.group_name || null,
      options: formData.options.filter(o => o.value && o.label),
      default_value: null,
      validation_rules: undefined,
      // AI extraction settings
      is_ai_extractable: formData.is_ai_extractable,
      ai_extraction_hint: formData.ai_extraction_hint || null,
      ai_confidence_threshold: formData.ai_confidence_threshold,
    };

    // Validate with Zod
    const result = createCustomFieldDefinitionSchema.safeParse(data);
    if (!result.success) {
      const firstError = result.error.issues[0];
      setFormError(firstError?.message ?? 'Validation failed');
      return;
    }

    try {
      await create(result.data);
      reset();
      setSelectedFieldType('text');
      onOpenChange(false);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    reset();
    setSelectedFieldType('text');
    setFormError(null);
    onOpenChange(false);
  };

  const handleFieldTypeChange = (value: string) => {
    const fieldType = value as FieldType;
    setSelectedFieldType(fieldType);
    setValue('field_type', fieldType);
    // Clear options when switching away from select types
    if (fieldType !== 'select' && fieldType !== 'multi_select') {
      setValue('options', []);
    }
  };

  const generateFieldName = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^[0-9]/, '_$&')
      .slice(0, 50);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Field</DialogTitle>
          <DialogDescription>
            Create a new custom field for {ENTITY_TYPE_LABELS[entityType]}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {formError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="label">
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="label"
                  {...register('label', {
                    required: 'Label is required',
                    onChange: (e) => {
                      const name = generateFieldName(e.target.value);
                      setValue('name', name);
                    },
                  })}
                  placeholder="e.g. Contract Type"
                />
                {errors.label && (
                  <p className="text-sm text-destructive">{errors.label.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Field Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Field name is required' })}
                  placeholder="e.g. contract_type"
                  className="font-mono"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Must be lowercase with underscores (snake_case)
                </p>
              </div>
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
              <Label htmlFor="field_type">
                Field Type <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedFieldType} onValueChange={handleFieldTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col">
                        <span>{FIELD_TYPE_LABELS[type]}</span>
                        <span className="text-xs text-muted-foreground">
                          {FIELD_TYPE_DESCRIPTIONS[type]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_name">Group Name</Label>
              <Input
                id="group_name"
                {...register('group_name')}
                placeholder="e.g. Contract Details"
              />
              <p className="text-xs text-muted-foreground">
                Optional group to organize fields together
              </p>
            </div>
          </div>

          {/* Options for select/multi_select */}
          {needsOptions && (
            <div className="space-y-4">
              <Label>Options</Label>
              <div className="space-y-2">
                {optionFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
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
              {isLoading ? 'Creating...' : 'Create Field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
