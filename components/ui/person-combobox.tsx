'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown, Plus, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { QuickCreatePersonDialog, type QuickCreatedPerson } from '@/components/people/quick-create-person-dialog';

interface PersonResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organization?: { name: string } | null;
}

interface PersonComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  onPersonSelect?: (person: PersonResult | null) => void;
  onPersonCreated?: (person: QuickCreatedPerson) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  excludeIds?: Set<string>;
}

export function PersonCombobox({
  value,
  onValueChange,
  onPersonSelect,
  onPersonCreated,
  placeholder = 'Search people...',
  disabled = false,
  allowCreate = false,
  excludeIds,
}: PersonComboboxProps) {
  const params = useParams();
  const projectSlug = params?.slug as string;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [people, setPeople] = React.useState<PersonResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<PersonResult | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || !projectSlug) return;

    const fetchPeople = async () => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', '30');
        if (search) {
          searchParams.set('search', search);
        }

        const response = await fetch(
          `/api/projects/${projectSlug}/people?${searchParams.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setPeople(data.people || []);
        }
      } catch (error) {
        console.error('Failed to fetch people:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchPeople, search ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [open, search, projectSlug]);

  // Fetch selected person details if we have a value but no selectedPerson
  const [fetchedValueId, setFetchedValueId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (value && !selectedPerson && projectSlug && fetchedValueId !== value) {
      setFetchedValueId(value);
      const fetchSelectedPerson = async () => {
        try {
          const response = await fetch(
            `/api/projects/${projectSlug}/people/${value}`
          );
          if (response.ok) {
            const data = await response.json();
            setSelectedPerson(data.person || data);
          }
        } catch (error) {
          console.error('Failed to fetch selected person:', error);
        }
      };
      fetchSelectedPerson();
    } else if (!value) {
      setSelectedPerson(null);
      setFetchedValueId(null);
    }
  }, [value, selectedPerson, projectSlug, fetchedValueId]);

  const filteredPeople = excludeIds
    ? people.filter((p) => !excludeIds.has(p.id))
    : people;

  const handleSelect = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (person) {
      setSelectedPerson(person);
      onValueChange(personId);
      onPersonSelect?.(person);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPerson(null);
    onValueChange(null);
    onPersonSelect?.(null);
  };

  const handleQuickCreate = () => {
    setOpen(false);
    setQuickCreateOpen(true);
  };

  const handlePersonCreated = (person: QuickCreatedPerson) => {
    const personResult: PersonResult = {
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email,
    };
    setPeople((prev) => [personResult, ...prev]);
    setSelectedPerson(personResult);
    onValueChange(person.id);
    onPersonSelect?.(personResult);
    onPersonCreated?.(person);
  };

  const displayName = selectedPerson
    ? [selectedPerson.first_name, selectedPerson.last_name].filter(Boolean).join(' ') || selectedPerson.email || 'Unknown'
    : null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              {displayName ? (
                <span className="truncate">{displayName}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              {selectedPerson && (
                <X
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or email..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredPeople.length === 0 && !allowCreate ? (
                <CommandEmpty>No people found.</CommandEmpty>
              ) : (
                <>
                  {filteredPeople.length === 0 ? (
                    <CommandEmpty>No people found.</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {filteredPeople.map((person) => {
                        const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
                        return (
                          <CommandItem
                            key={person.id}
                            value={person.id}
                            onSelect={handleSelect}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                value === person.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{name || 'No name'}</span>
                              <span className="text-xs text-muted-foreground">
                                {person.email}
                                {person.organization?.name ? ` · ${person.organization.name}` : ''}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                  {allowCreate && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem onSelect={handleQuickCreate}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create new person
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowCreate && (
        <QuickCreatePersonDialog
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          onCreated={handlePersonCreated}
        />
      )}
    </>
  );
}
