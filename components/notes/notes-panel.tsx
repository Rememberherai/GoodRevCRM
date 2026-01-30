'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  StickyNote,
  Pin,
  MoreHorizontal,
  Plus,
  Loader2,
  Trash2,
  PinOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/note';

interface NotesPanelProps {
  notes: Note[];
  loading?: boolean;
  onCreateNote?: () => void;
  onDeleteNote?: (noteId: string) => void;
  onTogglePin?: (noteId: string, pinned: boolean) => void;
  showCreateButton?: boolean;
  emptyMessage?: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function NotesPanel({
  notes,
  loading = false,
  onCreateNote,
  onDeleteNote,
  onTogglePin,
  showCreateButton = true,
  emptyMessage = 'No notes yet',
}: NotesPanelProps) {
  const [deletingNotes, setDeletingNotes] = useState<Set<string>>(new Set());

  const handleDelete = async (noteId: string) => {
    if (!onDeleteNote) return;

    setDeletingNotes((prev) => new Set(prev).add(noteId));
    try {
      await onDeleteNote(noteId);
    } finally {
      setDeletingNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <StickyNote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{emptyMessage}</p>
        {showCreateButton && onCreateNote && (
          <Button variant="outline" className="mt-4" onClick={onCreateNote}>
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        )}
      </div>
    );
  }

  // Sort: pinned first, then by created_at desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {showCreateButton && onCreateNote && (
        <div className="flex justify-end">
          <Button size="sm" onClick={onCreateNote}>
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {sortedNotes.map((note) => {
          const isDeleting = deletingNotes.has(note.id);

          return (
            <div
              key={note.id}
              className={cn(
                'p-4 rounded-lg border bg-card',
                note.is_pinned && 'border-primary/50 bg-primary/5',
                isDeleting && 'opacity-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {note.author && (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={note.author.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(note.author.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {note.author?.full_name ?? 'Unknown'}
                    </span>
                    {note.is_pinned && (
                      <Pin className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isDeleting}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onTogglePin && (
                        <DropdownMenuItem
                          onClick={() => onTogglePin(note.id, !note.is_pinned)}
                        >
                          {note.is_pinned ? (
                            <>
                              <PinOff className="mr-2 h-4 w-4" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-4 w-4" />
                              Pin
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      {onDeleteNote && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(note.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-2 text-sm whitespace-pre-wrap">{note.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
