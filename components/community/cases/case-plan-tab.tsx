'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';

interface ActiveCaseSummary {
  id: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  opened_at: string;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  summary: string | null;
}

interface CasePlanTabProps {
  projectSlug: string;
  householdId: string;
  activeCase: ActiveCaseSummary | null;
  onCaseChanged?: () => void;
}

interface CaseDetailResponse {
  case: ActiveCaseSummary & {
    barriers: string | null;
    strengths: string | null;
    consent_notes: string | null;
    closed_reason: string | null;
    household?: { id: string; name: string } | null;
  };
  goals: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    target_date: string | null;
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

export function CasePlanTab({ projectSlug, householdId, activeCase, onCaseChanged }: CasePlanTabProps) {
  const [currentCase, setCurrentCase] = useState<ActiveCaseSummary | null>(activeCase);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const [newCaseSummary, setNewCaseSummary] = useState('');
  const [newCasePriority, setNewCasePriority] = useState('medium');
  const [newCaseFollowUp, setNewCaseFollowUp] = useState('');

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newNote, setNewNote] = useState('');

  const loadCase = useCallback(async (caseId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases/${caseId}`);
      const data = await response.json() as CaseDetailResponse | { error: string };
      if (!response.ok || !('case' in data)) {
        throw new Error('error' in data ? data.error : 'Failed to load case');
      }
      setCaseDetail(data);
      setCurrentCase(data.case);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load case');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    setCurrentCase(activeCase);
    if (activeCase?.id) {
      void loadCase(activeCase.id);
    } else {
      setCaseDetail(null);
    }
  }, [activeCase, loadCase]);

  const followUpValue = useMemo(() => {
    if (!currentCase?.next_follow_up_at) return '';
    return currentCase.next_follow_up_at.slice(0, 16);
  }, [currentCase?.next_follow_up_at]);

  async function handleCreateCase() {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: householdId,
          priority: newCasePriority,
          summary: newCaseSummary || undefined,
          next_follow_up_at: newCaseFollowUp ? new Date(newCaseFollowUp).toISOString() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create case');
      }

      const nextCase = data.case as ActiveCaseSummary | undefined;
      if (!nextCase) {
        throw new Error('Case created without data');
      }

      setCurrentCase(nextCase);
      setNewCaseSummary('');
      setNewCasePriority('medium');
      setNewCaseFollowUp('');
      await loadCase(nextCase.id);
      onCaseChanged?.();
      toast.success('Case opened');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create case');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCase(updates: Record<string, unknown>) {
    if (!currentCase) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases/${currentCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update case');
      }
      await loadCase(currentCase.id);
      onCaseChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update case');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddGoal() {
    if (!currentCase || !newGoalTitle.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases/${currentCase.id}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGoalTitle.trim(),
          target_date: newGoalTarget || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add goal');
      }
      setNewGoalTitle('');
      setNewGoalTarget('');
      await loadCase(currentCase.id);
      toast.success('Goal added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add goal');
    } finally {
      setSaving(false);
    }
  }

  async function handleGoalStatus(goalId: string, status: string) {
    if (!currentCase) return;
    await handleUpdateGoal(goalId, { status });
  }

  async function handleUpdateGoal(goalId: string, updates: Record<string, unknown>) {
    if (!currentCase) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases/${currentCase.id}/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update goal');
      }
      await loadCase(currentCase.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update goal');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!currentCase || !newNote.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/cases/${currentCase.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          category: 'case_follow_up',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add note');
      }
      setNewNote('');
      await loadCase(currentCase.id);
      toast.success('Note added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  if (!currentCase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open a Case</CardTitle>
          <CardDescription>
            Create the household&apos;s active case file to start goals, follow-up, and case notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="case-summary">Summary</Label>
            <Textarea
              id="case-summary"
              rows={4}
              value={newCaseSummary}
              onChange={(event) => setNewCaseSummary(event.target.value)}
              placeholder="What is this household working on right now?"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newCasePriority} onValueChange={setNewCasePriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-follow-up">Next Follow-Up</Label>
              <Input
                id="next-follow-up"
                type="datetime-local"
                value={newCaseFollowUp}
                onChange={(event) => setNewCaseFollowUp(event.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCreateCase} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Open Case
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Case Overview</CardTitle>
          <CardDescription>
            Manage status, follow-up cadence, and the household&apos;s active plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{currentCase.status}</Badge>
              <Badge variant="outline">{currentCase.priority}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Opened {new Date(currentCase.opened_at).toLocaleString()}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={currentCase.status} onValueChange={(value) => void handleUpdateCase({ status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={currentCase.priority} onValueChange={(value) => void handleUpdateCase({ priority: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-follow-up">Next Follow-Up</Label>
              <Input
                id="case-follow-up"
                type="datetime-local"
                key={`follow-up-${followUpValue}`}
                defaultValue={followUpValue}
                onBlur={(event) => {
                  const value = event.target.value;
                  void handleUpdateCase({
                    next_follow_up_at: value ? new Date(value).toISOString() : null,
                  });
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void handleUpdateCase({ last_contact_at: new Date().toISOString() })} disabled={saving}>
                Record Contact
              </Button>
              <Button variant="outline" onClick={() => setShowCreateTask(true)}>
                Create Task
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="case-summary-edit">Summary</Label>
              <Textarea
                id="case-summary-edit"
                key={`summary-${caseDetail?.case.summary ?? currentCase.summary ?? ''}`}
                rows={5}
                defaultValue={caseDetail?.case.summary ?? currentCase.summary ?? ''}
                onBlur={(event) => void handleUpdateCase({ summary: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-barriers">Barriers</Label>
              <Textarea
                id="case-barriers"
                key={`barriers-${caseDetail?.case.barriers ?? ''}`}
                rows={3}
                defaultValue={caseDetail?.case.barriers ?? ''}
                onBlur={(event) => void handleUpdateCase({ barriers: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-strengths">Strengths</Label>
              <Textarea
                id="case-strengths"
                key={`strengths-${caseDetail?.case.strengths ?? ''}`}
                rows={3}
                defaultValue={caseDetail?.case.strengths ?? ''}
                onBlur={(event) => void handleUpdateCase({ strengths: event.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goals</CardTitle>
            <CardDescription>
              Track concrete outcomes and mark completion as they happen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input
                value={newGoalTitle}
                onChange={(event) => setNewGoalTitle(event.target.value)}
                placeholder="New goal"
              />
              <Input
                type="date"
                value={newGoalTarget}
                onChange={(event) => setNewGoalTarget(event.target.value)}
              />
              <Button onClick={handleAddGoal} disabled={saving || !newGoalTitle.trim()}>
                Add Goal
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading goals
              </div>
            ) : caseDetail?.goals.length ? (
              <div className="space-y-3">
                {caseDetail.goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{goal.title}</div>
                        {goal.description ? <div className="text-sm text-muted-foreground">{goal.description}</div> : null}
                        {goal.target_date ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Target {new Date(goal.target_date).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                      <Select value={goal.status} onValueChange={(value) => void handleGoalStatus(goal.id, value)}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No goals yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case Notes</CardTitle>
            <CardDescription>
              Capture follow-up notes without leaving the household record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={4}
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="Add a follow-up note"
            />
            <Button onClick={handleAddNote} disabled={saving || !newNote.trim()}>
              Add Note
            </Button>

            {caseDetail?.notes.length ? (
              <div className="space-y-3">
                {caseDetail.notes.map((note) => (
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
                No case notes yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {caseDetail?.tasks.length ? (
            <div className="space-y-2">
              {caseDetail.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.status} • {task.priority}{task.due_date ? ` • due ${new Date(task.due_date).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No tasks linked to this case yet.
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectSlug={projectSlug}
        householdId={householdId}
        caseId={currentCase.id}
        defaultTitle="Case follow-up"
        onSuccess={() => {
          if (currentCase.id) {
            void loadCase(currentCase.id);
          }
        }}
      />
    </div>
  );
}
