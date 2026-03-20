'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  onCreated?: () => void;
}

export function AddContractorDialog({ open, onOpenChange, projectSlug, onCreated }: AddContractorDialogProps) {
  // Person fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Scope fields
  const [scopeTitle, setScopeTitle] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [compensationTerms, setCompensationTerms] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing categories
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

  // Filter suggestions
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

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setScopeTitle('');
    setScopeDescription('');
    setCategories([]);
    setCategoryInput('');
    setCompensationTerms('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!scopeTitle.trim()) {
      toast.error('Scope title is required');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create the person with is_contractor = true
      const personResponse = await fetch(`/api/projects/${projectSlug}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          is_contractor: true,
          force_create: true,
        }),
      });

      const personData = await personResponse.json() as { person?: { id: string }; error?: string };
      if (!personResponse.ok || !personData.person) {
        throw new Error(personData.error ?? 'Failed to create person');
      }

      const personId = personData.person.id;

      // Step 2: Create the scope
      const scopeResponse = await fetch(`/api/projects/${projectSlug}/contractor-scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: personId,
          title: scopeTitle.trim(),
          description: scopeDescription.trim() || null,
          service_categories: categories,
          compensation_terms: compensationTerms.trim() || null,
        }),
      });

      const scopeData = await scopeResponse.json() as { error?: string };
      if (!scopeResponse.ok) {
        // Person was created but scope failed — still notify
        toast.warning(`Contractor created but scope failed: ${scopeData.error ?? 'Unknown error'}. Add scope manually.`);
      } else {
        toast.success('Contractor added with scope');
      }

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contractor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contractor</DialogTitle>
          <DialogDescription>
            Create a new contractor with their scope of work in one step.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Person section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractor-first-name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contractor-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-last-name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contractor-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractor-email">Email</Label>
                <Input
                  id="contractor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-phone">Phone</Label>
                <Input
                  id="contractor-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <Separator />

            {/* Scope section */}
            <div className="space-y-2">
              <Label htmlFor="contractor-scope-title">
                Scope Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contractor-scope-title"
                value={scopeTitle}
                onChange={(e) => setScopeTitle(e.target.value)}
                placeholder="e.g. General Plumbing Services"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-scope-desc">Description</Label>
              <Textarea
                id="contractor-scope-desc"
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Describe the scope of work..."
                rows={2}
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
                    onKeyDown={handleCategoryKeyDown}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder={categories.length === 0 ? 'Type to add...' : ''}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {showSuggestions && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
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
                Press Enter or comma to add.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-compensation">Compensation Terms</Label>
              <Input
                id="contractor-compensation"
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
              {submitting ? 'Adding...' : 'Add Contractor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
