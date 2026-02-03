'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  Upload,
  Library,
  Trash2,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { useContentLibrary } from '@/hooks/use-content-library';
import { CONTENT_CATEGORIES, CATEGORY_LABELS, type ContentCategory } from '@/types/rfp-content-library';
import type { ContentLibraryEntry } from '@/types/rfp-content-library';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContentLibraryUpload } from '@/components/rfps/content-library-upload';

export function ContentLibraryPageClient() {
  const {
    entries,
    totalCount,
    isLoading,
    error,
    categoryFilter,
    searchQuery: _searchQuery,
    refresh,
    create,
    update,
    remove,
    filterByCategory,
    setSearch,
  } = useContentLibrary();

  const [searchInput, setSearchInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentLibraryEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add/edit entry form state
  const [formTitle, setFormTitle] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      setDeleteId(null);
    } catch {
      // Error handled by hook
    }
  };

  const openEditForm = (entry: ContentLibraryEntry) => {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    setFormQuestion(entry.question_text ?? '');
    setFormAnswer(entry.answer_text);
    setFormCategory(entry.category ?? '');
    setFormTags((entry.tags ?? []).join(', '));
    setShowAddEntry(true);
  };

  const openNewForm = () => {
    setEditingEntry(null);
    setFormTitle('');
    setFormQuestion('');
    setFormAnswer('');
    setFormCategory('');
    setFormTags('');
    setShowAddEntry(true);
  };

  const handleFormSubmit = async () => {
    if (!formTitle.trim() || !formAnswer.trim()) return;
    setIsSubmitting(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const data = {
        title: formTitle.trim(),
        question_text: formQuestion.trim() || null,
        answer_text: formAnswer.trim(),
        category: (formCategory || null) as ContentCategory | null,
        tags,
      };

      if (editingEntry) {
        await update(editingEntry.id, data);
      } else {
        await create(data);
      }

      setShowAddEntry(false);
      refresh();
    } catch {
      // Error handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Library</h2>
          <p className="text-muted-foreground">
            Reusable Q&A content for RFP responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowUpload(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
          <Button onClick={openNewForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search library..."
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
          value={categoryFilter ?? 'all'}
          onValueChange={(v) => filterByCategory(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CONTENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {isLoading && entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 border rounded-md">
          <Library className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-1">No content library entries yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a document or add entries manually to build your answer bank.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
            <Button onClick={openNewForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{totalCount} entries</p>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{entry.title}</h3>
                  {entry.question_text && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Q: {entry.question_text}
                    </p>
                  )}
                  <p className="text-sm mt-1 line-clamp-2">{entry.answer_text}</p>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {entry.category && (
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[entry.category as ContentCategory] ?? entry.category}
                      </Badge>
                    )}
                    {entry.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {entry.source_document_name && (
                      <span className="text-xs text-muted-foreground ml-1">
                        from {entry.source_document_name}
                      </span>
                    )}
                    {entry.usage_count > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        Used {entry.usage_count}x
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditForm(entry)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteId(entry.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <ContentLibraryUpload
        open={showUpload}
        onOpenChange={setShowUpload}
        onUploaded={() => {
          setShowUpload(false);
          refresh();
        }}
      />

      {/* Add/Edit entry dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Edit Entry' : 'Add Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="entry-title">Title *</Label>
              <Input
                id="entry-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Short descriptive title"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="entry-question">Question (optional)</Label>
              <Textarea
                id="entry-question"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="What question does this answer?"
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="entry-answer">Answer *</Label>
              <Textarea
                id="entry-answer"
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                placeholder="The reusable answer content..."
                rows={6}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select
                  value={formCategory || 'none'}
                  onValueChange={(v) => setFormCategory(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CONTENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entry-tags">Tags (comma-separated)</Label>
                <Input
                  id="entry-tags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="e.g., soc2, encryption"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddEntry(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleFormSubmit}
                disabled={isSubmitting || !formTitle.trim() || !formAnswer.trim()}
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingEntry
                    ? 'Save Changes'
                    : 'Add Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
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
