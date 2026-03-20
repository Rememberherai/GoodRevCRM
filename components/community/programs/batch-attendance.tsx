'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EnrollmentRecord {
  id: string;
  person_id: string | null;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface AttendanceRecord {
  person_id: string;
  status: 'present' | 'absent' | 'excused';
  hours: number;
}

export function BatchAttendance({
  programId,
  enrollments,
  onSaved,
}: {
  programId: string;
  enrollments: EnrollmentRecord[];
  onSaved: () => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  const personEnrollments = useMemo(
    () => enrollments.filter((enrollment): enrollment is EnrollmentRecord & { person_id: string } => Boolean(enrollment.person_id)),
    [enrollments]
  );

  useEffect(() => {
    if (personEnrollments.length === 0) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/programs/${programId}/attendance?date=${date}`);
        const data = await response.json() as { attendance?: AttendanceRecord[] };
        if (!active || !response.ok) return;

        const nextRecords: Record<string, AttendanceRecord> = {};
        for (const enrollment of personEnrollments) {
          nextRecords[enrollment.person_id] = {
            person_id: enrollment.person_id,
            status: 'present',
            hours: 1,
          };
        }
        for (const row of data.attendance ?? []) {
          nextRecords[row.person_id] = {
            person_id: row.person_id,
            status: row.status,
            hours: row.hours,
          };
        }
        setRecords(nextRecords);
      } catch (error) {
        console.error('Failed to load attendance:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [date, personEnrollments, programId, slug]);

  const updateRecord = (personId: string, patch: Partial<AttendanceRecord>) => {
    setRecords((current) => ({
      ...current,
      [personId]: {
        person_id: personId,
        status: current[personId]?.status ?? 'present',
        hours: current[personId]?.hours ?? 1,
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    const entries = personEnrollments.map((enrollment) => records[enrollment.person_id] ?? {
      person_id: enrollment.person_id,
      status: 'present' as const,
      hours: 1,
    });

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/programs/${programId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save attendance');
      }

      toast.success('Attendance saved');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Attendance</CardTitle>
        <CardDescription>Capture present, absent, and excused attendance by session date.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex max-w-xs items-center gap-3">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Button onClick={handleSave} disabled={isSaving || personEnrollments.length === 0}>
            Save
          </Button>
        </div>

        {personEnrollments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Attendance is recorded for person-level enrollments. Add people to this program first.
          </div>
        ) : (
          <div className="space-y-3">
            {personEnrollments.map((enrollment) => {
              const record = records[enrollment.person_id] ?? {
                person_id: enrollment.person_id,
                status: 'present' as const,
                hours: 1,
              };
              const name = [enrollment.person?.first_name, enrollment.person?.last_name].filter(Boolean).join(' ') || enrollment.person?.email || enrollment.person_id;

              return (
                <div key={enrollment.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.8fr_1fr_120px] md:items-center">
                  <div className="font-medium">{name}</div>
                  <Select value={record.status} onValueChange={(value: AttendanceRecord['status']) => updateRecord(enrollment.person_id, { status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="excused">Excused</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={String(record.hours)}
                    onChange={(event) => updateRecord(enrollment.person_id, { hours: Number(event.target.value) })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
