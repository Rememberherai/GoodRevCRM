'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PersonOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface MemberRecord {
  id: string;
  person_id: string;
  relationship: string;
  is_primary_contact: boolean;
  start_date: string;
  end_date: string | null;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const RELATIONSHIP_OPTIONS = [
  'head_of_household',
  'spouse_partner',
  'child',
  'dependent',
  'extended_family',
  'other',
] as const;

export function HouseholdMembersTab({
  householdId,
  initialMembers,
  onRefresh,
}: {
  householdId: string;
  initialMembers: MemberRecord[];
  onRefresh: () => Promise<void>;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [relationship, setRelationship] = useState<typeof RELATIONSHIP_OPTIONS[number]>('other');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/people?limit=100`);
        const data = await response.json() as { people?: PersonOption[] };
        if (active && response.ok) {
          setPeople(data.people ?? []);
        }
      } catch (error) {
        console.error('Failed to load people for household members tab:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const memberIds = useMemo(() => new Set(initialMembers.map((member) => member.person_id)), [initialMembers]);
  const availablePeople = people.filter((person) => !memberIds.has(person.id));

  const addMember = async () => {
    if (!selectedPersonId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/households/${householdId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: selectedPersonId,
          relationship,
          start_date: startDate,
          is_primary_contact: initialMembers.length === 0,
        }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add household member');
      }

      toast.success('Household member added');
      setSelectedPersonId('');
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add household member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMember = async (personId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/households/${householdId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to remove household member');
      }

      toast.success('Household member removed');
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove household member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Manage people linked to this household and track primary contacts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.8fr_1.2fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {availablePeople.length === 0 ? (
                  <SelectItem value="none" disabled>No people available</SelectItem>
                ) : availablePeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {[person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || person.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={(value: typeof RELATIONSHIP_OPTIONS[number]) => setRelationship(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>

          <Button type="button" onClick={addMember} disabled={!selectedPersonId || isSubmitting}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {initialMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No household members yet.
          </div>
        ) : (
          <div className="space-y-3">
            {initialMembers.map((member) => {
              const fullName = [
                member.person?.first_name,
                member.person?.last_name,
              ].filter(Boolean).join(' ') || member.person?.email || member.person_id;

              return (
                <div key={member.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">{fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.relationship.replaceAll('_', ' ')}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {member.is_primary_contact && <Badge variant="secondary">Primary Contact</Badge>}
                      <Badge variant="outline">Since {member.start_date}</Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeMember(member.person_id)}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
