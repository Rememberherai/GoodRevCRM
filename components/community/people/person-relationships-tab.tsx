'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Network, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface RelationshipRecord {
  id: string;
  type: string;
  notes: string | null;
  person_a_id: string;
  person_b_id: string;
  person_a?: { id: string; first_name: string | null; last_name: string | null } | null;
  person_b?: { id: string; first_name: string | null; last_name: string | null } | null;
}

interface OptionRecord {
  id: string;
  name: string;
}

export function PersonRelationshipsTab({ personId }: { personId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [people, setPeople] = useState<OptionRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [otherPersonId, setOtherPersonId] = useState('none');
  const [type, setType] = useState('neighbor');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadRelationships = useCallback(async () => {
    const [relationshipsResponse, peopleResponse] = await Promise.all([
      fetch(`/api/projects/${slug}/relationships?person_id=${personId}`),
      fetch(`/api/projects/${slug}/people?limit=100`),
    ]);
    const [relationshipsData, peopleData] = await Promise.all([
      relationshipsResponse.json(),
      peopleResponse.json(),
    ]);

    setRelationships((relationshipsData.relationships ?? []) as RelationshipRecord[]);
    setPeople(((peopleData.people ?? []) as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).filter((person) => person.id !== personId).map((person) => ({
      id: person.id,
      name: [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed person',
    })));
  }, [personId, slug]);

  useEffect(() => {
    void loadRelationships();
  }, [loadRelationships]);

  async function handleCreate() {
    if (otherPersonId === 'none') return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_a_id: personId,
          person_b_id: otherPersonId,
          type,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create relationship');
      }
      setOpen(false);
      setOtherPersonId('none');
      setType('neighbor');
      setNotes('');
      await loadRelationships();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Relationships</CardTitle>
            <CardDescription>Track neighbors, mentors, caregivers, and other community ties.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Relationship
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {relationships.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No relationships recorded yet for this person.
            </div>
          ) : (
            relationships.map((relationship) => {
              const otherPerson = relationship.person_a_id === personId ? relationship.person_b : relationship.person_a;
              const name = [otherPerson?.first_name, otherPerson?.last_name].filter(Boolean).join(' ') || 'Unknown person';
              return (
                <div key={relationship.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-muted-foreground">{relationship.notes || 'No notes yet'}</div>
                  </div>
                  <Badge variant="secondary">{relationship.type.replace(/_/g, ' ')}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Influence Snapshot
          </CardTitle>
          <CardDescription>This tab also feeds community-level influencer analysis and isolation detection.</CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
            <DialogDescription>Create a new social connection for this community member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Other Person</Label>
              <Select value={otherPersonId} onValueChange={setOtherPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select person</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['neighbor', 'family', 'mentor_mentee', 'friend', 'caregiver', 'colleague', 'service_provider_client', 'other'].map((option) => (
                    <SelectItem key={option} value={option}>{option.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || otherPersonId === 'none'}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
