'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Mail, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Person {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface GmailConnection {
  id: string;
  email: string;
  status: string;
}

interface EnrollPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  sequenceId: string;
  onEnrolled?: (count: number) => void;
}

export function EnrollPeopleDialog({
  open,
  onOpenChange,
  projectSlug,
  sequenceId,
  onEnrolled,
}: EnrollPeopleDialogProps) {
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPeople();
      fetchGmailConnections();
    }
  }, [open, projectSlug]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (open) {
        fetchPeople();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const fetchPeople = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) {
        params.set('search', search);
      }
      const response = await fetch(
        `/api/projects/${projectSlug}/people?${params}`
      );
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people || []);
      }
    } catch (err) {
      console.error('Error fetching people:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGmailConnections = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/gmail`);
      if (response.ok) {
        const data = await response.json();
        const connected = (data.connections || []).filter(
          (c: GmailConnection) => c.status === 'connected'
        );
        setGmailConnections(connected);
        if (connected.length > 0 && !selectedConnection) {
          setSelectedConnection(connected[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching Gmail connections:', err);
    }
  };

  const togglePerson = (personId: string) => {
    setSelectedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPeople.size === people.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(people.map((p) => p.id)));
    }
  };

  const handleEnroll = async () => {
    if (selectedPeople.size === 0 || !selectedConnection) return;

    setIsEnrolling(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${sequenceId}/enrollments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_ids: Array.from(selectedPeople),
            gmail_connection_id: selectedConnection,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enroll people');
      }

      const data = await response.json();
      onEnrolled?.(data.count);
      onOpenChange(false);
      setSelectedPeople(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll people');
    } finally {
      setIsEnrolling(false);
    }
  };

  const getPersonName = (person: Person) => {
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
    return name || person.email || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll People in Sequence</DialogTitle>
          <DialogDescription>
            Select people to add to this email sequence. They will start
            receiving emails once enrolled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gmail Connection Selection */}
          <div className="space-y-2">
            <Label>Send from</Label>
            {gmailConnections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected Gmail accounts. Please connect a Gmail account
                first.
              </p>
            ) : (
              <Select
                value={selectedConnection}
                onValueChange={setSelectedConnection}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Gmail account" />
                </SelectTrigger>
                <SelectContent>
                  {gmailConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {conn.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* People Search and Selection */}
          <div className="space-y-2">
            <Label>Select people ({selectedPeople.size} selected)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[250px] rounded-md border">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : people.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {search ? 'No people found' : 'No people in this project'}
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {/* Select All */}
                  <div
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted cursor-pointer border-b mb-2"
                    onClick={toggleAll}
                  >
                    <Checkbox
                      checked={selectedPeople.size === people.length}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm font-medium">
                      {selectedPeople.size === people.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </span>
                  </div>

                  {/* People List */}
                  {people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted cursor-pointer"
                      onClick={() => togglePerson(person.id)}
                    >
                      <Checkbox
                        checked={selectedPeople.has(person.id)}
                        onCheckedChange={() => togglePerson(person.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getPersonName(person)}
                        </p>
                        {person.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {person.email}
                          </p>
                        )}
                      </div>
                      {selectedPeople.has(person.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={
              selectedPeople.size === 0 ||
              !selectedConnection ||
              isEnrolling
            }
          >
            {isEnrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>Enroll {selectedPeople.size} {selectedPeople.size === 1 ? 'Person' : 'People'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
