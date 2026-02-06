'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Search,
  UserPlus,
  Check,
  X,
  Linkedin,
  Mail,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { DiscoveredContact } from '@/types/contact-discovery';
import type { ProjectSettings } from '@/types/project';

interface ContactDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onContactsAdded: () => void;
}

type DialogStep = 'input' | 'searching' | 'results' | 'adding' | 'success';

const STANDARD_ROLE_SUGGESTIONS = [
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'VP Engineering',
  'VP Sales',
  'VP Marketing',
  'VP Product',
  'Director of Engineering',
  'Director of Sales',
  'Head of Product',
  'Head of Marketing',
];

export function ContactDiscoveryDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onContactsAdded,
}: ContactDiscoveryDialogProps) {
  const params = useParams();
  const slug = params.slug as string;

  // State for custom roles fetched from project settings
  const [customRoles, setCustomRoles] = useState<string[]>([]);

  // Fetch custom roles and check for contact providers when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch project settings for custom roles
      fetch(`/api/projects/${slug}/settings`)
        .then((res) => res.json())
        .then((data) => {
          const settings = data.settings as ProjectSettings | undefined;
          setCustomRoles(settings?.customRoles ?? []);
        })
        .catch((err) => {
          console.error('Failed to fetch project settings:', err);
        });

      // Check if contact providers are configured
      fetch(`/api/projects/${slug}/settings/contact-providers`)
        .then((res) => res.json())
        .then((data) => {
          const providers = data.providers || {};
          const hasEnabled = Object.values(providers).some(
            (p: unknown) => (p as { enabled?: boolean; apiKeyMasked?: string })?.enabled && (p as { apiKeyMasked?: string })?.apiKeyMasked
          );
          setHasProviders(hasEnabled);
        })
        .catch(() => {
          setHasProviders(false);
        });
    }
  }, [open, slug]);

  // Merge custom roles with standard suggestions (custom first, then standard)
  const roleSuggestions = useMemo(() => {
    const combined = [...customRoles];
    for (const role of STANDARD_ROLE_SUGGESTIONS) {
      if (!combined.some((r) => r.toLowerCase() === role.toLowerCase())) {
        combined.push(role);
      }
    }
    return combined;
  }, [customRoles]);

  const [step, setStep] = useState<DialogStep>('input');
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [hasProviders, setHasProviders] = useState<boolean | null>(null);

  const handleClose = () => {
    // Reset state
    setStep('input');
    setRoles([]);
    setRoleInput('');
    setContacts([]);
    setSelectedIds(new Set());
    setNotes(undefined);
    setError(null);
    setAddedCount(0);
    setProviderUsed(null);
    onOpenChange(false);
  };

  const addRole = (role: string) => {
    const trimmed = role.trim();
    if (trimmed && !roles.includes(trimmed) && roles.length < 20) {
      setRoles([...roles, trimmed]);

      // Auto-save custom role if it's not in the standard suggestions
      const isStandard = STANDARD_ROLE_SUGGESTIONS.some(
        (r) => r.toLowerCase() === trimmed.toLowerCase()
      );
      const isAlreadySaved = customRoles.some(
        (r) => r.toLowerCase() === trimmed.toLowerCase()
      );

      if (!isStandard && !isAlreadySaved) {
        // Update local state immediately so it shows in suggestions
        setCustomRoles((prev) => [...prev, trimmed]);

        // Fire-and-forget save to project settings
        fetch(`/api/projects/${slug}/settings/custom-roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: trimmed }),
        }).catch((err) => {
          console.error('Failed to save custom role:', err);
        });
      }
    }
    setRoleInput('');
  };

  const removeRole = (role: string) => {
    setRoles(roles.filter((r) => r !== role));
  };

  const handleRoleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRole(roleInput);
    }
  };

  const handleSearch = async () => {
    if (roles.length === 0) {
      setError('Please add at least one role to search for');
      return;
    }

    setError(null);
    setStep('searching');

    try {
      // Use search-contacts (waterfall) if providers are configured, otherwise fall back to discover-contacts (LLM)
      const endpoint = hasProviders
        ? `/api/projects/${slug}/organizations/${organizationId}/search-contacts`
        : `/api/projects/${slug}/organizations/${organizationId}/discover-contacts`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles, max_results: 15 }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If search-contacts fails due to no providers, fall back to discover-contacts
        if (hasProviders && data.error?.includes('No contact discovery providers')) {
          setHasProviders(false);
          const fallbackResponse = await fetch(
            `/api/projects/${slug}/organizations/${organizationId}/discover-contacts`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roles, max_results: 15 }),
            }
          );
          const fallbackData = await fallbackResponse.json();
          if (!fallbackResponse.ok) {
            throw new Error(fallbackData.error ?? 'Failed to discover contacts');
          }
          setContacts(fallbackData.contacts ?? []);
          setNotes(fallbackData.notes);
          setProviderUsed(null);
        } else {
          throw new Error(data.error ?? 'Failed to discover contacts');
        }
      } else {
        // If waterfall returned no contacts, fall back to AI discovery
        if (hasProviders && (!data.contacts || data.contacts.length === 0)) {
          const fallbackResponse = await fetch(
            `/api/projects/${slug}/organizations/${organizationId}/discover-contacts`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roles, max_results: 15 }),
            }
          );
          const fallbackData = await fallbackResponse.json();
          if (fallbackResponse.ok && fallbackData.contacts?.length > 0) {
            setContacts(fallbackData.contacts);
            setNotes(fallbackData.notes);
            setProviderUsed('AI (fallback)');
          } else {
            // No results from either source
            setContacts([]);
            setNotes(data.notes);
            setProviderUsed(data.provider_used ?? null);
          }
        } else {
          setContacts(data.contacts ?? []);
          setNotes(data.notes);
          setProviderUsed(data.provider_used ?? null);
        }
      }

      // Auto-select all contacts with confidence >= 0.7
      const autoSelected = new Set<string>(
        (contacts.length > 0 ? contacts : data.contacts ?? [])
          .filter((c: DiscoveredContact) => c.confidence >= 0.7)
          .map((c: DiscoveredContact) => c.id)
      );
      setSelectedIds(autoSelected);

      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover contacts');
      setStep('input');
    }
  };

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(contacts.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleAddContacts = async () => {
    const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
    if (selectedContacts.length === 0) {
      setError('Please select at least one contact to add');
      return;
    }

    setError(null);
    setStep('adding');

    try {
      const response = await fetch(
        `/api/projects/${slug}/organizations/${organizationId}/add-contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacts: selectedContacts.map((c) => ({
              first_name: c.first_name ?? c.name.split(' ')[0] ?? 'Unknown',
              last_name: c.last_name ?? c.name.split(' ').slice(1).join(' ') ?? '',
              email: c.email ?? undefined,
              job_title: c.title ?? undefined,
              linkedin_url: c.linkedin_url ?? undefined,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add contacts');
      }

      setAddedCount(data.created_count ?? 0);
      setStep('success');
      toast.success(`Added ${data.created_count} contact${data.created_count !== 1 ? 's' : ''}`);
      onContactsAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contacts');
      setStep('results');
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge variant="default" className="bg-green-500">High</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge variant="secondary">Medium</Badge>;
    }
    return <Badge variant="outline">Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Find People at {organizationName}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Enter the roles or titles you want to find at this company.'}
            {step === 'searching' && 'Searching for contacts...'}
            {step === 'results' && `Found ${contacts.length} potential contact${contacts.length !== 1 ? 's' : ''}`}
            {step === 'adding' && 'Adding contacts...'}
            {step === 'success' && `Successfully added ${addedCount} contact${addedCount !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Role Input */}
        {step === 'input' && (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Roles to find</Label>
              <div className="flex gap-2">
                <Input
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={handleRoleInputKeyDown}
                  placeholder="Enter a role (e.g., CTO)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addRole(roleInput)}
                  disabled={!roleInput.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {roles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary" className="gap-1 pl-2">
                    {role}
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Quick add suggestions</Label>
              <div className="flex flex-wrap gap-1">
                {roleSuggestions.filter((r) => !roles.includes(r)).map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addRole(suggestion)}
                  >
                    + {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Searching */}
        {step === 'searching' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Searching for contacts...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {contacts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2" />
                <p>No contacts found for the specified roles.</p>
                {notes && <p className="mt-2 text-sm">{notes}</p>}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} of {contacts.length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[300px] rounded-md border p-2">
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedIds.has(contact.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleContact(contact.id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {getConfidenceBadge(contact.confidence)}
                          </div>
                          {contact.title && (
                            <p className="text-sm text-muted-foreground">{contact.title}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {contact.email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                            {contact.linkedin_url && (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                              >
                                <Linkedin className="h-3 w-3" />
                                LinkedIn
                              </a>
                            )}
                          </div>
                          {contact.source_hint && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {contact.source_hint}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {providerUsed && (
                  <p className="text-sm text-muted-foreground">
                    Found via {providerUsed}
                  </p>
                )}
                {notes && (
                  <p className="text-sm text-muted-foreground italic">{notes}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4: Adding */}
        {step === 'adding' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Adding contacts...</p>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="mt-4 font-medium">
              Added {addedCount} contact{addedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              They are now linked to {organizationName}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={roles.length === 0}
              >
                <Search className="mr-2 h-4 w-4" />
                Find People
              </Button>
            </>
          )}

          {step === 'results' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleAddContacts}
                disabled={selectedIds.size === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {step === 'success' && (
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
