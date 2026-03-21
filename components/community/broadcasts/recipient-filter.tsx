'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Search } from 'lucide-react';

interface OptionRecord {
  id: string;
  label: string;
}

interface RecipientFilterValue {
  person_ids?: string[];
  household_ids?: string[];
  program_ids?: string[];
}

export function RecipientFilter({
  value,
  onChange,
}: {
  value: RecipientFilterValue;
  onChange: (value: RecipientFilterValue) => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [people, setPeople] = useState<OptionRecord[]>([]);
  const [households, setHouseholds] = useState<OptionRecord[]>([]);
  const [programs, setPrograms] = useState<OptionRecord[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      const [peopleResponse, householdsResponse, programsResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/people?limit=500`),
        fetch(`/api/projects/${slug}/households?limit=500`),
        fetch(`/api/projects/${slug}/programs?limit=500`),
      ]);
      const [peopleData, householdsData, programsData] = await Promise.all([
        peopleResponse.json(),
        householdsResponse.json(),
        programsResponse.json(),
      ]);

      setPeople(((peopleData.people ?? []) as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map((person) => ({
        id: person.id,
        label: [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed person',
      })));
      setHouseholds(((householdsData.households ?? []) as Array<{ id: string; name: string }>).map((household) => ({
        id: household.id,
        label: household.name,
      })));
      setPrograms(((programsData.programs ?? []) as Array<{ id: string; name: string }>).map((program) => ({
        id: program.id,
        label: program.name,
      })));
    };

    void loadOptions();
  }, [slug]);

  function toggle(key: keyof RecipientFilterValue, id: string, checked: boolean) {
    const current = value[key] ?? [];
    const next = checked ? [...current, id] : current.filter((item) => item !== id);
    onChange({ ...value, [key]: next });
  }

  function selectAll(key: keyof RecipientFilterValue, filteredOptions: OptionRecord[]) {
    const ids = filteredOptions.map((o) => o.id);
    const current = new Set(value[key] ?? []);
    for (const id of ids) current.add(id);
    onChange({ ...value, [key]: Array.from(current) });
  }

  function deselectAll(key: keyof RecipientFilterValue) {
    onChange({ ...value, [key]: [] });
  }

  function removeOne(key: keyof RecipientFilterValue, id: string) {
    const current = value[key] ?? [];
    onChange({ ...value, [key]: current.filter((item) => item !== id) });
  }

  const groups = [
    { title: 'People', key: 'person_ids' as const, options: people },
    { title: 'Households', key: 'household_ids' as const, options: households },
    { title: 'Programs', key: 'program_ids' as const, options: programs },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {groups.map((group) => (
        <FilterColumn
          key={group.title}
          title={group.title}
          options={group.options}
          selectedIds={value[group.key] ?? []}
          onToggle={(id, checked) => toggle(group.key, id, checked)}
          onSelectAll={(filtered) => selectAll(group.key, filtered)}
          onDeselectAll={() => deselectAll(group.key)}
          onRemoveOne={(id) => removeOne(group.key, id)}
        />
      ))}
    </div>
  );
}

function FilterColumn({
  title,
  options,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onRemoveOne,
}: {
  title: string;
  options: OptionRecord[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: (filtered: OptionRecord[]) => void;
  onDeselectAll: () => void;
  onRemoveOne: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selectedCount = selectedIds.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.includes(o.id));

  // Build a lookup for selected labels
  const selectedOptions = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds]
  );

  return (
    <div className="rounded-lg border p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount} selected
          </Badge>
        )}
      </div>

      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
          {selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs"
            >
              <span className="max-w-[100px] truncate">{opt.label}</span>
              <button
                type="button"
                onClick={() => onRemoveOne(opt.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>

      {/* Select all / Deselect all */}
      <div className="flex items-center gap-2 mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onSelectAll(filtered)}
          disabled={allFilteredSelected || filtered.length === 0}
        >
          Select all{search.trim() ? ' filtered' : ''}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onDeselectAll}
          disabled={selectedCount === 0}
        >
          Deselect all
        </Button>
      </div>

      {/* Scrollable list */}
      <div className="space-y-1 max-h-48 overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            {options.length === 0 ? 'No options yet' : 'No matches'}
          </div>
        ) : (
          filtered.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox checked={checked} onCheckedChange={(next) => onToggle(option.id, Boolean(next))} />
                <span className="font-normal truncate text-xs">{option.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
