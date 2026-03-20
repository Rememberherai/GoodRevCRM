'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarRange, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NewProgramDialog } from '@/components/community/programs/new-program-dialog';

interface ProgramListItem {
  id: string;
  name: string;
  status: string;
  capacity: number | null;
  requires_waiver: boolean;
  start_date: string | null;
  end_date: string | null;
}

export function ProgramsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrograms = useCallback(async (nextSearch: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ limit: '24' });
      if (nextSearch.trim()) searchParams.set('search', nextSearch.trim());

      const response = await fetch(`/api/projects/${slug}/programs?${searchParams.toString()}`);
      const data = await response.json() as { programs?: ProgramListItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load programs');
      setPrograms(data.programs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load programs');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPrograms(search);
  }, [loadPrograms, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Programs</h2>
            <p className="text-sm text-muted-foreground">Manage sessions, enrollments, waivers, and attendance.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Program
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Program Directory</CardTitle>
            <CardDescription>Track active, planning, and completed community programs.</CardDescription>
          </div>
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(query);
            }}
          >
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search programs" />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : programs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No programs yet. Create one to start capturing attendance and dosage.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => (
                <Link key={program.id} href={`/projects/${slug}/programs/${program.id}`} className="block rounded-xl border p-5 transition-colors hover:bg-accent">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{program.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[program.start_date, program.end_date].filter(Boolean).join(' to ') || 'No dates yet'}
                        </div>
                      </div>
                      <Badge variant="secondary">{program.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {program.capacity !== null && <Badge variant="outline">Capacity {program.capacity}</Badge>}
                      {program.requires_waiver && <Badge variant="outline">Waiver required</Badge>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewProgramDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreated={() => void loadPrograms(search)}
      />
    </div>
  );
}
