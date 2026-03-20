'use client';

import { useState, useEffect } from 'react';
import { Loader2, Mail, ListChecks, Users } from 'lucide-react';
import { useOutreachGuard } from '@/hooks/use-outreach-guard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { SEQUENCE_STATUS_COLORS, SEQUENCE_STATUS_LABELS } from '@/types/sequence';
import type { SequenceStatus } from '@/types/sequence';

interface SequenceOption {
  id: string;
  name: string;
  status: SequenceStatus;
  description: string | null;
  steps: { count: number }[];
  enrollments: { count: number }[];
}

interface GmailConnection {
  id: string;
  email: string;
  status: string;
}

interface EnrollInSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  personIds: string[];
  onEnrolled?: (count: number) => void;
}

export function EnrollInSequenceDialog({
  open,
  onOpenChange,
  projectSlug,
  personIds,
  onEnrolled,
}: EnrollInSequenceDialogProps) {
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [groupByOrg, setGroupByOrg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkOutreach, GuardDialog } = useOutreachGuard(projectSlug);

  useEffect(() => {
    if (open) {
      setSelectedSequence('');
      setSelectedConnection('');
      setError(null);
      fetchSequences();
      fetchGmailConnections();
    }
  }, [open, projectSlug]);

  const fetchSequences = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/sequences`);
      if (response.ok) {
        const data = await response.json();
        // Only show active sequences
        const active = (data.sequences || []).filter(
          (s: SequenceOption) => s.status === 'active'
        );
        setSequences(active);
        if (active.length === 1) {
          setSelectedSequence(active[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching sequences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGmailConnections = async () => {
    try {
      const response = await fetch('/api/gmail/connections');
      if (response.ok) {
        const data = await response.json();
        const connected = (data.connections || []).filter(
          (c: GmailConnection) => c.status === 'connected'
        );
        setGmailConnections(connected);
        if (connected.length > 0) {
          setSelectedConnection(connected[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching Gmail connections:', err);
    }
  };

  const doEnroll = async (ids: string[]) => {
    setIsEnrolling(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/sequences/${selectedSequence}/enrollments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_ids: ids,
            gmail_connection_id: selectedConnection,
            group_by_org: groupByOrg,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enroll');
      }

      const data = await response.json();
      const count = data.count ?? ids.length;
      toast.success(`Enrolled ${count} ${count === 1 ? 'person' : 'people'} in sequence`);
      onEnrolled?.(count);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSequence || !selectedConnection || personIds.length === 0) return;
    await checkOutreach(personIds, (filteredIds) => doEnroll(filteredIds));
  };

  const selectedSeq = sequences.find((s) => s.id === selectedSequence);

  return (
    <>
    {GuardDialog}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Enroll in Sequence
          </DialogTitle>
          <DialogDescription>
            Enroll {personIds.length} {personIds.length === 1 ? 'person' : 'people'} in
            an email sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sequence Selection */}
          <div className="space-y-2">
            <Label>Sequence</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sequences...
              </div>
            ) : sequences.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active sequences. Create and activate a sequence first.
              </p>
            ) : (
              <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sequence" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{seq.name}</span>
                        <Badge
                          variant="secondary"
                          className={`ml-1 text-xs ${SEQUENCE_STATUS_COLORS[seq.status]}`}
                        >
                          {SEQUENCE_STATUS_LABELS[seq.status]}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedSeq && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                {selectedSeq.description && (
                  <p className="mb-1">{selectedSeq.description}</p>
                )}
                <p>
                  {selectedSeq.steps?.[0]?.count ?? 0} steps &middot;{' '}
                  {selectedSeq.enrollments?.[0]?.count ?? 0} currently enrolled
                </p>
              </div>
            )}
          </div>

          {/* Gmail Connection Selection */}
          <div className="space-y-2">
            <Label>Send from</Label>
            {gmailConnections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected Gmail accounts. Please connect a Gmail account first.
              </p>
            ) : (
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Gmail account" />
                </SelectTrigger>
                <SelectContent>
                  {gmailConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {conn.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Group by org option - only show for multi-person enrollment */}
          {personIds.length > 1 && (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="group-by-org"
                checked={groupByOrg}
                onCheckedChange={(checked) => setGroupByOrg(checked === true)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="group-by-org" className="text-sm font-medium cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Group by organization
                  </div>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Send one email to all contacts at the same organization (all in To field) instead of separate emails.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={
              !selectedSequence ||
              !selectedConnection ||
              personIds.length === 0 ||
              isEnrolling
            }
          >
            {isEnrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                Enroll {personIds.length}{' '}
                {personIds.length === 1 ? 'Person' : 'People'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
