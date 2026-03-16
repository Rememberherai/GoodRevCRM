'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PersonForValidation {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  email_verified?: boolean | null;
  email_verified_at?: string | null;
}

interface BulkValidateEmailsModalProps {
  open: boolean;
  onClose: () => void;
  selectedPeople: PersonForValidation[];
  projectSlug: string;
  onComplete: () => void;
}

interface ValidationResultItem {
  email: string;
  valid: boolean;
  reason?: string;
  personName: string;
}

type Phase = 'confirming' | 'processing' | 'completed';

const BATCH_SIZE = 500;

export function BulkValidateEmailsModal({
  open,
  onClose,
  selectedPeople,
  projectSlug,
  onComplete,
}: BulkValidateEmailsModalProps) {
  const [phase, setPhase] = useState<Phase>('confirming');
  const [includeVerified, setIncludeVerified] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ValidationResultItem[]>([]);
  const [failedBatches, setFailedBatches] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const { noEmail, alreadyVerified, toValidate } = useMemo(() => {
    const withEmail = selectedPeople.filter(
      (p) => p.email && p.email.trim().length > 0
    );
    const noEmail = selectedPeople.length - withEmail.length;
    const alreadyVerified = withEmail.filter(
      (p) => p.email_verified === true
    );
    const toValidate = includeVerified
      ? withEmail
      : withEmail.filter((p) => p.email_verified !== true);
    return { withEmail, noEmail, alreadyVerified, toValidate };
  }, [selectedPeople, includeVerified]);

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.filter((r) => !r.valid).length;
  const invalidResults = results.filter((r) => !r.valid);

  const handleClose = useCallback(() => {
    if (phase === 'processing') return;
    if (phase === 'completed') onComplete();
    setPhase('confirming');
    setIncludeVerified(false);
    setProgress(0);
    setResults([]);
    setFailedBatches(0);
    abortRef.current?.abort();
    onClose();
  }, [phase, onComplete, onClose]);

  const handleStart = async () => {
    if (toValidate.length === 0) return;

    setPhase('processing');
    setProgress(0);
    setResults([]);
    setFailedBatches(0);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build email-to-name map
    const emailToName = new Map<string, string>();
    for (const p of toValidate) {
      emailToName.set(
        p.email!.trim().toLowerCase(),
        `${p.first_name} ${p.last_name}`.trim()
      );
    }

    // Build batches
    const batches: Array<{ emails: string[]; personIds: string[] }> = [];
    for (let i = 0; i < toValidate.length; i += BATCH_SIZE) {
      const chunk = toValidate.slice(i, i + BATCH_SIZE);
      batches.push({
        emails: chunk.map((p) => p.email!.trim()),
        personIds: chunk.map((p) => p.id),
      });
    }

    const allResults: ValidationResultItem[] = [];
    let failed = 0;

    for (let i = 0; i < batches.length; i++) {
      if (controller.signal.aborted) break;

      try {
        const response = await fetch('/api/validate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails: batches[i]!.emails,
            personIds: batches[i]!.personIds,
            projectSlug,
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          for (const result of data.results) {
            allResults.push({
              email: result.email,
              valid: result.valid,
              reason: result.reason,
              personName: emailToName.get(result.email.toLowerCase()) ?? '',
            });
          }
        } else {
          failed++;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        failed++;
      }

      setProgress(Math.round(((i + 1) / batches.length) * 100));
      setResults([...allResults]);
    }

    if (!controller.signal.aborted) {
      setResults(allResults);
      setFailedBatches(failed);
      setPhase('completed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Validate Emails
          </DialogTitle>
          <DialogDescription>
            {phase === 'confirming' &&
              'Check email addresses for valid domains and MX records.'}
            {phase === 'processing' && 'Validating email addresses...'}
            {phase === 'completed' && 'Validation complete.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {phase === 'confirming' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {selectedPeople.length} people selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {toValidate.length} email{toValidate.length !== 1 ? 's' : ''} to validate
                  </p>
                  {noEmail > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {noEmail} without email (skipped)
                    </p>
                  )}
                  {alreadyVerified.length > 0 && !includeVerified && (
                    <p className="text-sm text-muted-foreground">
                      {alreadyVerified.length} already verified (skipped)
                    </p>
                  )}
                </div>
              </div>

              {alreadyVerified.length > 0 && (
                <div
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setIncludeVerified(!includeVerified)}
                >
                  <Checkbox
                    checked={includeVerified}
                    onCheckedChange={(v) => setIncludeVerified(!!v)}
                  />
                  <span className="text-sm">
                    Re-validate {alreadyVerified.length} already verified email
                    {alreadyVerified.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {phase === 'processing' && (
            <div className="space-y-4 py-8">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking MX records... {results.length} / {toValidate.length}
              </div>
            </div>
          )}

          {phase === 'completed' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-600">
                    {validCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Valid</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-600">
                    {invalidCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Invalid</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Mail className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold text-muted-foreground">
                    {noEmail + (includeVerified ? 0 : alreadyVerified.length)}
                  </p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              {failedBatches > 0 && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {failedBatches} batch{failedBatches !== 1 ? 'es' : ''} failed
                  to validate.
                </div>
              )}

              {invalidResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Invalid emails:</p>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-2 space-y-2">
                      {invalidResults.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-lg border p-2"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {r.personName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.email}
                            </p>
                            <p className="text-xs text-amber-600">
                              {r.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === 'confirming' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={toValidate.length === 0}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Validate {toValidate.length} Email
                {toValidate.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {phase === 'completed' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
