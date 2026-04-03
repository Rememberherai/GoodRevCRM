'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { FilterDefinition, DateRangeValue, FilterCondition } from '@/types/filters';
import type { DateRange as RDPDateRange } from 'react-day-picker';
import { subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterValueEditorProps {
  definition: FilterDefinition;
  filter: FilterCondition;
  onChange: (filter: FilterCondition) => void;
  onDone: () => void;
}

export function FilterValueEditor({ definition, filter, onChange, onDone }: FilterValueEditorProps) {
  switch (definition.category) {
    case 'date':
      return (
        <DateFilterEditor
          filter={filter}
          onChange={onChange}
          onDone={onDone}
        />
      );
    case 'boolean':
      return (
        <BooleanFilterEditor
          filter={filter}
          onChange={onChange}
          onDone={onDone}
        />
      );
    case 'select':
      return (
        <SelectFilterEditor
          definition={definition}
          filter={filter}
          onChange={onChange}
          onDone={onDone}
        />
      );
    case 'text':
      return (
        <TextFilterEditor
          filter={filter}
          onChange={onChange}
          onDone={onDone}
        />
      );
    default:
      return null;
  }
}

function DateFilterEditor({
  filter,
  onChange,
  onDone,
}: {
  filter: FilterCondition;
  onChange: (f: FilterCondition) => void;
  onDone: () => void;
}) {
  const value = filter.value as DateRangeValue | undefined;
  const calendarValue: RDPDateRange | undefined = value
    ? { from: new Date(value.from), to: new Date(value.to) }
    : undefined;

  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const presets = [
    { label: '7 days', from: subDays(endOfToday, 6), to: endOfToday },
    { label: '30 days', from: subDays(endOfToday, 29), to: endOfToday },
    { label: 'This Month', from: startOfMonth(today), to: endOfToday },
    { label: 'Last Month', from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) },
    { label: 'This Quarter', from: startOfQuarter(today), to: endOfToday },
    { label: 'YTD', from: startOfYear(today), to: endOfToday },
  ];

  function handleSelect(range: RDPDateRange | undefined) {
    if (range?.from && range?.to) {
      onChange({
        ...filter,
        operator: 'between',
        value: { from: range.from.toISOString(), to: range.to.toISOString() },
      });
      onDone();
    }
  }

  function handlePreset(preset: { from: Date; to: Date }) {
    onChange({
      ...filter,
      operator: 'between',
      value: { from: preset.from.toISOString(), to: preset.to.toISOString() },
    });
    onDone();
  }

  return (
    <div className="flex">
      <div className="flex flex-col gap-1 border-r p-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            className="justify-start text-xs"
            onClick={() => handlePreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="p-2">
        <Calendar
          mode="range"
          selected={calendarValue}
          onSelect={handleSelect}
          numberOfMonths={2}
          defaultMonth={subMonths(new Date(), 1)}
          disabled={{ after: new Date() }}
        />
      </div>
    </div>
  );
}

function BooleanFilterEditor({
  filter,
  onChange,
  onDone,
}: {
  filter: FilterCondition;
  onChange: (f: FilterCondition) => void;
  onDone: () => void;
}) {
  function handleClick(val: boolean) {
    onChange({ ...filter, operator: 'eq', value: val });
    onDone();
  }

  return (
    <div className="flex gap-2 p-3">
      <Button
        size="sm"
        variant={filter.value === true ? 'default' : 'outline'}
        onClick={() => handleClick(true)}
      >
        Yes
      </Button>
      <Button
        size="sm"
        variant={filter.value === false ? 'default' : 'outline'}
        onClick={() => handleClick(false)}
      >
        No
      </Button>
    </div>
  );
}

function SelectFilterEditor({
  definition,
  filter,
  onChange,
  onDone,
}: {
  definition: FilterDefinition;
  filter: FilterCondition;
  onChange: (f: FilterCondition) => void;
  onDone: () => void;
}) {
  const selected = (filter.value as string[] | undefined) ?? [];
  const options = definition.options ?? [];

  function toggle(val: string) {
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    onChange({ ...filter, operator: 'in', value: next });
  }

  return (
    <div className="w-[220px]">
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem key={opt.value} onSelect={() => toggle(opt.value)}>
                <div className={cn(
                  'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                  selected.includes(opt.value) ? 'bg-primary text-primary-foreground' : 'opacity-50'
                )}>
                  {selected.includes(opt.value) && <Check className="h-3 w-3" />}
                </div>
                {opt.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {selected.length > 0 && (
        <div className="border-t p-2">
          <Button size="sm" className="w-full" onClick={onDone}>
            Apply ({selected.length} selected)
          </Button>
        </div>
      )}
    </div>
  );
}

function TextFilterEditor({
  filter,
  onChange,
  onDone,
}: {
  filter: FilterCondition;
  onChange: (f: FilterCondition) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState((filter.value as string) ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim()) {
      onChange({ ...filter, operator: 'ilike', value: text.trim() });
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3">
      <Input
        autoFocus
        placeholder="Type to filter..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-8"
      />
      <Button type="submit" size="sm" disabled={!text.trim()}>
        Apply
      </Button>
    </form>
  );
}

export function formatFilterValue(definition: FilterDefinition, filter: FilterCondition): string {
  switch (definition.category) {
    case 'date': {
      const val = filter.value as DateRangeValue | undefined;
      if (!val) return 'any';
      return `${format(new Date(val.from), 'MMM d')} – ${format(new Date(val.to), 'MMM d')}`;
    }
    case 'boolean':
      return filter.value === true ? 'Yes' : filter.value === false ? 'No' : 'any';
    case 'select': {
      const vals = (filter.value as string[] | undefined) ?? [];
      if (vals.length === 0) return 'any';
      const options = definition.options ?? [];
      const labels = vals.map((v) => options.find((o) => o.value === v)?.label ?? v);
      if (labels.length <= 2) return labels.join(', ');
      return `${labels[0]} +${labels.length - 1}`;
    }
    case 'text':
      return (filter.value as string) || 'any';
    default:
      return String(filter.value ?? 'any');
  }
}
