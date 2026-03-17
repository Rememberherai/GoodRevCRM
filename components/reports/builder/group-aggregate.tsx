'use client';

import * as React from 'react';
import { Plus, Trash2, Layers, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ReportableObject,
  ReportableField,
  ReportAggregation,
  AggregationFunction,
} from '@/lib/reports/types';

interface GroupAggregateProps {
  primaryObject: ReportableObject;
  allObjects: Record<string, ReportableObject>;
  groupBy: string[];
  aggregations: ReportAggregation[];
  onAddGroupBy: (field: string) => void;
  onRemoveGroupBy: (field: string) => void;
  onAddAggregation: (agg: ReportAggregation) => void;
  onRemoveAggregation: (index: number) => void;
  onUpdateAggregation: (index: number, agg: ReportAggregation) => void;
}

const AGG_LABELS: Record<AggregationFunction, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Minimum',
  max: 'Maximum',
  count_distinct: 'Count Distinct',
};

function getGroupableFields(obj: ReportableObject): ReportableField[] {
  return obj.fields.filter(
    (f) => f.groupable && f.name !== 'id' && f.name !== 'project_id' && f.name !== 'deleted_at'
  );
}

function getAggregatableFields(
  primaryObject: ReportableObject,
  allObjects: Record<string, ReportableObject>
): { objectName: string; field: ReportableField; label: string }[] {
  const fields: { objectName: string; field: ReportableField; label: string }[] = [];

  // All fields on primary can be counted; only aggregatable ones can SUM/AVG
  for (const f of primaryObject.fields) {
    if (f.name === 'id' || f.name === 'project_id' || f.name === 'deleted_at') continue;
    fields.push({ objectName: primaryObject.name, field: f, label: f.label });
  }

  for (const rel of primaryObject.relations) {
    if (rel.type !== 'belongs_to') continue;
    const relObj = allObjects[rel.targetObject];
    if (!relObj) continue;
    for (const f of relObj.fields) {
      if (f.name === 'id' || f.name === 'project_id' || f.name === 'deleted_at') continue;
      if (!f.aggregatable) continue;
      fields.push({
        objectName: rel.targetObject,
        field: f,
        label: `${relObj.label} > ${f.label}`,
      });
    }
  }

  return fields;
}

function getAvailableAggFunctions(field: ReportableField): AggregationFunction[] {
  if (field.aggregatable) {
    return ['sum', 'avg', 'count', 'min', 'max', 'count_distinct'];
  }
  return ['count', 'count_distinct'];
}

export function GroupAggregate({
  primaryObject,
  allObjects,
  groupBy,
  aggregations,
  onAddGroupBy,
  onRemoveGroupBy,
  onAddAggregation,
  onRemoveAggregation,
  onUpdateAggregation,
}: GroupAggregateProps) {
  const groupableFields = React.useMemo(
    () => getGroupableFields(primaryObject),
    [primaryObject]
  );

  const aggregatableFields = React.useMemo(
    () => getAggregatableFields(primaryObject, allObjects),
    [primaryObject, allObjects]
  );

  const handleAddAggregation = () => {
    const firstField = aggregatableFields[0];
    if (!firstField) return;
    const funcs = getAvailableAggFunctions(firstField.field);
    onAddAggregation({
      objectName: firstField.objectName,
      fieldName: firstField.field.name,
      function: funcs[0] ?? 'count',
      alias: `${funcs[0] ?? 'count'}_${firstField.field.name}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Group By Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Group By</h3>
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Group rows by one or more fields to see aggregated summaries.
        </p>

        <div className="flex flex-wrap gap-2">
          {groupBy.map((field) => {
            const fieldDef = groupableFields.find((f) => f.name === field);
            return (
              <Badge
                key={field}
                variant="secondary"
                className="text-sm px-3 py-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => onRemoveGroupBy(field)}
              >
                {fieldDef?.label ?? field}
                <span className="ml-1.5 text-xs">&times;</span>
              </Badge>
            );
          })}
        </div>

        <Select
          value=""
          onValueChange={(val) => {
            if (val) onAddGroupBy(val);
          }}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Add group-by field..." />
          </SelectTrigger>
          <SelectContent>
            {groupableFields
              .filter((f) => !groupBy.includes(f.name))
              .map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aggregations Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Aggregations</h3>
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Add summary calculations like SUM, AVG, COUNT on numeric fields.
        </p>

        {aggregations.length > 0 && (
          <div className="space-y-2">
            {aggregations.map((agg, i) => {
              const fieldEntry = aggregatableFields.find(
                (f) => f.objectName === agg.objectName && f.field.name === agg.fieldName
              );
              const availableFuncs = fieldEntry
                ? getAvailableAggFunctions(fieldEntry.field)
                : (['count'] as AggregationFunction[]);

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                >
                  {/* Function */}
                  <Select
                    value={agg.function}
                    onValueChange={(func) =>
                      onUpdateAggregation(i, {
                        ...agg,
                        function: func as AggregationFunction,
                        alias: `${func}_${agg.fieldName}`,
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFuncs.map((func) => (
                        <SelectItem key={func} value={func}>
                          {AGG_LABELS[func]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-sm text-muted-foreground">of</span>

                  {/* Field */}
                  <Select
                    value={`${agg.objectName}::${agg.fieldName}`}
                    onValueChange={(val) => {
                      const [obj, field] = val.split('::');
                      onUpdateAggregation(i, {
                        ...agg,
                        objectName: obj ?? '',
                        fieldName: field ?? '',
                        alias: `${agg.function}_${field ?? ''}`,
                      });
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aggregatableFields.map((f) => (
                        <SelectItem
                          key={`${f.objectName}::${f.field.name}`}
                          value={`${f.objectName}::${f.field.name}`}
                        >
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-sm text-muted-foreground">as</span>

                  {/* Alias */}
                  <Input
                    value={agg.alias}
                    onChange={(e) =>
                      onUpdateAggregation(i, {
                        ...agg,
                        alias: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
                      })
                    }
                    className="w-[150px]"
                    placeholder="alias"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveAggregation(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={handleAddAggregation}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Aggregation
        </Button>
      </div>
    </div>
  );
}
