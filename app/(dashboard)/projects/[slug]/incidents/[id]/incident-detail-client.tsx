'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { MemberCombobox } from '@/components/ui/member-combobox';
import { PersonCombobox } from '@/components/ui/person-combobox';

interface IncidentDetailResponse {
  incident: {
    id: string;
    summary: string;
    details: string | null;
    status: string;
    severity: string;
    category: string;
    visibility: string;
    occurred_at: string;
    follow_up_due_at: string | null;
    resolution_notes: string | null;
    household_id: string | null;
    assigned_to: string | null;
    assignee?: { id: string; full_name: string | null; email: string } | null;
  };
  people: Array<{
    id: string;
    role: string;
    notes: string | null;
    person?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  }>;
  notes: Array<{
    id: string;
    content: string;
    created_at: string;
    author?: { full_name: string | null } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  }>;
}

export function IncidentDetailClient() {
  const params = useParams();
  const slug = params.slug as string;
  const incidentId = params.id as string;
  const [data, setData] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPersonId, setNewPersonId] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('subject');
  const [newNote, setNewNote] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadIncident = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/incidents/${incidentId}`);
      const payload = await response.json() as IncidentDetailResponse | { error: string };
      if (!response.ok || !('incident' in payload)) {
        throw new Error('error' in payload ? payload.error : 'Failed to load incident');
      }
      setData(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  }, [incidentId, slug]);

  useEffect(() => {
    void loadIncident();
  }, [loadIncident]);

  async function handleUpdate(updates: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update incident');
      }
      await loadIncident(false);
      window.dispatchEvent(new Event('incident-queue-updated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update incident');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPerson() {
    if (!newPersonId.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/incidents/${incidentId}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: newPersonId.trim(),
          role: newPersonRole,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to link person');
      }
      setNewPersonId('');
      await loadIncident(false);
      toast.success('Person linked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to link person');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/incidents/${incidentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          category: 'incident_follow_up',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to add note');
      }
      setNewNote('');
      await loadIncident(false);
      toast.success('Note added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading incident
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Incident not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/incidents`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Incidents
        </Link>
      </Button>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{data.incident.summary}</h2>
        <div className="text-sm text-muted-foreground">
          {new Date(data.incident.occurred_at).toLocaleString()}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                Update incident state, severity, follow-up, and resolution.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <MemberCombobox
                    value={data.incident.assigned_to}
                    onValueChange={(value) => void handleUpdate({ assigned_to: value })}
                    placeholder="Assign this incident..."
                    disabled={saving}
                  />
                  <div className="text-xs text-muted-foreground">
                    Assigning an incident marks who owns next steps and removes it from the unassigned alert badge.
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={data.incident.status} onValueChange={(value) => void handleUpdate({ status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={data.incident.severity} onValueChange={(value) => void handleUpdate({ severity: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={data.incident.category} onValueChange={(value) => void handleUpdate({ category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="behavior">Behavior</SelectItem>
                      <SelectItem value="facility">Facility</SelectItem>
                      <SelectItem value="injury">Injury</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="conflict">Conflict</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={data.incident.visibility} onValueChange={(value) => void handleUpdate({ visibility: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="case_management">Case Management</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow_up_due_at">Follow-Up Due</Label>
                  <Input
                    id="follow_up_due_at"
                    type="datetime-local"
                    key={`incident-follow-up-${data.incident.follow_up_due_at ?? 'none'}`}
                    defaultValue={data.incident.follow_up_due_at ? data.incident.follow_up_due_at.slice(0, 16) : ''}
                    onBlur={(event) => {
                      const value = event.target.value;
                      void handleUpdate({
                        follow_up_due_at: value ? new Date(value).toISOString() : null,
                      });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="details">Details</Label>
                  <Textarea
                    id="details"
                    key={`incident-details-${data.incident.details ?? ''}`}
                    rows={7}
                    defaultValue={data.incident.details ?? ''}
                    onBlur={(event) => void handleUpdate({ details: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolution_notes">Resolution Notes</Label>
                  <Textarea
                    id="resolution_notes"
                    key={`incident-resolution-${data.incident.resolution_notes ?? ''}`}
                    rows={5}
                    defaultValue={data.incident.resolution_notes ?? ''}
                    onBlur={(event) => void handleUpdate({ resolution_notes: event.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
              <CardDescription>
                Link involved people by role without leaving the incident.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <PersonCombobox
                  value={newPersonId || null}
                  onValueChange={(value) => setNewPersonId(value ?? '')}
                  placeholder="Search people..."
                  disabled={saving}
                  allowCreate
                  excludeIds={new Set(data.people.map((person) => person.person?.id).filter(Boolean) as string[])}
                />
                <Select value={newPersonRole} onValueChange={setNewPersonRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="reporter">Reporter</SelectItem>
                    <SelectItem value="witness">Witness</SelectItem>
                    <SelectItem value="guardian_notified">Guardian Notified</SelectItem>
                    <SelectItem value="staff_present">Staff Present</SelectItem>
                    <SelectItem value="victim">Victim</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddPerson} disabled={saving || !newPersonId.trim()}>
                  Add Person
                </Button>
              </div>

              {data.people.length ? (
                <div className="space-y-3">
                  {data.people.map((person) => (
                    <div key={person.id} className="rounded-lg border p-3">
                      <div className="font-medium">
                        {[person.person?.first_name, person.person?.last_name].filter(Boolean).join(' ') || person.person?.email || 'Unknown person'}
                      </div>
                      <div className="text-sm text-muted-foreground">{person.role}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No people linked yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Structured follow-up notes stay attached to the incident.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={4}
                value={newNote}
                onChange={(event) => setNewNote(event.target.value)}
                placeholder="Add a note"
              />
              <Button onClick={handleAddNote} disabled={saving || !newNote.trim()}>
                Add Note
              </Button>

              {data.notes.length ? (
                <div className="space-y-3">
                  {data.notes.map((note) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <div className="text-sm">{note.content}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {note.author?.full_name ?? 'Unknown'} • {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No notes yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>
                  Linked tasks inherit incident visibility.
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateTask(true)}>Create Task</Button>
            </CardHeader>
            <CardContent>
              {data.tasks.length ? (
                <div className="space-y-2">
                  {data.tasks.map((task) => (
                    <div key={task.id} className="rounded-lg border p-3">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.status} • {task.priority}{task.due_date ? ` • due ${new Date(task.due_date).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No tasks linked yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectSlug={slug}
        householdId={data.incident.household_id ?? undefined}
        incidentId={data.incident.id}
        defaultTitle="Incident follow-up"
        onSuccess={() => void loadIncident(false)}
      />
    </div>
  );
}
