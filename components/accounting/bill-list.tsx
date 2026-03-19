'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Database } from '@/types/database';

type Bill = Database['public']['Tables']['bills']['Row'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  partially_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  voided: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  received: 'Received',
  partially_paid: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  voided: 'Voided',
};

interface BillListProps {
  canCreate: boolean;
}

export function BillList({ canCreate }: BillListProps) {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/accounting/bills?${params}`);
      if (!response.ok) {
        setBills([]);
        setTotalPages(1);
        setLoadError('Failed to load bills');
        return;
      }

      const { data, pagination } = await response.json();
      setBills(data);
      setTotalPages(pagination.totalPages);
    } catch {
      setBills([]);
      setTotalPages(1);
      setLoadError('Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        {canCreate ? (
          <Button onClick={() => router.push('/accounting/bills/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Bill
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by vendor or bill #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No bills found
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow
                  key={bill.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/accounting/bills/${bill.id}`)}
                >
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.bill_date}</TableCell>
                  <TableCell>{bill.vendor_name}</TableCell>
                  <TableCell>{bill.due_date}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(bill.total), bill.currency || 'USD')}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(bill.balance_due), bill.currency || 'USD')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[bill.status] ?? ''}>
                      {STATUS_LABELS[bill.status] ?? bill.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
