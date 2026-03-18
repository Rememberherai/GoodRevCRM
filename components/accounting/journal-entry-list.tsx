'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { JournalEntryForm } from './journal-entry-form';

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
  created_at: string;
  journal_entry_lines: JournalEntryLine[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  posted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  voided: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function JournalEntryList() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await fetch(`/api/accounting/journal-entries?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setEntries(result.data);
      setPagination((p) => ({ ...p, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch {
      toast.error('Failed to load journal entries');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [statusFilter, startDate, endDate]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  if (isLoading) {
    return <div className="text-muted-foreground text-center py-12">Loading journal entries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start date"
          className="w-[160px]"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End date"
          className="w-[160px]"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">#</TableHead>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="w-[100px]">Source</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No journal entries found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const totalDebit = entry.journal_entry_lines.reduce(
                  (sum, l) => sum + Number(l.base_debit),
                  0,
                );
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/accounting/journal-entries/${entry.id}`)}
                  >
                    <TableCell className="font-mono">{entry.entry_number}</TableCell>
                    <TableCell>{entry.entry_date}</TableCell>
                    <TableCell className="truncate max-w-[300px]">{entry.memo || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.source_type ?? 'manual'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[entry.status]}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pagination.total} entries</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          {isFormOpen && (
            <JournalEntryForm
              onSuccess={() => {
                setIsFormOpen(false);
                fetchEntries();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
