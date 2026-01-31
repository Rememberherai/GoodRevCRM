'use client';

import { Star } from 'lucide-react';
import type { CustomFieldDefinition } from '@/types/custom-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface CustomFieldsRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function CustomFieldsRenderer({
  fields,
  values,
  onChange,
  errors,
}: CustomFieldsRendererProps) {
  if (fields.length === 0) {
    return null;
  }

  const renderField = (field: CustomFieldDefinition) => {
    const value = values[field.name];
    const options = (field.options as SelectOption[] | null) ?? [];

    const handleChange = (newValue: unknown) => {
      onChange(field.name, newValue);
    };

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            id={field.name}
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={field.name}
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id={field.name}
              type="number"
              className="pl-7"
              value={value !== null && value !== undefined ? String(value) : ''}
              onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
        );

      case 'percentage':
        return (
          <div className="relative">
            <Input
              id={field.name}
              type="number"
              className="pr-8"
              value={value !== null && value !== undefined ? String(value) : ''}
              onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              min={0}
              max={100}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
        );

      case 'date':
        return (
          <Input
            id={field.name}
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value || null)}
          />
        );

      case 'datetime':
        return (
          <Input
            id={field.name}
            type="datetime-local"
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value || null)}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleChange(checked)}
            />
            <Label htmlFor={field.name} className="text-sm font-normal">
              {field.description || 'Yes'}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={(value as string) ?? ''}
            onValueChange={(val) => handleChange(val || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select': {
        const selectedValues = (value as string[]) ?? [];
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer hover:bg-muted"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleChange([...selectedValues, option.value]);
                    } else {
                      handleChange(selectedValues.filter((v) => v !== option.value));
                    }
                  }}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'rating': {
        const ratingValue = (value as number) ?? 0;
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleChange(star === ratingValue ? 0 : star)}
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <Star
                  className={`h-5 w-5 ${
                    star <= ratingValue
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>
        );
      }

      case 'user':
        return (
          <Input
            id={field.name}
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="User ID"
          />
        );

      default:
        return (
          <Input
            id={field.name}
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => handleChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          {field.field_type !== 'boolean' && (
            <Label htmlFor={field.name}>
              {field.label}
              {field.is_required && <span className="text-destructive"> *</span>}
            </Label>
          )}
          {field.field_type === 'boolean' ? (
            renderField(field)
          ) : (
            <>
              {renderField(field)}
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </>
          )}
          {errors?.[field.name] && (
            <p className="text-sm text-destructive">{errors[field.name]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
