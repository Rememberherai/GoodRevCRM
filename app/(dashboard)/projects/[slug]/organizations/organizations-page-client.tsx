'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Building2, MoreHorizontal, Pencil, Trash2, Upload, ClipboardPaste, Sparkles, Droplets, UserSearch, Mail } from 'lucide-react';
import { useOrganizations } from '@/hooks/use-organizations';
import { useColumnPreferences } from '@/hooks/use-column-preferences';
import { useEntityCustomFields } from '@/hooks/use-custom-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { NewOrganizationDialog } from '@/components/organizations/new-organization-dialog';
import { BulkAddDialog } from '@/components/organizations/bulk-add-dialog';
import { OrgImportDialog } from '@/components/organizations/org-import-dialog';
import { BulkResearchDialog } from '@/components/research/bulk-research-dialog';
import { BulkContactDiscoveryDialog } from '@/components/organizations/bulk-contact-discovery-dialog';
import { BulkGenericEmailDialog } from '@/components/organizations/bulk-generic-email-dialog';
import { EPAImportDialog } from '@/components/organizations/epa-import-dialog';
import { ColumnPicker } from '@/components/table/column-picker';
import { renderCellValue } from '@/lib/table-columns/renderers';
import { DispositionCell } from '@/components/dispositions/disposition-cell';
import { useDispositions } from '@/hooks/use-dispositions';
import { useOrganizationStore, updateOrganizationApi } from '@/stores/organization';
import { AdvancedFilterBar } from '@/components/filters/advanced-filter-bar';
import { getOrganizationFilterDefinitions } from '@/types/filters';

export function OrganizationsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [showBulkResearchDialog, setShowBulkResearchDialog] = useState(false);
  const [showBulkContactDiscoveryDialog, setShowBulkContactDiscoveryDialog] = useState(false);
  const [showBulkGenericEmailDialog, setShowBulkGenericEmailDialog] = useState(false);
  const [showEPAImportDialog, setShowEPAImportDialog] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  const [isLoadingAllIds, setIsLoadingAllIds] = useState(false);

  const toggleSelection = (id: string) => {
    setAllPagesSelected(false);
    setSelectedIds(prev => {
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
    if (selectedIds.size === organizations.length && organizations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(organizations.map(org => org.id)));
    }
  };

  const selectAllAcrossPages = async () => {
    setIsLoadingAllIds(true);
    try {
      const params = new URLSearchParams({ limit: '10000' });
      if (searchInput) params.set('search', searchInput);
      if (filters.length > 0) params.set('filters', JSON.stringify(filters));
      const response = await fetch(`/api/projects/${slug}/organizations?${params}&fields=id`);
      if (response.ok) {
        const data = await response.json();
        const allIds = (data.organizations || []).map((o: { id: string }) => o.id);
        setSelectedIds(new Set(allIds));
        setAllPagesSelected(true);
      }
    } catch (err) {
      console.error('Failed to fetch all org IDs:', err);
    } finally {
      setIsLoadingAllIds(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllPagesSelected(false);
  };

  const {
    organizations,
    pagination,
    isLoading,
    error,
    search,
    remove,
    goToPage,
    refresh,
    filters,
    setFilters,
  } = useOrganizations();

  const { fields: customFields } = useEntityCustomFields('organization');
  const { dispositions } = useDispositions('organization');
  const updateOrgInStore = useOrganizationStore((s) => s.updateOrganization);

  const filterDefinitions = useMemo(
    () => getOrganizationFilterDefinitions(
      dispositions.map((d) => ({ label: d.name, value: d.id }))
    ),
    [dispositions]
  );

  const {
    columns,
    allColumns,
    isLoading: columnsLoading,
    isSaving,
    toggleColumn,
    resetToDefaults,
  } = useColumnPreferences('organization', { customFields });

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Render cell content based on column key
  const renderCell = (org: typeof organizations[0], columnKey: string) => {
    // Special handling for name column with avatar
    if (columnKey === 'name') {
      return (
        <Link
          href={`/projects/${slug}/organizations/${org.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={org.logo_url ?? undefined} alt={org.name} />
            <AvatarFallback>{getInitials(org.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{org.name}</div>
            {org.domain && (
              <div className="text-sm text-muted-foreground">
                {org.domain}
              </div>
            )}
          </div>
        </Link>
      );
    }

    // Inline-editable disposition
    if (columnKey === 'disposition') {
      return (
        <DispositionCell
          dispositionId={org.disposition_id ?? null}
          dispositions={dispositions}
          onUpdate={async (newId) => {
            await updateOrganizationApi(slug, org.id, { disposition_id: newId });
            updateOrgInStore(org.id, { disposition_id: newId });
          }}
        />
      );
    }

    // Special handling for industry with badge
    if (columnKey === 'industry') {
      return org.industry ? (
        <Badge variant="secondary">{org.industry}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }

    // Find the column definition and use the generic renderer
    const column = columns.find(c => c.key === columnKey);
    if (column) {
      return renderCellValue(org as unknown as Record<string, unknown>, column);
    }

    return <span className="text-muted-foreground">—</span>;
  };

  // Calculate total columns for colspan (checkbox + visible columns + actions)
  const totalColumns = columns.length + 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-muted-foreground">
            Manage companies and organizations in your CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" onClick={() => setShowBulkContactDiscoveryDialog(true)}>
                <UserSearch className="mr-2 h-4 w-4" />
                Find People ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={() => setShowBulkGenericEmailDialog(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Find Dept Emails ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={() => setShowBulkResearchDialog(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Research ({selectedIds.size})
              </Button>
            </>
          )}
          {slug === 'lillianah' && (
            <Button variant="outline" onClick={() => setShowEPAImportDialog(true)}>
              <Droplets className="mr-2 h-4 w-4" />
              Import EPA POTWs
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowBulkAddDialog(true)}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Bulk Add
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
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

      <AdvancedFilterBar
        filterDefinitions={filterDefinitions}
        activeFilters={filters}
        onFiltersChange={setFilters}
      />

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
                  checked={selectedIds.size === organizations.length && organizations.length > 0}
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
          {selectedIds.size === organizations.length && organizations.length > 0 && pagination.total > organizations.length && !allPagesSelected && (
            <caption className="bg-muted/50 border-b px-4 py-2 text-sm text-center caption-bottom" style={{ captionSide: 'top' }}>
              All {organizations.length} organizations on this page are selected.{' '}
              <button
                className="text-primary underline hover:no-underline font-medium"
                onClick={selectAllAcrossPages}
                disabled={isLoadingAllIds}
              >
                {isLoadingAllIds ? 'Loading...' : `Select all ${pagination.total} organizations`}
              </button>
            </caption>
          )}
          {allPagesSelected && (
            <caption className="bg-primary/10 border-b px-4 py-2 text-sm text-center caption-bottom" style={{ captionSide: 'top' }}>
              All {selectedIds.size} organizations are selected.{' '}
              <button
                className="text-primary underline hover:no-underline font-medium"
                onClick={clearSelection}
              >
                Clear selection
              </button>
            </caption>
          )}
          <TableBody>
            {(isLoading || columnsLoading) && organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No organizations yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first organization
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(org.id)}
                      onCheckedChange={() => toggleSelection(org.id)}
                      aria-label={`Select ${org.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {renderCell(org, column.key)}
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
                          <Link href={`/projects/${slug}/organizations/${org.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(org.id)}
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
            {pagination.total} organizations
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

      <NewOrganizationDialog open={showNewDialog} onOpenChange={setShowNewDialog} />

      <BulkAddDialog open={showBulkAddDialog} onOpenChange={setShowBulkAddDialog} />

      <BulkResearchDialog
        open={showBulkResearchDialog}
        onOpenChange={setShowBulkResearchDialog}
        organizationIds={Array.from(selectedIds)}
        onComplete={() => {
          clearSelection();
          refresh();
        }}
      />

      <BulkContactDiscoveryDialog
        open={showBulkContactDiscoveryDialog}
        onOpenChange={setShowBulkContactDiscoveryDialog}
        organizationIds={Array.from(selectedIds)}
        onComplete={() => {
          clearSelection();
          refresh();
        }}
      />

      <BulkGenericEmailDialog
        open={showBulkGenericEmailDialog}
        onOpenChange={setShowBulkGenericEmailDialog}
        organizationIds={Array.from(selectedIds)}
        onComplete={() => {
          clearSelection();
          refresh();
        }}
      />

      {slug === 'lillianah' && (
        <EPAImportDialog
          open={showEPAImportDialog}
          onOpenChange={setShowEPAImportDialog}
          onComplete={refresh}
        />
      )}

      <OrgImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={() => {
          setShowImportDialog(false);
          refresh();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this organization? This action cannot be
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
