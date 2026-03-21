'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
  placeholder?: string;
  disabled?: boolean;
}

export function PersonCombobox({
  value,
  onValueChange,
  onPersonSelect,
  placeholder = 'Search people...',
  disabled = false,
}: PersonComboboxProps) {
  const params = useParams();
  const projectSlug = params?.slug as string;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [people, setPeople] = React.useState<PersonResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<PersonResult | null>(null);

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
  React.useEffect(() => {
    if (value && !selectedPerson && projectSlug) {
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
    }
  }, [value, selectedPerson, projectSlug]);

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

  const displayName = selectedPerson
    ? [selectedPerson.first_name, selectedPerson.last_name].filter(Boolean).join(' ') || selectedPerson.email || 'Unknown'
    : null;

  return (
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
            ) : people.length === 0 ? (
              <CommandEmpty>No people found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {people.map((person) => {
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
