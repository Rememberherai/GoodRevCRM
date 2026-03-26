'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, CalendarRange, ShieldCheck, Trash2, Plus, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PersonCombobox } from '@/components/ui/person-combobox';
import { BatchAttendance } from '@/components/community/programs/batch-attendance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateWaiverTemplateDialog } from '@/components/community/programs/create-waiver-template-dialog';

interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  capacity: number | null;
  requires_waiver: boolean;
  location_name: string | null;
  start_date: string | null;
  end_date: string | null;
  schedule: { summary?: string } | null;
  enrollment_count: number;
  attendance_count: number;
}

interface EnrollmentRecord {
  id: string;
  person_id: string | null;
  household_id: string | null;
  status: string;
  waiver_status: string;
  enrolled_at: string;
  notes: string | null;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  household?: {
    id: string;
    name: string;
  } | null;
}

interface ProgramWaiverRecord {
  id: string;
  template_id: string;
  created_at: string;
  contract_templates: {
    id: string;
    name: string;
    file_name: string;
    description: string | null;
    category: string | null;
  } | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  category: string | null;
}

export function ProgramDetailClient({ programId }: { programId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSavingEnrollment, setIsSavingEnrollment] = useState(false);

  // Waiver management state
  const [programWaivers, setProgramWaivers] = useState<ProgramWaiverRecord[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isAddingWaiver, setIsAddingWaiver] = useState(false);
  const [showCreateWaiver, setShowCreateWaiver] = useState(false);

  // Linked events
  const [linkedEvents, setLinkedEvents] = useState<{ id: string; title: string; status: string; starts_at: string; timezone: string }[]>([]);

  const loadProgram = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [programResponse, enrollmentResponse, waiversResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/programs/${programId}`),
        fetch(`/api/projects/${slug}/programs/${programId}/enrollments`),
        fetch(`/api/projects/${slug}/programs/${programId}/waivers`),
      ]);

      const programData = await programResponse.json() as { program?: ProgramDetail; error?: string };
      const enrollmentData = await enrollmentResponse.json() as { enrollments?: EnrollmentRecord[]; error?: string };
      const waiversData = await waiversResponse.json() as { waivers?: ProgramWaiverRecord[]; error?: string };

      if (!programResponse.ok || !programData.program) {
        throw new Error(programData.error ?? 'Failed to load program');
      }
      if (!enrollmentResponse.ok) {
        throw new Error(enrollmentData.error ?? 'Failed to load enrollments');
      }

      setProgram(programData.program);
      setEnrollments(enrollmentData.enrollments ?? []);
      setProgramWaivers(waiversData.waivers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load program');
    } finally {
      setIsLoading(false);
    }
  }, [programId, slug]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/contracts/templates`);
      const data = await response.json() as { templates?: ContractTemplate[] };
      if (response.ok) {
        setAvailableTemplates(data.templates ?? []);
      }
    } catch {
      // Non-critical — user can still view waivers
    }
  }, [slug]);

  const loadLinkedEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/events?programId=${programId}&limit=50&sortBy=starts_at&sortOrder=asc`);
      const data = await res.json();
      if (res.ok) setLinkedEvents(data.events ?? []);
    } catch {
      // Non-critical
    }
  }, [slug, programId]);

  useEffect(() => {
    void loadProgram();
    void loadTemplates();
    void loadLinkedEvents();
  }, [loadProgram, loadTemplates, loadLinkedEvents]);

  const addWaiver = async () => {
    if (!selectedTemplateId) return;
    setIsAddingWaiver(true);
    try {
      const response = await fetch(`/api/projects/${slug}/programs/${programId}/waivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add waiver');
      }
      toast.success('Waiver template added');
      setSelectedTemplateId('');
      await loadProgram();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add waiver');
    } finally {
      setIsAddingWaiver(false);
    }
  };

  const removeWaiver = async (waiverId: string) => {
    try {
      const response = await fetch(`/api/projects/${slug}/programs/${programId}/waivers?waiverId=${waiverId}`, {
        method: 'DELETE',
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to remove waiver');
      }
      toast.success('Waiver template removed');
      await loadProgram();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove waiver');
    }
  };

  const addEnrollment = async () => {
    if (!personId) {
      toast.error('Choose a person to enroll.');
      return;
    }

    setIsSavingEnrollment(true);
    try {
      const response = await fetch(`/api/projects/${slug}/programs/${programId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          notes: notes || null,
        }),
      });
      const data = await response.json() as { error?: string; waiver_message?: string | null };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to enroll participant');
      }

      toast.success(data.waiver_message ?? 'Participant enrolled');
      setPersonId(null);
      setNotes('');
      await loadProgram();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to enroll participant');
    } finally {
      setIsSavingEnrollment(false);
    }
  };

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !program) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/programs`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Programs
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? 'Program not found'}
        </div>
      </div>
    );
  }

  // Filter out templates already linked as waivers
  const linkedTemplateIds = new Set(programWaivers.map((w) => w.template_id));
  const unlinkedTemplates = availableTemplates.filter((t) => !linkedTemplateIds.has(t.id));

  const waiverCount = programWaivers.length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/programs`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{program.name}</h2>
            <div className="text-sm text-muted-foreground">{program.location_name || 'No location recorded'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{program.status}</Badge>
          {program.capacity !== null && <Badge variant="outline">Capacity {program.capacity}</Badge>}
          {waiverCount > 0 && (
            <Badge variant="outline">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {waiverCount} waiver{waiverCount !== 1 ? 's' : ''} required
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{program.enrollment_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{program.attendance_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {program.schedule?.summary || 'Schedule not defined yet'}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="events">Events{linkedEvents.length > 0 ? ` (${linkedEvents.length})` : ''}</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
              <CardDescription>Summary, dates, and location.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">{program.description || 'No description provided.'}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Start Date" value={program.start_date || 'Not set'} />
                <InfoRow label="End Date" value={program.end_date || 'Not set'} />
                <InfoRow label="Location" value={program.location_name || 'Not set'} />
                <InfoRow
                  label="Waivers"
                  value={waiverCount > 0 ? `${waiverCount} required` : 'None'}
                  icon={waiverCount > 0 ? <ShieldCheck className="h-4 w-4" /> : undefined}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Waiver Requirements</CardTitle>
              <CardDescription>Contract templates that enrollees must sign before activation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {programWaivers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No waivers required for this program.
                </div>
              ) : (
                <div className="space-y-2">
                  {programWaivers.map((pw) => (
                    <div key={pw.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="text-sm font-medium">{pw.contract_templates?.name ?? 'Unknown template'}</div>
                        {pw.contract_templates?.description && (
                          <div className="text-xs text-muted-foreground">{pw.contract_templates.description}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void removeWaiver(pw.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {unlinkedTemplates.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a contract template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.category ? ` (${t.category})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => void addWaiver()}
                    disabled={!selectedTemplateId || isAddingWaiver}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </div>
              )}

              {unlinkedTemplates.length === 0 && availableTemplates.length === 0 && programWaivers.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No contract templates found. Create one below or upload a PDF.
                </div>
              )}
              {unlinkedTemplates.length === 0 && availableTemplates.length > 0 && programWaivers.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  All available contract templates are already linked to this program.
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateWaiver(true)}
              >
                <FilePlus className="mr-1 h-4 w-4" />
                Create New Waiver
              </Button>

              <CreateWaiverTemplateDialog
                open={showCreateWaiver}
                onOpenChange={setShowCreateWaiver}
                onCreated={() => {
                  void loadProgram();
                  void loadTemplates();
                }}
                programId={programId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Enrollment</CardTitle>
              <CardDescription>Enroll a person and track waiver status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PersonCombobox value={personId} onValueChange={setPersonId} />
              <div className="space-y-2">
                <Label htmlFor="enrollment-notes">Notes</Label>
                <Textarea id="enrollment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional enrollment notes" />
              </div>
              <Button onClick={() => void addEnrollment()} disabled={isSavingEnrollment}>
                Add Enrollment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment List</CardTitle>
              <CardDescription>Status, waiver state, and enrollment timing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {enrollments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No enrollments yet.
                </div>
              ) : enrollments.map((enrollment) => {
                const personLabel = [enrollment.person?.first_name, enrollment.person?.last_name].filter(Boolean).join(' ') || enrollment.person?.email;
                const label = personLabel || enrollment.household?.name || 'Unknown enrollee';
                return (
                  <div key={enrollment.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-muted-foreground">
                          Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{enrollment.status}</Badge>
                        <Badge variant={enrollment.waiver_status === 'signed' ? 'default' : 'outline'}>
                          {enrollment.waiver_status}
                        </Badge>
                      </div>
                    </div>
                    {enrollment.notes && (
                      <div className="mt-3 text-sm text-muted-foreground">{enrollment.notes}</div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="pt-4">
          <BatchAttendance
            programId={program.id}
            enrollments={enrollments}
            onSaved={() => void loadProgram()}
          />
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Linked Events</CardTitle>
              <CardDescription>Events associated with this program.</CardDescription>
            </CardHeader>
            <CardContent>
              {linkedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No events linked to this program yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedEvents.map(evt => (
                    <Link key={evt.id} href={`/projects/${slug}/events/${evt.id}`} className="block">
                      <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium text-sm">{evt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(evt.starts_at).toLocaleDateString('en-US', {
                              timeZone: evt.timezone || 'America/Denver',
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge variant="secondary">{evt.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contributions</CardTitle>
              <CardDescription>Program-linked contributions will appear here as they are logged.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Use the Contributions section to log donations, grants, and volunteer time against this program.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
        {icon}
        {value}
      </div>
    </div>
  );
}
