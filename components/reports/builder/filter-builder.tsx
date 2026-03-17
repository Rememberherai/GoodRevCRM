'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ReportFilter,
  FilterOperator,
  ReportableObject,
  ReportableField,
} from '@/lib/reports/types';

interface FilterBuilderProps {
  primaryObject: ReportableObject;
  allObjects: Record<string, ReportableObject>;
  filters: ReportFilter[];
  onAddFilter: (filter: ReportFilter) => void;
  onRemoveFilter: (index: number) => void;
  onUpdateFilter: (index: number, filter: ReportFilter) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: 'greater than',
  gte: 'greater or equal',
  lt: 'less than',
  lte: 'less or equal',
  like: 'contains',
  ilike: 'contains (case-insensitive)',
  in: 'is one of',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  between: 'between',
};

function getOperatorsForType(type: string): FilterOperator[] {
  switch (type) {
    case 'text':
      return ['eq', 'neq', 'ilike', 'like', 'is_null', 'is_not_null'];
    case 'number':
    case 'currency':
    case 'percentage':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'];
    case 'date':
    case 'datetime':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'];
    case 'boolean':
      return ['eq', 'is_null', 'is_not_null'];
    case 'enum':
      return ['eq', 'neq', 'in', 'is_null', 'is_not_null'];
    case 'uuid':
      return ['eq', 'neq', 'is_null', 'is_not_null'];
    default:
      return ['eq', 'neq', 'is_null', 'is_not_null'];
  }
}

function getAvailableFields(
  primaryObject: ReportableObject,
  allObjects: Record<string, ReportableObject>
): { objectName: string; field: ReportableField; label: string }[] {
  const fields: { objectName: string; field: ReportableField; label: string }[] = [];

  for (const f of primaryObject.fields) {
    if (!f.filterable || f.name === 'id' || f.name === 'project_id' || f.name === 'deleted_at') continue;
    fields.push({
      objectName: primaryObject.name,
      field: f,
      label: f.label,
    });
  }

  for (const rel of primaryObject.relations) {
    if (rel.type !== 'belongs_to') continue;
    const relObj = allObjects[rel.targetObject];
    if (!relObj) continue;
    for (const f of relObj.fields) {
      if (!f.filterable || f.name === 'id' || f.name === 'project_id' || f.name === 'deleted_at') continue;
      fields.push({
        objectName: rel.targetObject,
        field: f,
        label: `${relObj.label} > ${f.label}`,
      });
    }
  }

  return fields;
}

function FilterRow({
  filter,
  index: _index,
  availableFields,
  onUpdate,
  onRemove,
}: {
  filter: ReportFilter;
  index: number;
  availableFields: { objectName: string; field: ReportableField; label: string }[];
  onUpdate: (filter: ReportFilter) => void;
  onRemove: () => void;
}) {
  const selectedFieldEntry = availableFields.find(
    (f) => f.objectName === filter.objectName && f.field.name === filter.fieldName
  );
  const fieldType = selectedFieldEntry?.field.type ?? 'text';
  const operators = getOperatorsForType(fieldType);
  const needsValue = filter.operator !== 'is_null' && filter.operator !== 'is_not_null';
  const needsSecondValue = filter.operator === 'between';

  return (
    <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
      <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-start">
        {/* Field select */}
        <Select
          value={`${filter.objectName}::${filter.fieldName}`}
          onValueChange={(val) => {
            const [obj, field] = val.split('::');
            onUpdate({ ...filter, objectName: obj ?? '', fieldName: field ?? '', value: undefined, value2: undefined });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((f) => (
              <SelectItem
                key={`${f.objectName}::${f.field.name}`}
                value={`${f.objectName}::${f.field.name}`}
              >
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator select */}
        <Select
          value={filter.operator}
          onValueChange={(op) => onUpdate({ ...filter, operator: op as FilterOperator })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        {needsValue && (
          <div className="flex gap-2">
            {selectedFieldEntry?.field.enumValues ? (
              <Select
                value={(filter.value as string) ?? ''}
                onValueChange={(val) => onUpdate({ ...filter, value: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  {selectedFieldEntry.field.enumValues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fieldType === 'boolean' ? (
              <Select
                value={String(filter.value ?? '')}
                onValueChange={(val) => onUpdate({ ...filter, value: val === 'true' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={fieldType === 'date' ? 'date' : fieldType === 'datetime' ? 'datetime-local' : fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage' ? 'number' : 'text'}
                value={String(filter.value ?? '')}
                onChange={(e) => {
                  const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
                  onUpdate({ ...filter, value: val });
                }}
                placeholder="Value"
                className="w-full"
              />
            )}
            {needsSecondValue && (
              <Input
                type={fieldType === 'date' ? 'date' : fieldType === 'datetime' ? 'datetime-local' : fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage' ? 'number' : 'text'}
                value={String(filter.value2 ?? '')}
                onChange={(e) => {
                  const val = (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage') ? Number(e.target.value) : e.target.value;
                  onUpdate({ ...filter, value2: val });
                }}
                placeholder="End value"
                className="w-full"
              />
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FilterBuilder({
  primaryObject,
  allObjects,
  filters,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
}: FilterBuilderProps) {
  const availableFields = React.useMemo(
    () => getAvailableFields(primaryObject, allObjects),
    [primaryObject, allObjects]
  );

  const handleAdd = () => {
    const firstField = availableFields[0];
    if (!firstField) return;
    onAddFilter({
      objectName: firstField.objectName,
      fieldName: firstField.field.name,
      operator: 'eq',
      value: '',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Add Filters</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Narrow down your data with conditions. All filters are combined with AND logic.
        </p>
      </div>

      {filters.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">
            No filters applied. Your report will include all records.
          </p>
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Filter
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, i) => (
            <FilterRow
              key={i}
              filter={filter}
              index={i}
              availableFields={availableFields}
              onUpdate={(f) => onUpdateFilter(i, f)}
              onRemove={() => onRemoveFilter(i)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Filter
          </Button>
        </div>
      )}
    </div>
  );
}
