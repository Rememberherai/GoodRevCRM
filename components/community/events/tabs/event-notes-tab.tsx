'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NotesPanel } from '@/components/notes/notes-panel';
import { toast } from 'sonner';
import type { Note } from '@/types/note';

interface EventNote extends Note {
  category?: string | null;
}

interface EventNotesTabProps {
  projectSlug: string;
  eventId: string;
}

export function EventNotesTab({ projectSlug, eventId }: EventNotesTabProps) {
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Create form
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBase = `/api/projects/${projectSlug}/events/${eventId}/notes`;

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`${apiBase}?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setNotes(data.notes ?? []);
    } catch {
      console.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, categoryFilter]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  async function handleCreate() {
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), category }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Note added');
      setContent('');
      void loadNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    try {
      const res = await fetch(`${apiBase}/${noteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Note deleted');
      void loadNotes();
    } catch {
      toast.error('Failed to delete note');
    }
  }

  async function handleTogglePin(noteId: string, pinned: boolean) {
    try {
      const res = await fetch(`${apiBase}/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: pinned }),
      });
      if (!res.ok) throw new Error('Failed');
      void loadNotes();
    } catch {
      toast.error('Failed to update note');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Write a note about this event..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Category:</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleCreate} disabled={isSubmitting || !content.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>Event notes, feedback, and observations.</CardDescription>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="observation">Observation</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <NotesPanel
            notes={notes}
            loading={isLoading}
            onDeleteNote={handleDelete}
            onTogglePin={handleTogglePin}
            showCreateButton={false}
            emptyMessage="No notes for this event yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
