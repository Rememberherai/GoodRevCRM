'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Target, DollarSign, MoreHorizontal, Pencil, Trash2, Calendar } from 'lucide-react';
import { useOpportunities } from '@/hooks/use-opportunities';
import { useColumnPreferences } from '@/hooks/use-column-preferences';
import { STAGE_LABELS, OPPORTUNITY_STAGES, type OpportunityStage } from '@/types/opportunity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { NewOpportunityDialog } from '@/components/opportunities/new-opportunity-dialog';
import { ColumnPicker } from '@/components/table/column-picker';
import { renderCellValue } from '@/lib/table-columns/renderers';

const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospecting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  qualification: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  proposal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  closed_won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed_lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function OpportunitiesPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    opportunities,
    pagination,
    isLoading,
    error,
    stageFilter,
    search,
    remove,
    filterByStage,
    goToPage,
  } = useOpportunities();

  const {
    columns,
    allColumns,
    isLoading: columnsLoading,
    isSaving,
    toggleColumn,
    resetToDefaults,
  } = useColumnPreferences('opportunity');

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

  // Render cell content based on column key
  const renderCell = (opp: typeof opportunities[0], columnKey: string) => {
    // Special handling for name column
    if (columnKey === 'name') {
      return (
        <>
          <Link
            href={`/projects/${slug}/opportunities/${opp.id}`}
            className="font-medium hover:underline"
          >
            {opp.name}
          </Link>
          {opp.description && (
            <div className="text-sm text-muted-foreground truncate max-w-[250px]">
              {opp.description}
            </div>
          )}
        </>
      );
    }

    // Special handling for stage with colored badge
    if (columnKey === 'stage') {
      return (
        <Badge className={STAGE_COLORS[opp.stage]} variant="secondary">
          {STAGE_LABELS[opp.stage]}
        </Badge>
      );
    }

    // Special handling for amount with icon
    if (columnKey === 'amount') {
      return (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {formatCurrency(opp.amount, opp.currency)}
        </div>
      );
    }

    // Special handling for expected_close_date with icon
    if (columnKey === 'expected_close_date') {
      return (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {formatDate(opp.expected_close_date)}
        </div>
      );
    }

    // Find the column definition and use the generic renderer
    const column = columns.find(c => c.key === columnKey);
    if (column) {
      return renderCellValue(opp as unknown as Record<string, unknown>, column);
    }

    return <span className="text-muted-foreground">—</span>;
  };

  // Calculate total columns for colspan
  const totalColumns = columns.length + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Opportunities</h2>
          <p className="text-muted-foreground">
            Track sales opportunities and deals through your pipeline
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Opportunity
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
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
          value={stageFilter ?? 'all'}
          onValueChange={(value) => filterByStage(value === 'all' ? null : value as OpportunityStage)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {OPPORTUNITY_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABELS[stage]}
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
            {(isLoading || columnsLoading) && opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Target className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No opportunities yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first opportunity
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opp) => (
                <TableRow key={opp.id}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {renderCell(opp, column.key)}
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
                          <Link href={`/projects/${slug}/opportunities/${opp.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(opp.id)}
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
            {pagination.total} opportunities
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

      <NewOpportunityDialog open={showNewDialog} onOpenChange={setShowNewDialog} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this opportunity? This action cannot be
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
