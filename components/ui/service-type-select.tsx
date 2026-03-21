'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  CommandSeparator,
} from '@/components/ui/command';
import { useServiceTypes } from '@/hooks/use-service-types';
import { SERVICE_TYPE_COLOR_MAP, type ServiceTypeColor } from '@/types/service-type';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ServiceTypeSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface ServiceTypeMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ServiceTypeDot({ color }: { color: string }) {
  const colors = SERVICE_TYPE_COLOR_MAP[color as ServiceTypeColor] ?? SERVICE_TYPE_COLOR_MAP.gray;
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors.bg} ${colors.border} border`} />
  );
}

export function ServiceTypeSelect({ value, onChange, placeholder = 'Select service type...', disabled }: ServiceTypeSelectProps) {
  const { serviceTypes, isLoading, create } = useServiceTypes();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeTypes = useMemo(() => serviceTypes.filter((st) => st.is_active), [serviceTypes]);
  const selected = useMemo(() => serviceTypes.find((st) => st.id === value), [serviceTypes, value]);

  const matchesExisting = useMemo(
    () => activeTypes.some((st) => st.name.toLowerCase() === search.trim().toLowerCase()),
    [activeTypes, search]
  );

  const handleCreateNew = async () => {
    if (!search.trim() || matchesExisting) return;
    setIsCreating(true);
    try {
      const newType = await create({ name: search.trim() });
      onChange(newType.id);
      setSearch('');
      setOpen(false);
      toast.success(`Created "${newType.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create service type');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <ServiceTypeDot color={selected.color} />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                  onClick={handleCreateNew}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create &quot;{search.trim()}&quot;
                </button>
              ) : (
                'No service types found.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {activeTypes
                .filter((st) => st.name.toLowerCase().includes(search.toLowerCase()))
                .map((st) => (
                  <CommandItem
                    key={st.id}
                    value={st.id}
                    onSelect={() => {
                      onChange(st.id === value ? null : st.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === st.id ? 'opacity-100' : 'opacity-0')} />
                    <ServiceTypeDot color={st.color} />
                    <span className="ml-2">{st.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            {search.trim() && !matchesExisting && activeTypes.filter((st) => st.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCreateNew} disabled={isCreating}>
                    {isCreating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ServiceTypeMultiSelect({ value, onChange, placeholder = 'Select service types...', disabled }: ServiceTypeMultiSelectProps) {
  const { serviceTypes, isLoading, create } = useServiceTypes();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeTypes = useMemo(() => serviceTypes.filter((st) => st.is_active), [serviceTypes]);
  const selectedTypes = useMemo(
    () => serviceTypes.filter((st) => value.includes(st.id)),
    [serviceTypes, value]
  );

  const matchesExisting = useMemo(
    () => activeTypes.some((st) => st.name.toLowerCase() === search.trim().toLowerCase()),
    [activeTypes, search]
  );

  const toggleType = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const handleCreateNew = async () => {
    if (!search.trim() || matchesExisting) return;
    setIsCreating(true);
    try {
      const newType = await create({ name: search.trim() });
      onChange([...value, newType.id]);
      setSearch('');
      toast.success(`Created "${newType.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create service type');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTypes.map((st) => {
            const colors = SERVICE_TYPE_COLOR_MAP[st.color as ServiceTypeColor] ?? SERVICE_TYPE_COLOR_MAP.gray;
            return (
              <span
                key={st.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {st.name}
                <button
                  type="button"
                  onClick={() => toggleType(st.id)}
                  className="ml-0.5 hover:opacity-75"
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled || isLoading}
          >
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? (
                  <button
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                    onClick={handleCreateNew}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create &quot;{search.trim()}&quot;
                  </button>
                ) : (
                  'No service types found.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {activeTypes
                  .filter((st) => st.name.toLowerCase().includes(search.toLowerCase()))
                  .map((st) => (
                    <CommandItem
                      key={st.id}
                      value={st.id}
                      onSelect={() => toggleType(st.id)}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value.includes(st.id) ? 'opacity-100' : 'opacity-0')} />
                      <ServiceTypeDot color={st.color} />
                      <span className="ml-2">{st.name}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
              {search.trim() && !matchesExisting && activeTypes.filter((st) => st.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNew} disabled={isCreating}>
                      {isCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Create &quot;{search.trim()}&quot;
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
