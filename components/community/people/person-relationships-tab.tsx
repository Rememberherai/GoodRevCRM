'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Network, Plus, Users, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PersonCombobox } from '@/components/ui/person-combobox';

interface RelationshipRecord {
  id: string;
  type: string;
  notes: string | null;
  person_a_id: string;
  person_b_id: string;
  person_a?: { id: string; first_name: string | null; last_name: string | null } | null;
  person_b?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export function PersonRelationshipsTab({ personId }: { personId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [otherPersonId, setOtherPersonId] = useState<string | null>(null);
  const [type, setType] = useState('neighbor');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadRelationships = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/relationships?person_id=${personId}`);
      if (!response.ok) return;
      const data = await response.json();
      setRelationships((data.relationships ?? []) as RelationshipRecord[]);
    } catch {
      // non-critical initial load
    }
  }, [personId, slug]);

  useEffect(() => {
    void loadRelationships();
  }, [loadRelationships]);

  async function handleCreate() {
    if (!otherPersonId) return;
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
      setOtherPersonId(null);
      setType('neighbor');
      setNotes('');
      await loadRelationships();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create relationship');
    } finally {
      setIsSaving(false);
    }
  }

  // Compute influence snapshot from loaded relationships
  const totalConnections = relationships.length;
  const bridgingTypes = new Set(['neighbor', 'service_provider_client', 'mentor_mentee']);
  const bridgingCount = relationships.filter((r) => bridgingTypes.has(r.type)).length;
  const typeCounts = relationships.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  const excludeIds = useMemo(() => new Set([personId]), [personId]);

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
          <CardDescription>Community connection summary for influencer analysis and isolation detection.</CardDescription>
        </CardHeader>
        <CardContent>
          {totalConnections === 0 ? (
            <p className="text-sm text-muted-foreground">Add relationships above to see this person&apos;s influence snapshot.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase">Connections</span>
                  </div>
                  <div className="text-2xl font-bold">{totalConnections}</div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <GitBranch className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase">Bridging</span>
                  </div>
                  <div className="text-2xl font-bold">{bridgingCount}</div>
                  <div className="text-xs text-muted-foreground">neighbor, mentor, provider</div>
                </div>
              </div>
              {Object.keys(typeCounts).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(typeCounts).map(([relType, count]) => (
                    <Badge key={relType} variant="outline">
                      {relType.replace(/_/g, ' ')} ({count})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
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
              <PersonCombobox
                value={otherPersonId}
                onValueChange={setOtherPersonId}
                placeholder="Search people..."
                excludeIds={excludeIds}
              />
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
            <Button onClick={handleCreate} disabled={isSaving || !otherPersonId}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
