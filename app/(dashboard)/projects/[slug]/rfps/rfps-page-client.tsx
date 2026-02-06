'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, FileText, Calendar, DollarSign, MoreHorizontal, Pencil, Trash2, AlertTriangle, ListChecks } from 'lucide-react';
import { useRfps } from '@/hooks/use-rfps';
import { useColumnPreferences } from '@/hooks/use-column-preferences';
import { STATUS_LABELS, RFP_STATUSES, type RfpStatus } from '@/types/rfp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { NewRfpDialog } from '@/components/rfps/new-rfp-dialog';
import { BulkActionsBar } from '@/components/bulk/bulk-actions-bar';
import { ColumnPicker } from '@/components/table/column-picker';
import { renderCellValue } from '@/lib/table-columns/renderers';
import type { BulkOperation } from '@/types/bulk';

const STATUS_COLORS: Record<RfpStatus, string> = {
  identified: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  reviewing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  preparing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  submitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  no_bid: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

export function RfpsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const {
    rfps,
    pagination,
    isLoading,
    error,
    statusFilter,
    search,
    remove,
    filterByStatus,
    goToPage,
    refresh,
  } = useRfps();

  const {
    columns,
    allColumns,
    isLoading: columnsLoading,
    isSaving,
    toggleColumn,
    resetToDefaults,
  } = useColumnPreferences('rfp');

  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<string, number>;
    upcomingDeadlines: number;
    winRate: number;
    totalValue: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${slug}/rfps/stats`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [slug]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(searchInput);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      setDeleteId(null);
    } catch {
      // Error is handled by the hook
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rfps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rfps.map((rfp) => rfp.id)));
    }
  };

  const handleBulkAction = async (operation: BulkOperation) => {
    if (selectedIds.size === 0) return;

    setBulkLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'rfp',
          entity_ids: Array.from(selectedIds),
          operation,
        }),
      });

      if (!response.ok) {
        throw new Error('Bulk operation failed');
      }

      // Clear selection and refresh the list
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error('Bulk action error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkResearch = async () => {
    if (selectedIds.size === 0) return;

    setBulkLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/rfps/bulk-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Bulk research failed');
      }

      const result = await response.json();
      console.log(`Started research for ${result.started} RFPs`);

      // Clear selection
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk research error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (dueDate: string | null, status: RfpStatus) => {
    if (!dueDate) return false;
    if (['won', 'lost', 'no_bid', 'submitted'].includes(status)) return false;
    return new Date(dueDate) < new Date();
  };

  const isDueSoon = (dueDate: string | null, status: RfpStatus) => {
    if (!dueDate) return false;
    if (['won', 'lost', 'no_bid', 'submitted'].includes(status)) return false;
    const due = new Date(dueDate);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return due <= sevenDaysFromNow && due >= new Date();
  };

  // Render cell content based on column key
  const renderCell = (rfp: typeof rfps[0], columnKey: string) => {
    // Special handling for title column
    if (columnKey === 'title') {
      return (
        <>
          <Link
            href={`/projects/${slug}/rfps/${rfp.id}`}
            className="font-medium hover:underline"
          >
            {rfp.title}
          </Link>
          {rfp.rfp_number && (
            <div className="text-sm text-muted-foreground">
              #{rfp.rfp_number}
            </div>
          )}
        </>
      );
    }

    // Special handling for status with colored badge
    if (columnKey === 'status') {
      return (
        <Badge className={STATUS_COLORS[rfp.status]} variant="secondary">
          {STATUS_LABELS[rfp.status]}
        </Badge>
      );
    }

    // Special handling for progress (question counts)
    if (columnKey === 'progress') {
      const rfpWithCounts = rfp as typeof rfp & { question_counts?: { answered: number; total: number } };
      if (rfpWithCounts.question_counts) {
        return (
          <div className="flex items-center gap-2">
            <ListChecks className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">
              {rfpWithCounts.question_counts.answered}/{rfpWithCounts.question_counts.total}
            </span>
          </div>
        );
      }
      return <span className="text-sm text-muted-foreground">—</span>;
    }

    // Special handling for due_date with overdue/soon indicators
    if (columnKey === 'due_date') {
      return (
        <div className="flex items-center gap-2">
          {isOverdue(rfp.due_date, rfp.status) && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          {isDueSoon(rfp.due_date, rfp.status) && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className={
              isOverdue(rfp.due_date, rfp.status)
                ? 'text-destructive font-medium'
                : isDueSoon(rfp.due_date, rfp.status)
                  ? 'text-amber-600 font-medium'
                  : ''
            }>
              {formatDate(rfp.due_date)}
            </span>
          </div>
        </div>
      );
    }

    // Special handling for estimated_value with icon
    if (columnKey === 'estimated_value') {
      return (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {formatCurrency(rfp.estimated_value, rfp.currency)}
        </div>
      );
    }

    // Find the column definition and use the generic renderer
    const column = columns.find(c => c.key === columnKey);
    if (column) {
      return renderCellValue(rfp as unknown as Record<string, unknown>, column);
    }

    return <span className="text-muted-foreground">—</span>;
  };

  // Calculate total columns for colspan (checkbox + visible columns + actions)
  const totalColumns = columns.length + 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RFPs</h2>
          <p className="text-muted-foreground">
            Track Request for Proposals and their deadlines
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add RFP
        </Button>
      </div>

      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total RFPs</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Preparing</p>
            <p className="text-2xl font-bold">
              {(stats.byStatus['identified'] ?? 0) +
                (stats.byStatus['reviewing'] ?? 0) +
                (stats.byStatus['preparing'] ?? 0)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="text-2xl font-bold">{stats.upcomingDeadlines}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">{stats.winRate}%</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search RFPs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Select
          value={statusFilter ?? 'all'}
          onValueChange={(value) => filterByStatus(value === 'all' ? null : value as RfpStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {RFP_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnPicker
          columns={allColumns}
          onToggle={toggleColumn}
          onReset={resetToDefaults}
          isSaving={isSaving}
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          entityType="rfp"
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkAction={handleBulkAction}
          loading={bulkLoading}
          showResearch
          onResearch={handleBulkResearch}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={rfps.length > 0 && selectedIds.size === rfps.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                >
                  {column.label}
                </TableHead>
              ))}
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoading || columnsLoading) && rfps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rfps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No RFPs yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first RFP
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rfps.map((rfp) => (
                <TableRow key={rfp.id} data-state={selectedIds.has(rfp.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(rfp.id)}
                      onCheckedChange={() => toggleSelection(rfp.id)}
                      aria-label={`Select ${rfp.title}`}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {renderCell(rfp, column.key)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${slug}/rfps/${rfp.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(rfp.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} RFPs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <NewRfpDialog open={showNewDialog} onOpenChange={setShowNewDialog} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFP</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this RFP? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
