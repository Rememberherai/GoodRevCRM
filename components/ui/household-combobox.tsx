'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown, Home, X } from 'lucide-react';
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

interface HouseholdResult {
  id: string;
  name: string;
  address_city: string | null;
  address_state: string | null;
}

interface HouseholdComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function HouseholdCombobox({
  value,
  onValueChange,
  placeholder = 'Search households...',
  disabled = false,
}: HouseholdComboboxProps) {
  const params = useParams();
  const projectSlug = params?.slug as string;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [households, setHouseholds] = React.useState<HouseholdResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedHousehold, setSelectedHousehold] = React.useState<HouseholdResult | null>(null);

  React.useEffect(() => {
    if (!open || !projectSlug) return;

    const fetchHouseholds = async () => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', '30');
        if (search) {
          searchParams.set('search', search);
        }

        const response = await fetch(
          `/api/projects/${projectSlug}/households?${searchParams.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setHouseholds(data.households || []);
        }
      } catch (error) {
        console.error('Failed to fetch households:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchHouseholds, search ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [open, search, projectSlug]);

  // Fetch selected household details if we have a value but no selectedHousehold
  React.useEffect(() => {
    if (value && !selectedHousehold && projectSlug) {
      const fetchSelected = async () => {
        try {
          const response = await fetch(
            `/api/projects/${projectSlug}/households/${value}`
          );
          if (response.ok) {
            const data = await response.json();
            setSelectedHousehold(data.household || data);
          }
        } catch (error) {
          console.error('Failed to fetch selected household:', error);
        }
      };
      fetchSelected();
    } else if (!value) {
      setSelectedHousehold(null);
    }
  }, [value, selectedHousehold, projectSlug]);

  const handleSelect = (householdId: string) => {
    const household = households.find((h) => h.id === householdId);
    if (household) {
      setSelectedHousehold(household);
      onValueChange(householdId);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHousehold(null);
    onValueChange(null);
  };

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
            <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedHousehold ? (
              <span className="truncate">{selectedHousehold.name}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {selectedHousehold && (
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
            placeholder="Search by name or location..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : households.length === 0 ? (
              <CommandEmpty>No households found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {households.map((household) => {
                  const location = [household.address_city, household.address_state].filter(Boolean).join(', ');
                  return (
                    <CommandItem
                      key={household.id}
                      value={household.id}
                      onSelect={handleSelect}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === household.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{household.name}</span>
                        {location && (
                          <span className="text-xs text-muted-foreground">{location}</span>
                        )}
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
