'use client';

import * as React from 'react';
import { ArrowUpDown, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ReportOrderBy,
  ReportColumn,
  ReportAggregation,
} from '@/lib/reports/types';

interface OrderByConfigProps {
  orderBy: ReportOrderBy[];
  columns: ReportColumn[];
  groupBy: string[];
  aggregations: ReportAggregation[];
  onOrderByChange: (orderBy: ReportOrderBy[]) => void;
}

const MAX_ORDER_BY = 5;

export function OrderByConfig({
  orderBy,
  columns,
  groupBy,
  aggregations,
  onOrderByChange,
}: OrderByConfigProps) {
  // Available fields depend on report type:
  // - Grouped: groupBy fields + aggregation aliases
  // - Tabular: column fieldNames
  const availableFields = React.useMemo(() => {
    if (groupBy.length > 0) {
      const fields: { value: string; label: string }[] = [];
      for (const gb of groupBy) {
        fields.push({
          value: gb,
          label: gb.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
      for (const agg of aggregations) {
        fields.push({
          value: agg.alias,
          label: `${agg.function.toUpperCase()}(${agg.fieldName.replace(/_/g, ' ')})`,
        });
      }
      return fields;
    }

    // Tabular: use column fieldNames (primary object only for simplicity)
    const seen = new Set<string>();
    const fields: { value: string; label: string }[] = [];
    for (const col of columns) {
      const key = col.fieldName;
      if (!seen.has(key)) {
        seen.add(key);
        fields.push({
          value: key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
    }
    return fields;
  }, [groupBy, aggregations, columns]);

  const handleAdd = () => {
    if (orderBy.length >= MAX_ORDER_BY) return;
    const usedFields = new Set(orderBy.map((o) => o.field));
    const firstAvailable = availableFields.find((f) => !usedFields.has(f.value));
    if (!firstAvailable) return;
    onOrderByChange([...orderBy, { field: firstAvailable.value, direction: 'desc' }]);
  };

  const handleRemove = (index: number) => {
    onOrderByChange(orderBy.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: string) => {
    const updated = [...orderBy];
    updated[index] = { ...updated[index]!, field };
    onOrderByChange(updated);
  };

  const handleDirectionToggle = (index: number) => {
    const updated = [...orderBy];
    const current = updated[index]!;
    updated[index] = { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    onOrderByChange(updated);
  };

  if (availableFields.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sort Order</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleAdd}
          disabled={orderBy.length >= MAX_ORDER_BY || orderBy.length >= availableFields.length}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Sort
        </Button>
      </div>

      {orderBy.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No custom sorting. Results use default order.
        </p>
      )}

      {orderBy.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={item.field} onValueChange={(v) => handleFieldChange(i, v)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleDirectionToggle(i)}
            title={item.direction === 'asc' ? 'Ascending' : 'Descending'}
          >
            {item.direction === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
