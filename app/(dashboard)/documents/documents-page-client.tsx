'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, MoreHorizontal, Trash2, Eye, FileSignature,
  FileText, Clock, CheckCircle2, AlertTriangle, Loader2,
  Ban, Bell,
} from 'lucide-react';
import { DOCUMENT_STATUS_LABELS, type ContractDocumentStatus } from '@/types/contract';
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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { NewDocumentDialog } from '@/components/documents/new-document-dialog';

const STATUS_COLORS: Record<ContractDocumentStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  viewed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  partially_signed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  voided: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500',
};

interface Document {
  id: string;
  title: string;
  status: ContractDocumentStatus;
  original_file_name: string;
  project_id: string | null;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  projects: { name: string; slug: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function DocumentsPageClient() {
  const router = useRouter();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, awaiting: 0, completedMonth: 0, expiringSoon: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const hasFilters = searchInput.trim().length > 0 || !!statusFilter || !!sourceFilter;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
  const canBulkRemind = selectedDocs.some((d) => ['sent', 'viewed', 'partially_signed'].includes(d.status));
  const canBulkVoid = selectedDocs.some((d) => ['sent', 'viewed', 'partially_signed', 'expired', 'declined'].includes(d.status));
  const canBulkDelete = selectedDocs.some((d) => d.status === 'draft');

  const runBulkRequests = useCallback(async (
    requests: Array<Promise<Response>>,
    failureMessage: string
  ) => {
    const results = await Promise.allSettled(requests);
    const failures = results.filter((result) => result.status === 'rejected'
      || (result.status === 'fulfilled' && !result.value.ok));

    if (failures.length > 0) {
      throw new Error(failureMessage);
    }
  }, []);

  const bulkRemind = async () => {
    setBulkLoading(true);
    const remindable = selectedDocs.filter((d) => ['sent', 'viewed', 'partially_signed'].includes(d.status));
    try {
      await runBulkRequests(
        remindable.map((d) => fetch(`/api/documents/${d.id}/remind`, { method: 'POST' })),
        'Some reminders failed to send'
      );
      setSelectedIds(new Set());
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Some reminders failed to send');
    }
    setBulkLoading(false);
  };

  const bulkVoid = async () => {
    setBulkLoading(true);
    const voidable = selectedDocs.filter((d) => ['sent', 'viewed', 'partially_signed', 'expired', 'declined'].includes(d.status));
    try {
      await runBulkRequests(
        voidable.map((d) => fetch(`/api/documents/${d.id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Bulk void' }) })),
        'Some void operations failed'
      );
      setSelectedIds(new Set());
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Some void operations failed');
    }
    setBulkLoading(false);
  };

  const bulkDelete = async () => {
    setBulkLoading(true);
    const deletable = selectedDocs.filter((d) => d.status === 'draft');
    try {
      await runBulkRequests(
        deletable.map((d) => fetch(`/api/documents/${d.id}`, { method: 'DELETE' })),
        'Some delete operations failed'
      );
      setSelectedIds(new Set());
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Some delete operations failed');
    }
    setBulkLoading(false);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setPagination(data.pagination);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, sourceFilter]);

  const loadStats = useCallback(async () => {
    try {
      // Total count
      const allRes = await fetch('/api/documents?limit=1');
      const allData = allRes.ok ? await allRes.json() : { pagination: { total: 0 } };

      // Awaiting signature
      const awaitingRes = await fetch('/api/documents?limit=1&status=sent');
      const awaitingData = awaitingRes.ok ? await awaitingRes.json() : { pagination: { total: 0 } };
      const viewedRes = await fetch('/api/documents?limit=1&status=viewed');
      const viewedData = viewedRes.ok ? await viewedRes.json() : { pagination: { total: 0 } };
      const partialRes = await fetch('/api/documents?limit=1&status=partially_signed');
      const partialData = partialRes.ok ? await partialRes.json() : { pagination: { total: 0 } };

      // Completed this month
      const completedRes = await fetch('/api/documents?limit=1&status=completed');
      const completedData = completedRes.ok ? await completedRes.json() : { pagination: { total: 0 } };

      setStats({
        total: allData.pagination?.total ?? 0,
        awaiting: (awaitingData.pagination?.total ?? 0) + (viewedData.pagination?.total ?? 0) + (partialData.pagination?.total ?? 0),
        completedMonth: completedData.pagination?.total ?? 0,
        expiringSoon: 0,
      });
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [search, statusFilter, sourceFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/documents/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete');
      }
      setDocuments((prev) => prev.filter((d) => d.id !== deleteId));
      setPagination((p) => ({ ...p, total: p.total - 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeleteId(null);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Create, send, and track e-signature documents
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Document
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.awaiting}</p>
                <p className="text-xs text-muted-foreground">Awaiting Signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.completedMonth}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter ?? 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter ?? 'all'} onValueChange={(v) => setSourceFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="standalone">Standalone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-muted/50 border rounded-md px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          {canBulkRemind && (
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={bulkRemind}>
              <Bell className="mr-2 h-4 w-4" /> Remind
            </Button>
          )}
          {canBulkVoid && (
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={bulkVoid}>
              <Ban className="mr-2 h-4 w-4" /> Void
            </Button>
          )}
          {canBulkDelete && (
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={bulkDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm flex items-center justify-between">
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {/* Documents Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={documents.length > 0 && selectedIds.size === documents.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="h-12">
                    <div className="animate-pulse h-4 bg-muted rounded w-48" />
                  </TableCell>
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <FileSignature className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>{hasFilters ? 'No documents match your filters' : 'No documents yet'}</p>
                  <p className="text-sm mt-1">
                    {hasFilters ? 'Try clearing your search or filters.' : 'Upload your first document to get started.'}
                  </p>
                  {hasFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setSearchInput('');
                        setSearch('');
                        setStatusFilter(null);
                        setSourceFilter(null);
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowNewDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Upload Document
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={() => toggleSelect(doc.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-muted-foreground">{doc.original_file_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[doc.status] ?? ''} variant="secondary">
                      {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc.projects ? (
                      <Link
                        href={`/projects/${doc.projects.slug}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {doc.projects.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Standalone</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(doc.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(doc.sent_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/documents/${doc.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Link>
                        </DropdownMenuItem>
                        {doc.status === 'draft' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(doc.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
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

      <NewDocumentDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={(documentId) => {
          if (documentId) {
            router.push(`/documents/${documentId}`);
          } else {
            loadDocuments();
          }
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
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

      {isLoading && documents.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
