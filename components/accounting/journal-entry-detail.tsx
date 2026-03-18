'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';

interface JournalEntryLine {
  id: string;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  base_debit: number;
  base_credit: number;
  currency: string;
  exchange_rate: number;
  chart_of_accounts: { id: string; account_code: string; name: string } | null;
}

interface JournalEntry {
  id: string;
  entry_number: number;
  entry_date: string;
  memo: string | null;
  reference: string | null;
  source_type: string | null;
  status: string;
  posted_at: string | null;
  voided_at: string | null;
  voided_by_entry_id: string | null;
  created_at: string;
  created_by: string;
  journal_entry_lines: JournalEntryLine[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  posted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  voided: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

interface JournalEntryDetailProps {
  entryId: string;
}

export function JournalEntryDetail({ entryId }: JournalEntryDetailProps) {
  const router = useRouter();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const fetchEntry = useCallback(async () => {
    try {
      const response = await fetch(`/api/accounting/journal-entries/${entryId}`);
      if (!response.ok) throw new Error('Not found');
      const { data } = await response.json();
      setEntry(data);
    } catch {
      toast.error('Failed to load journal entry');
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handlePost = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(`/api/accounting/journal-entries/${entryId}/post`, {
        method: 'POST',
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      toast.success('Journal entry posted');
      fetchEntry();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post');
    } finally {
      setIsActioning(false);
      setShowPostConfirm(false);
    }
  };

  const handleVoid = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(`/api/accounting/journal-entries/${entryId}/void`, {
        method: 'POST',
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      toast.success('Journal entry voided — reversing entry created');
      fetchEntry();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to void');
    } finally {
      setIsActioning(false);
      setShowVoidConfirm(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  if (isLoading) {
    return <div className="text-muted-foreground text-center py-12">Loading...</div>;
  }

  if (!entry) {
    return <div className="text-muted-foreground text-center py-12">Journal entry not found</div>;
  }

  const totalDebit = entry.journal_entry_lines.reduce((s, l) => s + Number(l.base_debit), 0);
  const totalCredit = entry.journal_entry_lines.reduce((s, l) => s + Number(l.base_credit), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/journal-entries')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">JE-{entry.entry_number}</h1>
            <p className="text-muted-foreground text-sm">{entry.entry_date}</p>
          </div>
          <Badge variant="secondary" className={STATUS_COLORS[entry.status]}>
            {entry.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {entry.status === 'draft' && (
            <Button onClick={() => setShowPostConfirm(true)} disabled={isActioning}>
              <Check className="h-4 w-4 mr-2" />
              Post
            </Button>
          )}
          {entry.status === 'posted' && (
            <Button variant="destructive" onClick={() => setShowVoidConfirm(true)} disabled={isActioning}>
              <Ban className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Memo</p>
          <p className="font-medium">{entry.memo || '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Reference</p>
          <p className="font-medium">{entry.reference || '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Source</p>
          <p className="font-medium">{entry.source_type || 'manual'}</p>
        </div>
        {entry.posted_at && (
          <div>
            <p className="text-sm text-muted-foreground">Posted</p>
            <p className="font-medium">{new Date(entry.posted_at).toLocaleDateString()}</p>
          </div>
        )}
        {entry.voided_at && (
          <div>
            <p className="text-sm text-muted-foreground">Voided</p>
            <p className="font-medium">{new Date(entry.voided_at).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[140px]">Debit</TableHead>
              <TableHead className="text-right w-[140px]">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entry.journal_entry_lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">
                  {line.chart_of_accounts
                    ? `${line.chart_of_accounts.account_code} - ${line.chart_of_accounts.name}`
                    : line.account_id}
                </TableCell>
                <TableCell className="text-muted-foreground">{line.description || '—'}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(line.base_debit) > 0 ? formatCurrency(Number(line.base_debit)) : ''}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Number(line.base_credit) > 0 ? formatCurrency(Number(line.base_credit)) : ''}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell colSpan={2} className="text-right">Totals</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Post Confirmation */}
      <AlertDialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post journal entry JE-{entry.entry_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Once posted, this entry becomes immutable. It can only be reversed by voiding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} disabled={isActioning}>
              {isActioning ? 'Posting...' : 'Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation */}
      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void journal entry JE-{entry.entry_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a reversing entry to offset all debits and credits. The original entry will be marked as voided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={isActioning}>
              {isActioning ? 'Voiding...' : 'Void'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
