'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarRange, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PersonCombobox } from '@/components/ui/person-combobox';
import { BatchAttendance } from '@/components/community/programs/batch-attendance';

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

  const loadProgram = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [programResponse, enrollmentResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/programs/${programId}`),
        fetch(`/api/projects/${slug}/programs/${programId}/enrollments`),
      ]);

      const programData = await programResponse.json() as { program?: ProgramDetail; error?: string };
      const enrollmentData = await enrollmentResponse.json() as { enrollments?: EnrollmentRecord[]; error?: string };

      if (!programResponse.ok || !programData.program) {
        throw new Error(programData.error ?? 'Failed to load program');
      }
      if (!enrollmentResponse.ok) {
        throw new Error(enrollmentData.error ?? 'Failed to load enrollments');
      }

      setProgram(programData.program);
      setEnrollments(enrollmentData.enrollments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load program');
    } finally {
      setIsLoading(false);
    }
  }, [programId, slug]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

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
          {program.requires_waiver && <Badge variant="outline">Waiver required</Badge>}
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
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
              <CardDescription>Summary, dates, and waiver requirements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">{program.description || 'No description provided.'}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Start Date" value={program.start_date || 'Not set'} />
                <InfoRow label="End Date" value={program.end_date || 'Not set'} />
                <InfoRow label="Location" value={program.location_name || 'Not set'} />
                <InfoRow label="Waiver" value={program.requires_waiver ? 'Required' : 'Not required'} icon={program.requires_waiver ? <ShieldCheck className="h-4 w-4" /> : undefined} />
              </div>
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
