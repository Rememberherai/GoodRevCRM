'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal, Trash2, Copy, Loader2, LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_name: string;
  page_count: number;
  use_count: number;
  project_id: string | null;
  created_at: string;
  projects: { name: string; slug: string } | null;
}

export function TemplatesPageClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createFromTemplate, setCreateFromTemplate] = useState<Template | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/documents/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/documents/templates/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete');
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeleteId(null);
  };

  const handleCreateFromTemplate = async () => {
    if (!createFromTemplate) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/documents/templates/${createFromTemplate.id}/create-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: docTitle.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create document');
      }
      const data = await res.json();
      setCreateFromTemplate(null);
      setDocTitle('');
      if (data.document?.id) {
        router.push(`/documents/${data.document.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setCreating(false);
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Reusable document templates for quick signing
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm flex items-center justify-between">
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="h-12">
                    <div className="animate-pulse h-4 bg-muted rounded w-48" />
                  </TableCell>
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <LayoutTemplate className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No templates yet</p>
                  <p className="text-sm mt-1">
                    Templates from your projects will appear here automatically.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {template.category ? (
                      <Badge variant="outline">{template.category}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {template.projects ? (
                      <span className="text-muted-foreground">{template.projects.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Standalone</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{template.page_count}</TableCell>
                  <TableCell className="text-sm">{template.use_count ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(template.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setDocTitle(template.name);
                            setCreateFromTemplate(template);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Create Document
                        </DropdownMenuItem>
                        {!template.project_id && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(template.id)}
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

      {/* Create from Template Dialog */}
      <Dialog open={!!createFromTemplate} onOpenChange={(open) => !open && setCreateFromTemplate(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Document from Template</DialogTitle>
            <DialogDescription>
              A new document will be created from &quot;{createFromTemplate?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder={createFromTemplate?.name ?? 'Document title'}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFromTemplate(null)}>Cancel</Button>
            <Button onClick={handleCreateFromTemplate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
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
