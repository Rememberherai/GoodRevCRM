'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown, Building2, X } from 'lucide-react';
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
import type { Organization } from '@/types/organization';

interface OrganizationComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OrganizationCombobox({
  value,
  onValueChange,
  placeholder = 'Select organization...',
  disabled = false,
}: OrganizationComboboxProps) {
  const params = useParams();
  const projectSlug = params?.slug as string;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedOrg, setSelectedOrg] = React.useState<Organization | null>(null);

  // Fetch organizations when popover opens or search changes
  React.useEffect(() => {
    if (!open || !projectSlug) return;

    const fetchOrgs = async () => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', '50');
        if (search) {
          searchParams.set('search', search);
        }

        const response = await fetch(
          `/api/projects/${projectSlug}/organizations?${searchParams.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchOrgs, search ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [open, search, projectSlug]);

  // Fetch selected organization details if we have a value but no selectedOrg
  React.useEffect(() => {
    if (value && !selectedOrg && projectSlug) {
      const fetchSelectedOrg = async () => {
        try {
          const response = await fetch(
            `/api/projects/${projectSlug}/organizations/${value}`
          );
          if (response.ok) {
            const data = await response.json();
            setSelectedOrg(data.organization || data);
          }
        } catch (error) {
          console.error('Failed to fetch selected organization:', error);
        }
      };
      fetchSelectedOrg();
    } else if (!value) {
      setSelectedOrg(null);
    }
  }, [value, selectedOrg, projectSlug]);

  const handleSelect = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setSelectedOrg(org);
      onValueChange(orgId);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrg(null);
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
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedOrg ? (
              <span className="truncate">{selectedOrg.name}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {selectedOrg && (
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
            placeholder="Search organizations..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : organizations.length === 0 ? (
              <CommandEmpty>No organizations found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {organizations.map((org) => (
                  <CommandItem
                    key={org.id}
                    value={org.id}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === org.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{org.name}</span>
                      {org.industry && (
                        <span className="text-xs text-muted-foreground">
                          {org.industry}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
