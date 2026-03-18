'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  List,
  Link2,
  DollarSign,
  Percent,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { ReportableField, ReportableObject, ReportColumn, ReportAggregation, AggregationFunction } from '@/lib/reports/types';

interface FieldSelectorProps {
  primaryObject: ReportableObject;
  allObjects: Record<string, ReportableObject>;
  selectedColumns: ReportColumn[];
  onToggleColumn: (column: ReportColumn) => void;
  aggregations?: ReportAggregation[];
  onSetFieldAggregation?: (objectName: string, fieldName: string, fn: AggregationFunction) => void;
  onRemoveFieldAggregation?: (objectName: string, fieldName: string) => void;
}

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  number: Hash,
  currency: DollarSign,
  percentage: Percent,
  date: Calendar,
  datetime: Calendar,
  boolean: ToggleLeft,
  enum: List,
  uuid: Link2,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'text-gray-500',
  number: 'text-blue-500',
  currency: 'text-green-500',
  percentage: 'text-orange-500',
  date: 'text-purple-500',
  datetime: 'text-purple-500',
  boolean: 'text-yellow-500',
  enum: 'text-pink-500',
  uuid: 'text-gray-400',
};

function isColumnSelected(
  columns: ReportColumn[],
  objectName: string,
  fieldName: string
): boolean {
  return columns.some(
    (c) => c.objectName === objectName && c.fieldName === fieldName
  );
}

const AGG_OPTIONS: { value: AggregationFunction; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

function FieldRow({
  field,
  objectName: _objectName,
  isSelected,
  onToggle,
  currentAggregation,
  onSetAggregation,
  onRemoveAggregation,
}: {
  field: ReportableField;
  objectName: string;
  isSelected: boolean;
  onToggle: () => void;
  currentAggregation?: AggregationFunction;
  onSetAggregation?: (fn: AggregationFunction) => void;
  onRemoveAggregation?: () => void;
}) {
  const Icon = FIELD_TYPE_ICONS[field.type] ?? Type;
  const iconColor = FIELD_TYPE_COLORS[field.type] ?? 'text-gray-500';

  // Don't show ID fields by default (they're filterable but not useful in reports)
  if (field.name === 'id') return null;

  return (
    <div
      className={`flex items-center gap-3 w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted/50'
      }`}
    >
      <button className="flex items-center gap-3 flex-1 min-w-0" onClick={onToggle}>
        <Checkbox checked={isSelected} className="pointer-events-none" />
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="flex-1 truncate">{field.label}</span>
      </button>
      {field.isCustomField && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          Custom
        </Badge>
      )}
      {isSelected && field.aggregatable && onSetAggregation && (
        <select
          className="h-6 text-[11px] rounded border bg-background px-1.5 shrink-0"
          value={currentAggregation ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              onRemoveAggregation?.();
            } else {
              onSetAggregation(val as AggregationFunction);
            }
          }}
        >
          <option value="">No agg</option>
          {AGG_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {!isSelected && field.aggregatable && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          Agg
        </Badge>
      )}
    </div>
  );
}

function ObjectFieldGroup({
  object,
  objectName,
  selectedColumns,
  onToggleColumn,
  isRelated,
  aggregations,
  onSetFieldAggregation,
  onRemoveFieldAggregation,
}: {
  object: ReportableObject;
  objectName: string;
  selectedColumns: ReportColumn[];
  onToggleColumn: (column: ReportColumn) => void;
  isRelated: boolean;
  aggregations?: ReportAggregation[];
  onSetFieldAggregation?: (objectName: string, fieldName: string, fn: AggregationFunction) => void;
  onRemoveFieldAggregation?: (objectName: string, fieldName: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(!isRelated);
  const selectedCount = selectedColumns.filter(
    (c) => c.objectName === objectName
  ).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="flex-1">
          {isRelated ? (
            <>
              <span className="text-muted-foreground">Related: </span>
              {object.labelPlural}
            </>
          ) : (
            object.labelPlural
          )}
        </span>
        {selectedCount > 0 && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            {selectedCount}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="p-1 space-y-0.5 max-h-[300px] overflow-y-auto">
          {object.fields
            .filter((f) => f.name !== 'id' && f.name !== 'project_id' && f.name !== 'deleted_at')
            .map((field) => {
              const currentAgg = aggregations?.find(
                (a) => a.objectName === objectName && a.fieldName === field.name
              );
              return (
                <FieldRow
                  key={`${objectName}.${field.name}`}
                  field={field}
                  objectName={objectName}
                  isSelected={isColumnSelected(selectedColumns, objectName, field.name)}
                  onToggle={() =>
                    onToggleColumn({
                      objectName,
                      fieldName: field.name,
                    })
                  }
                  currentAggregation={currentAgg?.function}
                  onSetAggregation={
                    onSetFieldAggregation
                      ? (fn) => onSetFieldAggregation(objectName, field.name, fn)
                      : undefined
                  }
                  onRemoveAggregation={
                    onRemoveFieldAggregation
                      ? () => onRemoveFieldAggregation(objectName, field.name)
                      : undefined
                  }
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

export function FieldSelector({
  primaryObject,
  allObjects,
  selectedColumns,
  onToggleColumn,
  aggregations,
  onSetFieldAggregation,
  onRemoveFieldAggregation,
}: FieldSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Select Fields</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which fields to include in your report. Expand related objects to pull in their fields.
        </p>
        {selectedColumns.length > 0 && (
          <p className="text-sm text-primary mt-1 font-medium">
            {selectedColumns.length} field{selectedColumns.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      <div className="space-y-3">
        {/* Primary object fields */}
        <ObjectFieldGroup
          object={primaryObject}
          objectName={primaryObject.name}
          selectedColumns={selectedColumns}
          onToggleColumn={onToggleColumn}
          isRelated={false}
          aggregations={aggregations}
          onSetFieldAggregation={onSetFieldAggregation}
          onRemoveFieldAggregation={onRemoveFieldAggregation}
        />

        {/* Related object fields */}
        {primaryObject.relations
          .filter((rel) => rel.type === 'belongs_to' && allObjects[rel.targetObject])
          .map((rel) => (
            <ObjectFieldGroup
              key={rel.targetObject}
              object={allObjects[rel.targetObject]!}
              objectName={rel.targetObject}
              selectedColumns={selectedColumns}
              onToggleColumn={onToggleColumn}
              isRelated={true}
              aggregations={aggregations}
              onSetFieldAggregation={onSetFieldAggregation}
              onRemoveFieldAggregation={onRemoveFieldAggregation}
            />
          ))}
      </div>
    </div>
  );
}
