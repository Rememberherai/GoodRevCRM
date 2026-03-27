'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export const ANSWER_BANK_CATEGORIES = [
  { value: 'mission_statement', label: 'Mission Statement' },
  { value: 'org_history', label: 'Org History' },
  { value: 'program_description', label: 'Program Description' },
  { value: 'target_population', label: 'Target Population' },
  { value: 'budget_narrative', label: 'Budget Narrative' },
  { value: 'evaluation_plan', label: 'Evaluation Plan' },
  { value: 'sustainability', label: 'Sustainability' },
  { value: 'letters_of_support', label: 'Letters of Support' },
  { value: 'other', label: 'Other' },
] as const;

export type AnswerBankCategory = typeof ANSWER_BANK_CATEGORIES[number]['value'];

export interface AnswerBankEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

function getCategoryLabel(value: string) {
  return ANSWER_BANK_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function EntryDialog({
  open,
  onOpenChange,
  entry,
  slug,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AnswerBankEntry | null;
  slug: string;
  onSaved: (entry: AnswerBankEntry) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AnswerBankCategory>('other');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(entry?.title ?? '');
      setCategory((entry?.category as AnswerBankCategory) ?? 'other');
      setContent(entry?.content ?? '');
    }
  }, [open, entry]);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const url = entry
        ? `/api/projects/${slug}/grants/answer-bank/${entry.id}`
        : `/api/projects/${slug}/grants/answer-bank`;
      const method = entry ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category, content: content.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      const data = await res.json();
      onSaved(data.entry);
      onOpenChange(false);
      toast.success(entry ? 'Entry updated' : 'Entry saved to Answer Bank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Entry' : 'New Answer Bank Entry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mission Statement" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AnswerBankCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANSWER_BANK_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the reusable narrative text..."
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnswerBankPageClient() {
  const params = useParams();
  const slug = params.slug as string;

  const [entries, setEntries] = useState<AnswerBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AnswerBankEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await fetch(`/api/projects/${slug}/grants/answer-bank?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error('Failed to load Answer Bank');
    } finally {
      setLoading(false);
    }
  }, [slug, search, categoryFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function handleDelete(entry: AnswerBankEntry) {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/answer-bank/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    }
  }

  function handleSaved(saved: AnswerBankEntry) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Answer Bank
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable narrative snippets for grant applications
          </p>
        </div>
        <Button onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ANSWER_BANK_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No entries yet</p>
          <p className="text-sm mt-1">Save reusable narratives to speed up grant writing</p>
          <Button className="mt-4" onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Entry
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-base truncate">{entry.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {getCategoryLabel(entry.category)}
                    </Badge>
                    {entry.usage_count > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Used {entry.usage_count}×
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingEntry(entry); setDialogOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {entry.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        slug={slug}
        onSaved={handleSaved}
      />
    </div>
  );
}
