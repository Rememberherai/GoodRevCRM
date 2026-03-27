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

interface MemberResult {
  user_id: string;
  role: string;
  user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface MemberComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MemberCombobox({
  value,
  onValueChange,
  placeholder = 'Select a team member...',
  disabled = false,
}: MemberComboboxProps) {
  const params = useParams();
  const projectSlug = params?.slug as string;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [members, setMembers] = React.useState<MemberResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);

  React.useEffect(() => {
    if (!open || !projectSlug) return;

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', '50');
        if (search) {
          searchParams.set('search', search);
        }

        const response = await fetch(
          `/api/projects/${projectSlug}/members?${searchParams.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchMembers, search ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [open, search, projectSlug]);

  // Fetch selected member details when value is set externally
  const [fetchedValueId, setFetchedValueId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (value && !selectedMember && projectSlug && fetchedValueId !== value) {
      setFetchedValueId(value);
      const fetchSelected = async () => {
        try {
          const response = await fetch(
            `/api/projects/${projectSlug}/members?limit=100`
          );
          if (response.ok) {
            const data = await response.json();
            const match = (data.members || []).find(
              (m: MemberResult) => m.user_id === value
            );
            if (match) setSelectedMember(match);
          }
        } catch (error) {
          console.error('Failed to fetch selected member:', error);
        }
      };
      fetchSelected();
    } else if (!value) {
      setSelectedMember(null);
      setFetchedValueId(null);
    }
  }, [value, selectedMember, projectSlug, fetchedValueId]);

  const handleSelect = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    if (member) {
      setSelectedMember(member);
      onValueChange(userId);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMember(null);
    onValueChange(null);
  };

  const displayName = selectedMember
    ? selectedMember.user.full_name || selectedMember.user.email
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
            {selectedMember && (
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
            ) : members.length === 0 ? (
              <CommandEmpty>No team members found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {members.map((member) => (
                  <CommandItem
                    key={member.user_id}
                    value={member.user_id}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === member.user_id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{member.user.full_name || 'No name'}</span>
                      <span className="text-xs text-muted-foreground">
                        {member.user.email} · {member.role}
                      </span>
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
