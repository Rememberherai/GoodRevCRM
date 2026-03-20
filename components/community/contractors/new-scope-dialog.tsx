'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  contractorId: string;
  onCreated?: () => void;
}

export function NewScopeDialog({ open, onOpenChange, projectSlug, contractorId, onCreated }: NewScopeDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [compensationTerms, setCompensationTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch existing categories from all scopes in this project
  useEffect(() => {
    if (!open) return;
    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/contractor-scopes`);
        if (!response.ok) return;
        const data = await response.json() as { scopes?: Array<{ service_categories: string[] | null }> };
        const cats = new Set<string>();
        (data.scopes ?? []).forEach((scope) => {
          (scope.service_categories ?? []).forEach((cat) => cats.add(cat.toLowerCase()));
        });
        setAllCategories(Array.from(cats).sort());
      } catch {
        // non-critical
      }
    };
    void fetchCategories();
  }, [open, projectSlug]);

  // Filter suggestions based on input
  useEffect(() => {
    if (!categoryInput.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const query = categoryInput.toLowerCase();
    const filtered = allCategories.filter(
      (cat) => cat.includes(query) && !categories.some((c) => c.toLowerCase() === cat)
    );
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [categoryInput, allCategories, categories]);

  const addCategory = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed)) {
      setCategoryInput('');
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setCategoryInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [categories]);

  const removeCategory = useCallback((index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const highlighted = suggestions[highlightedIndex];
      if (highlightedIndex >= 0 && highlighted) {
        addCategory(highlighted);
      } else if (categoryInput.trim()) {
        addCategory(categoryInput);
      }
    } else if (e.key === ',' || e.key === 'Tab') {
      if (categoryInput.trim()) {
        e.preventDefault();
        addCategory(categoryInput);
      }
    } else if (e.key === 'Backspace' && !categoryInput && categories.length > 0) {
      removeCategory(categories.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategories([]);
    setCategoryInput('');
    setCompensationTerms('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/contractor-scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          title: title.trim(),
          description: description.trim() || null,
          service_categories: categories,
          compensation_terms: compensationTerms.trim() || null,
        }),
      });

      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to create scope');

      toast.success('Scope created');
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create scope');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Contractor Scope</DialogTitle>
          <DialogDescription>
            Define the scope of work, service categories, and compensation terms.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scope-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scope-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. General Plumbing Services"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-description">Description</Label>
              <Textarea
                id="scope-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope of work..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Service Categories</Label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 min-h-[40px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {categories.map((cat, i) => (
                  <Badge key={cat} variant="secondary" className="gap-1 pl-2 pr-1">
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(i)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <div className="relative flex-1 min-w-[120px]">
                  <input
                    ref={inputRef}
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder={categories.length === 0 ? 'Type to add...' : ''}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {showSuggestions && (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md"
                    >
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={suggestion}
                          type="button"
                          className={`w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                            i === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addCategory(suggestion);
                          }}
                          onMouseEnter={() => setHighlightedIndex(i)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or comma to add. Suggestions appear from existing scopes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-compensation">Compensation Terms</Label>
              <Input
                id="scope-compensation"
                value={compensationTerms}
                onChange={(e) => setCompensationTerms(e.target.value)}
                placeholder="e.g. $45/hr, Net 30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Scope'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
