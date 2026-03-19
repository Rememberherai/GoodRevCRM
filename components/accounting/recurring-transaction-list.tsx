'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Pause, Play, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
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

interface RecurringTransaction {
  id: string;
  type: string;
  name: string;
  counterparty_name: string;
  frequency: string;
  currency: string;
  line_items: Array<{ quantity?: number; unit_price?: number }>;
  next_date: string;
  is_active: boolean;
  total_generated: number;
  end_date: string | null;
  occurrences_remaining: number | null;
}

function fmt(n: number, currency: string = 'USD'): string {
  return n.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 });
}

function computeTotal(items: Array<{ quantity?: number; unit_price?: number }>): number {
  return items.reduce((sum, li) => sum + (li.quantity ?? 1) * (li.unit_price ?? 0), 0);
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

interface RecurringTransactionListProps {
  canManage: boolean;
  canDelete: boolean;
}

export function RecurringTransactionList({ canManage, canDelete }: RecurringTransactionListProps) {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/accounting/recurring-transactions');
      if (!res.ok) {
        setItems([]);
        setLoadError('Failed to load recurring transactions');
        return;
      }
      const { data } = await res.json();
      setItems(data ?? []);
    } catch {
      setItems([]);
      setLoadError('Failed to load recurring transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/accounting/recurring-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !active }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to update recurring transaction');
      }

      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update recurring transaction');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/accounting/recurring-transactions/${deleteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to delete recurring transaction');
      }

      setDeleteId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete recurring transaction');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurring Transactions</h2>
        {canManage ? (
          <Link href="/accounting/recurring/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Recurring
            </Button>
          </Link>
        ) : null}
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No recurring transactions configured.</p>
          <p className="text-sm mt-1">
            Set up automatic invoice or bill generation on a schedule.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Generated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.counterparty_name}</TableCell>
                  <TableCell className="text-sm">
                    {FREQ_LABELS[item.frequency] ?? item.frequency}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(computeTotal(item.line_items), item.currency)}
                  </TableCell>
                  <TableCell className="text-sm">{item.next_date}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.is_active ? 'default' : 'secondary'}
                      className={
                        item.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : ''
                      }
                    >
                      {item.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{item.total_generated}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(item.id, item.is_active)}
                          title={item.is_active ? 'Pause' : 'Resume'}
                        >
                          {item.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop future generation. Already generated invoices/bills are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
