'use client';

import { useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FilterValueEditor, formatFilterValue } from './filter-value-editor';
import type { FilterCondition, FilterDefinition } from '@/types/filters';

interface AdvancedFilterBarProps {
  filterDefinitions: FilterDefinition[];
  activeFilters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
}

export function AdvancedFilterBar({
  filterDefinitions,
  activeFilters,
  onFiltersChange,
}: AdvancedFilterBarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);

  // Fields already active (prevent duplicate filters on same field)
  const activeFields = new Set(activeFilters.map((f) => f.field));

  // Group available definitions
  const groups = new Map<string, FilterDefinition[]>();
  for (const def of filterDefinitions) {
    if (activeFields.has(def.field)) continue;
    const group = def.group ?? 'Other';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(def);
  }

  function addFilter(def: FilterDefinition) {
    const newFilter: FilterCondition = {
      id: `${def.field}-${Date.now()}`,
      field: def.field,
      operator: def.category === 'date' ? 'between' : def.category === 'boolean' ? 'eq' : def.category === 'select' ? 'in' : 'ilike',
      value: undefined as unknown,
    };
    onFiltersChange([...activeFilters, newFilter]);
    setAddOpen(false);
    setEditingFilterId(newFilter.id);
  }

  function updateFilter(updated: FilterCondition) {
    onFiltersChange(activeFilters.map((f) => (f.id === updated.id ? updated : f)));
  }

  function removeFilter(id: string) {
    onFiltersChange(activeFilters.filter((f) => f.id !== id));
    if (editingFilterId === id) setEditingFilterId(null);
  }

  function clearAll() {
    onFiltersChange([]);
    setEditingFilterId(null);
  }

  if (activeFilters.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-3.5 w-3.5" />
              Add filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <AddFilterMenu groups={groups} onSelect={addFilter} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {activeFilters.map((filter) => {
        const def = filterDefinitions.find((d) => d.field === filter.field);
        if (!def) return null;

        const hasValue = filter.value !== undefined && filter.value !== null &&
          !(Array.isArray(filter.value) && filter.value.length === 0);

        return (
          <Popover
            key={filter.id}
            open={editingFilterId === filter.id}
            onOpenChange={(open) => setEditingFilterId(open ? filter.id : null)}
          >
            <PopoverTrigger asChild>
              <Badge
                variant={hasValue ? 'default' : 'outline'}
                className="cursor-pointer gap-1 pr-1 font-normal"
              >
                <span className="text-xs">
                  {def.label}
                  {hasValue && (
                    <>
                      {': '}
                      <span className="font-medium">{formatFilterValue(def, filter)}</span>
                    </>
                  )}
                </span>
                <button
                  className="ml-1 rounded-full p-0.5 hover:bg-background/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFilter(filter.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <FilterValueEditor
                definition={def}
                filter={filter}
                onChange={updateFilter}
                onDone={() => setEditingFilterId(null)}
              />
            </PopoverContent>
          </Popover>
        );
      })}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <AddFilterMenu groups={groups} onSelect={addFilter} />
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" onClick={clearAll}>
        Clear all
      </Button>
    </div>
  );
}

function AddFilterMenu({
  groups,
  onSelect,
}: {
  groups: Map<string, FilterDefinition[]>;
  onSelect: (def: FilterDefinition) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Filter by..." />
      <CommandList>
        <CommandEmpty>No filters available.</CommandEmpty>
        {Array.from(groups.entries()).map(([group, defs]) => (
          <CommandGroup key={group} heading={group}>
            {defs.map((def) => (
              <CommandItem key={def.field} onSelect={() => onSelect(def)}>
                {def.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}
