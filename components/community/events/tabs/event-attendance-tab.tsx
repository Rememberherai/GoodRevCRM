'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Loader2, Save, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Attendee {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  checked_in_at: string | null;
  person_id: string | null;
}

interface ParsedName {
  raw_text: string;
  matched_person_id: string | null;
  match_confidence: number;
  suggested_name: string;
  match_status: 'matched' | 'possible' | 'unmatched';
}

interface Confirmation {
  raw_text: string;
  person_id: string | null;
  create_new: boolean;
}

interface EventAttendanceTabProps {
  projectSlug: string;
  eventId: string;
}

export function EventAttendanceTab({ projectSlug, eventId }: EventAttendanceTabProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [parsedNames, setParsedNames] = useState<ParsedName[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const apiBase = `/api/projects/${projectSlug}/events/${eventId}`;

  const loadAttendees = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/attendance`);
      const data = await res.json();
      if (res.ok) {
        setAttendees(data.attendees ?? []);
        const map: Record<string, string> = {};
        for (const a of data.attendees ?? []) {
          map[a.id] = a.checked_in_at ? 'present' : '';
        }
        setAttendanceMap(map);
      }
    } catch {
      console.error('Failed to load attendance');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { void loadAttendees(); }, [loadAttendees]);

  async function handleSaveAttendance() {
    const entries = Object.entries(attendanceMap).filter(([, status]) => status);
    if (entries.length === 0) {
      toast.error('No attendance to save');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${apiBase}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendees: entries.map(([registration_id, status]) => ({
            registration_id,
            status: status as 'present' | 'absent',
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Attendance saved (${data.updated} updated)`);
      void loadAttendees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleScanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsScanning(true);
    setParsedNames([]);
    setConfirmations([]);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${apiBase}/scan-attendance`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      const names: ParsedName[] = data.parsed_names ?? [];
      setParsedNames(names);
      setConfirmations(names.map(n => ({
        raw_text: n.raw_text,
        person_id: n.match_status === 'matched' ? n.matched_person_id : null,
        create_new: n.match_status === 'unmatched',
      })));

      if (names.length === 0) {
        toast.info('No names could be extracted from the image');
      } else {
        toast.success(`Found ${names.length} names`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }

  async function handleConfirmScan() {
    const toConfirm = confirmations.filter(c => c.person_id || c.create_new);
    if (toConfirm.length === 0) {
      toast.error('No names selected to confirm');
      return;
    }

    setIsConfirming(true);
    try {
      const res = await fetch(`${apiBase}/confirm-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmations: toConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`${data.processed} attendees confirmed`);
      setParsedNames([]);
      setConfirmations([]);
      void loadAttendees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setIsConfirming(false);
    }
  }

  function getConfidenceBadge(status: string) {
    switch (status) {
      case 'matched': return <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">Matched</Badge>;
      case 'possible': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">Possible</Badge>;
      default: return <Badge className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200">Unmatched</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Attendance</CardTitle>
            <CardDescription>Mark attendance for registered participants.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Camera className="mr-1 h-3 w-3" />
                {isScanning ? 'Scanning...' : 'Scan Sign-in Sheet'}
                <input type="file" accept="image/*" className="hidden" onChange={handleScanUpload} disabled={isScanning} />
              </label>
            </Button>
            <Button size="sm" onClick={handleSaveAttendance} disabled={isSaving}>
              <Save className="mr-1 h-3 w-3" />
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No registrations to track attendance for.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-medium">Name</th>
                    <th className="px-2 py-2 text-left font-medium">Email</th>
                    <th className="px-2 py-2 text-left font-medium">Checked In</th>
                    <th className="px-2 py-2 text-left font-medium">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map(a => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-2 py-2">{a.registrant_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{a.registrant_email}</td>
                      <td className="px-2 py-2">
                        {a.checked_in_at ? (
                          <Badge variant="outline" className="text-green-700">
                            <Check className="mr-1 h-3 w-3" />
                            {new Date(a.checked_in_at).toLocaleTimeString()}
                          </Badge>
                        ) : '-'}
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={attendanceMap[a.id] || ''}
                          onValueChange={v => setAttendanceMap(m => ({ ...m, [a.id]: v }))}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Not Present</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Results */}
      {parsedNames.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Scanned Names</CardTitle>
              <CardDescription>Review and confirm scanned attendance.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setParsedNames([]); setConfirmations([]); }}>
                <X className="mr-1 h-3 w-3" />Dismiss
              </Button>
              <Button size="sm" onClick={handleConfirmScan} disabled={isConfirming}>
                {isConfirming ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Confirm
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsedNames.map((name, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{name.raw_text}</span>
                    {getConfidenceBadge(name.match_status)}
                    {name.match_status !== 'unmatched' && name.suggested_name && (
                      <span className="text-muted-foreground">&rarr; {name.suggested_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {name.match_status === 'unmatched' && (
                      <Button
                        variant={confirmations[i]?.create_new ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setConfirmations(prev => {
                            const next = [...prev];
                            const cur = next[i];
                            if (cur) next[i] = { raw_text: cur.raw_text, create_new: !cur.create_new, person_id: null };
                            return next;
                          });
                        }}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        {confirmations[i]?.create_new ? 'Will Create' : 'Create New'}
                      </Button>
                    )}
                    {name.match_status === 'possible' && (
                      <Button
                        variant={confirmations[i]?.person_id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setConfirmations(prev => {
                            const next = [...prev];
                            const cur = next[i];
                            if (cur) next[i] = {
                              raw_text: cur.raw_text,
                              person_id: cur.person_id ? null : name.matched_person_id,
                              create_new: false,
                            };
                            return next;
                          });
                        }}
                      >
                        {confirmations[i]?.person_id ? 'Accepted' : 'Accept Match'}
                      </Button>
                    )}
                    {name.match_status === 'matched' && (
                      <Badge variant="outline" className="text-green-700">
                        <Check className="mr-1 h-3 w-3" />Auto-confirmed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
