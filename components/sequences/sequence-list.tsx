'use client';

import { useState } from 'react';
import { Mail, MoreHorizontal, Pencil, Copy, Trash2, Users, Play, Pause, Archive, Building2, Globe, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Sequence } from '@/types/sequence';
import { SEQUENCE_STATUS_LABELS, SEQUENCE_STATUS_COLORS } from '@/types/sequence';

interface SequenceWithCounts extends Sequence {
  steps?: { count: number }[];
  enrollments?: { count: number }[];
  organization?: { id: string; name: string; domain: string | null } | null;
  person?: { id: string; first_name: string; last_name: string; email: string | null } | null;
}

interface SequenceListProps {
  sequences: SequenceWithCounts[];
  onEdit?: (sequence: SequenceWithCounts) => void;
  onDuplicate?: (sequence: SequenceWithCounts) => void;
  onDelete?: (sequence: SequenceWithCounts) => void;
  onActivate?: (sequence: SequenceWithCounts) => void;
  onPause?: (sequence: SequenceWithCounts) => void;
  onArchive?: (sequence: SequenceWithCounts) => void;
  onEnroll?: (sequence: SequenceWithCounts) => void;
}

export function SequenceList({
  sequences,
  onEdit,
  onDuplicate,
  onDelete,
  onActivate,
  onPause,
  onArchive,
  onEnroll,
}: SequenceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getStepCount = (sequence: SequenceWithCounts) => {
    if (sequence.steps && sequence.steps.length > 0) {
      return sequence.steps[0]?.count ?? 0;
    }
    return 0;
  };

  const getEnrollmentCount = (sequence: SequenceWithCounts) => {
    if (sequence.enrollments && sequence.enrollments.length > 0) {
      return sequence.enrollments[0]?.count ?? 0;
    }
    return 0;
  };

  if (sequences.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-1">No sequences yet</h3>
        <p className="text-sm">Create your first email sequence to get started.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[35%]">Name</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">Steps</TableHead>
          <TableHead className="text-center">Enrolled</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sequences.map((sequence) => (
          <TableRow
            key={sequence.id}
            className={`cursor-pointer ${selectedId === sequence.id ? 'bg-muted/50' : ''}`}
            onClick={() => {
              setSelectedId(sequence.id);
              onEdit?.(sequence);
            }}
          >
            <TableCell>
              <div>
                <div className="font-medium">{sequence.name}</div>
                {sequence.description && (
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {sequence.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              {sequence.person ? (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[120px]" title={`${sequence.person.first_name} ${sequence.person.last_name}`}>
                    {sequence.person.first_name} {sequence.person.last_name}
                  </span>
                </div>
              ) : sequence.organization ? (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm truncate max-w-[120px]" title={sequence.organization.name}>
                    {sequence.organization.name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="text-sm">Project-wide</span>
                </div>
              )}
            </TableCell>
            <TableCell>
              <Badge className={SEQUENCE_STATUS_COLORS[sequence.status]}>
                {SEQUENCE_STATUS_LABELS[sequence.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {getStepCount(sequence)} emails
            </TableCell>
            <TableCell className="text-center">
              {getEnrollmentCount(sequence)}
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {new Date(sequence.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(sequence);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}

                  {onEnroll && sequence.status === 'active' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnroll(sequence);
                      }}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Enroll People
                    </DropdownMenuItem>
                  )}

                  {onActivate && (sequence.status === 'draft' || sequence.status === 'paused') && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivate(sequence);
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </DropdownMenuItem>
                  )}

                  {onPause && sequence.status === 'active' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onPause(sequence);
                      }}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  {onDuplicate && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(sequence);
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                  )}

                  {onArchive && sequence.status !== 'archived' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(sequence);
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  )}

                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(sequence);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
