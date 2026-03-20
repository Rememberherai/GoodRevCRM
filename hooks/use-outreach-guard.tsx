'use client';

import { useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface BlockedPerson {
  person_id: string;
  person_name: string;
  disposition_name: string;
}

interface OutreachGuardState {
  open: boolean;
  blocked: BlockedPerson[];
  allIds: string[];
}

/**
 * Hook that checks whether any people in a list have a disposition
 * with blocks_outreach=true, and shows a warning dialog if so.
 *
 * For single-person checks where disposition data is already loaded,
 * use checkWithDisposition() to avoid an API call.
 */
export function useOutreachGuard(projectSlug: string) {
  const [state, setState] = useState<OutreachGuardState>({
    open: false,
    blocked: [],
    allIds: [],
  });

  // Use a ref for the callback to avoid stale closure issues
  const onConfirmRef = useRef<((ids: string[]) => void) | null>(null);

  // Check via API (POST) — used for bulk enrollment where disposition data isn't loaded
  const checkOutreach = useCallback(
    async (personIds: string[], onConfirm: (ids: string[]) => void) => {
      if (personIds.length === 0) {
        onConfirm(personIds);
        return;
      }

      try {
        const res = await fetch(
          `/api/projects/${projectSlug}/people/check-outreach`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: personIds }),
          }
        );
        if (!res.ok) {
          onConfirm(personIds);
          return;
        }

        const data = await res.json();
        const blocked: BlockedPerson[] = data.blocked ?? [];

        if (blocked.length === 0) {
          onConfirm(personIds);
        } else {
          onConfirmRef.current = onConfirm;
          setState({ open: true, blocked, allIds: personIds });
        }
      } catch {
        onConfirm(personIds);
      }
    },
    [projectSlug]
  );

  // Client-side check — used when disposition data is already available
  const checkWithDisposition = useCallback(
    (
      personId: string,
      personName: string,
      disposition: { name: string; blocks_outreach: boolean } | null | undefined,
      onConfirm: () => void
    ) => {
      if (!disposition?.blocks_outreach) {
        onConfirm();
        return;
      }

      // Wrap the no-arg callback to match the ref signature
      onConfirmRef.current = () => onConfirm();
      setState({
        open: true,
        blocked: [
          {
            person_id: personId,
            person_name: personName,
            disposition_name: disposition.name,
          },
        ],
        allIds: [personId],
      });
    },
    []
  );

  const handleProceedAll = useCallback(() => {
    const cb = onConfirmRef.current;
    const ids = state.allIds;
    setState((s) => ({ ...s, open: false }));
    onConfirmRef.current = null;
    cb?.(ids);
  }, [state.allIds]);

  const handleExcludeBlocked = useCallback(() => {
    const cb = onConfirmRef.current;
    const blockedIds = new Set(state.blocked.map((b) => b.person_id));
    const filtered = state.allIds.filter((id) => !blockedIds.has(id));
    setState((s) => ({ ...s, open: false }));
    onConfirmRef.current = null;
    if (filtered.length > 0) {
      cb?.(filtered);
    }
  }, [state.allIds, state.blocked]);

  const handleCancel = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    onConfirmRef.current = null;
  }, []);

  const isSingle = state.blocked.length === 1 && state.allIds.length === 1;
  const isBulk = state.allIds.length > 1;

  const GuardDialog = (
    <AlertDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Outreach Warning
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {isSingle ? (
                <p>
                  <strong>{state.blocked[0]?.person_name}</strong> is marked as{' '}
                  <strong>{state.blocked[0]?.disposition_name}</strong>, which
                  blocks outreach. Are you sure you want to proceed?
                </p>
              ) : (
                <>
                  <p>
                    <strong>
                      {state.blocked.length} of {state.allIds.length}
                    </strong>{' '}
                    selected people have disposition{state.blocked.length === 1 ? '' : 's'} that block{state.blocked.length === 1 ? 's' : ''} outreach:
                  </p>
                  <ul className="list-disc pl-5 text-sm">
                    {state.blocked.slice(0, 10).map((b) => (
                      <li key={b.person_id}>
                        {b.person_name}{' '}
                        <span className="text-muted-foreground">
                          ({b.disposition_name})
                        </span>
                      </li>
                    ))}
                    {state.blocked.length > 10 && (
                      <li className="text-muted-foreground">
                        ...and {state.blocked.length - 10} more
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          {isBulk && state.blocked.length < state.allIds.length && (
            <Button variant="outline" onClick={handleExcludeBlocked}>
              Exclude & Proceed ({state.allIds.length - state.blocked.length})
            </Button>
          )}
          <AlertDialogAction variant="destructive" onClick={handleProceedAll}>
            {isSingle ? 'Proceed Anyway' : 'Proceed with All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { checkOutreach, checkWithDisposition, GuardDialog };
}
