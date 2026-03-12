'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Users, MoreHorizontal, Pencil, Trash2, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePeople } from '@/hooks/use-people';
import { useColumnPreferences } from '@/hooks/use-column-preferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SendEmailModal } from '@/components/gmail';
import { BulkActionsBar } from '@/components/bulk/bulk-actions-bar';
import { BulkEnrichWithReviewModal } from '@/components/enrichment/bulk-enrich-with-review-modal';
import { EnrollInSequenceDialog } from '@/components/sequences/enrollment/enroll-in-sequence-dialog';
import { ColumnPicker } from '@/components/table/column-picker';
import { renderCellValue } from '@/lib/table-columns/renderers';
import { ClickableEmail } from '@/components/contacts/clickable-email';
import { ClickablePhone } from '@/components/contacts/clickable-phone';

export function PeoplePageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [searchInput, setSearchInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sendEmailTo, setSendEmailTo] = useState<{ email: string; personId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  const [isLoadingAllIds, setIsLoadingAllIds] = useState(false);
  const [bulkEnrichOpen, setBulkEnrichOpen] = useState(false);
  const [enrollInSequenceOpen, setEnrollInSequenceOpen] = useState(false);

  const {
    people,
    pagination,
    isLoading,
    error,
    search,
    remove,
    goToPage,
    refresh,
  } = usePeople();

  const {
    columns,
    allColumns,
    isLoading: columnsLoading,
    isSaving,
    toggleColumn,
    resetToDefaults,
  } = useColumnPreferences('person');

  const toggleSelection = (id: string) => {
    setAllPagesSelected(false);
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
    setAllPagesSelected(false);
    if (selectedIds.size === people.length && people.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(people.map((p) => p.id)));
    }
  };

  const selectAllAcrossPages = async () => {
    setIsLoadingAllIds(true);
    try {
      const params = new URLSearchParams({ limit: '10000' });
      if (searchInput) params.set('search', searchInput);
      const response = await fetch(`/api/projects/${slug}/people?${params}&fields=id`);
      if (response.ok) {
        const data = await response.json();
        const allIds = (data.people || []).map((p: { id: string }) => p.id);
        setSelectedIds(new Set(allIds));
        setAllPagesSelected(true);
      }
    } catch (err) {
      console.error('Failed to fetch all people IDs:', err);
    } finally {
      setIsLoadingAllIds(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllPagesSelected(false);
  };

  const selectedPeople = people.filter((p) => selectedIds.has(p.id));

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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  };

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`.trim();
  };

  // Render cell content based on column key
  const renderCell = (person: typeof people[0], columnKey: string) => {
    // Special handling for name column with avatar
    if (columnKey === 'name') {
      return (
        <Link
          href={`/projects/${slug}/people/${person.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={person.avatar_url ?? undefined} alt={getFullName(person.first_name, person.last_name)} />
            <AvatarFallback>{getInitials(person.first_name, person.last_name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">
              {getFullName(person.first_name, person.last_name)}
            </div>
            {person.department && (
              <div className="text-sm text-muted-foreground">
                {person.department}
              </div>
            )}
          </div>
        </Link>
      );
    }

    // Special handling for job_title with badge
    if (columnKey === 'job_title') {
      return person.job_title ? (
        <Badge variant="secondary">{person.job_title}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }

    // Special handling for email with click-to-email
    if (columnKey === 'email') {
      return (
        <div className="flex items-center gap-1">
          <ClickableEmail
            email={person.email}
            onEmailClick={() => setSendEmailTo({ email: person.email!, personId: person.id })}
            showIcon={true}
            variant="link"
          />
          {person.email_verified === true && (
            <span title="Email verified (MX)">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            </span>
          )}
          {person.email_verified === false && person.email_verified_at && (
            <span title="Email verification failed">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </span>
          )}
        </div>
      );
    }

    // Special handling for phone with click-to-dial
    if (columnKey === 'phone') {
      return (
        <ClickablePhone
          phoneNumber={person.phone}
          personId={person.id}
          showIcon={true}
          variant="link"
        />
      );
    }

    // Find the column definition and use the generic renderer
    const column = columns.find(c => c.key === columnKey);
    if (column) {
      return renderCellValue(person as unknown as Record<string, unknown>, column);
    }

    return <span className="text-muted-foreground">—</span>;
  };

  // Calculate total columns for colspan (checkbox + visible columns + actions)
  const totalColumns = columns.length + 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">People</h2>
          <p className="text-muted-foreground">
            Manage contacts and individuals in your CRM
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
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
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={people.length > 0 && selectedIds.size === people.length}
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
          {/* Select all across pages banner */}
          {selectedIds.size === people.length && people.length > 0 && pagination.total > people.length && !allPagesSelected && (
            <caption className="bg-muted/50 border-b px-4 py-2 text-sm text-center caption-bottom" style={{ captionSide: 'top' }}>
              All {people.length} people on this page are selected.{' '}
              <button
                className="text-primary underline hover:no-underline font-medium"
                onClick={selectAllAcrossPages}
                disabled={isLoadingAllIds}
              >
                {isLoadingAllIds ? 'Loading...' : `Select all ${pagination.total} people`}
              </button>
            </caption>
          )}
          {allPagesSelected && (
            <caption className="bg-primary/10 border-b px-4 py-2 text-sm text-center caption-bottom" style={{ captionSide: 'top' }}>
              All {selectedIds.size} people are selected.{' '}
              <button
                className="text-primary underline hover:no-underline font-medium"
                onClick={clearSelection}
              >
                Clear selection
              </button>
            </caption>
          )}
          <TableBody>
            {(isLoading || columnsLoading) && people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No people yet</p>
                    <p className="text-sm text-muted-foreground">
                      Add people from an organization&apos;s detail page
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              people.map((person) => (
                <TableRow key={person.id} data-state={selectedIds.has(person.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(person.id)}
                      onCheckedChange={() => toggleSelection(person.id)}
                      aria-label={`Select ${person.first_name} ${person.last_name}`}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {renderCell(person, column.key)}
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
                          <Link href={`/projects/${slug}/people/${person.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(person.id)}
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
            {pagination.total} people
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


      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Person</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this person? This action cannot be
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

      <SendEmailModal
        open={!!sendEmailTo}
        onOpenChange={(open) => { if (!open) setSendEmailTo(null); }}
        projectSlug={slug}
        defaultTo={sendEmailTo?.email ?? ''}
        personId={sendEmailTo?.personId}
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          <BulkActionsBar
            selectedCount={selectedIds.size}
            entityType="person"
            onClearSelection={clearSelection}
            onBulkAction={async () => {}}
            showEnrich
            onEnrich={() => setBulkEnrichOpen(true)}
          />
          <Button
            size="sm"
            onClick={() => setEnrollInSequenceOpen(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Enroll in Sequence
          </Button>
        </div>
      )}

      <BulkEnrichWithReviewModal
        open={bulkEnrichOpen}
        onClose={() => setBulkEnrichOpen(false)}
        selectedPeople={selectedPeople}
        projectSlug={slug}
        onComplete={() => {
          clearSelection();
          refresh();
        }}
      />

      <EnrollInSequenceDialog
        open={enrollInSequenceOpen}
        onOpenChange={setEnrollInSequenceOpen}
        projectSlug={slug}
        personIds={Array.from(selectedIds)}
        onEnrolled={() => {
          clearSelection();
        }}
      />
    </div>
  );
}
