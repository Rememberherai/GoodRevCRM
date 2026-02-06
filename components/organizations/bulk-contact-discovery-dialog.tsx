'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type {
  OrganizationDiscoveryResult,
  BulkDiscoveryProgress,
  BulkContactSelection,
} from '@/types/contact-discovery';
import type { ProjectSettings } from '@/types/project';

interface BulkContactDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationIds: string[];
  onComplete?: () => void;
}

type DialogStep = 'input' | 'discovering' | 'results' | 'adding' | 'success';

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

const CONCURRENCY_LIMIT = 3;
const DELAY_BETWEEN_BATCHES = 200;

export function BulkContactDiscoveryDialog({
  open,
  onOpenChange,
  organizationIds,
  onComplete,
}: BulkContactDiscoveryDialogProps) {
  const params = useParams();
  const slug = params.slug as string;

  // Custom roles from project settings
  const [customRoles, setCustomRoles] = useState<string[]>([]);

  // Step state
  const [step, setStep] = useState<DialogStep>('input');
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Discovery progress state
  const [progress, setProgress] = useState<BulkDiscoveryProgress>({
    status: 'idle',
    current: 0,
    total: organizationIds.length,
    completed: 0,
    failed: 0,
    results: [],
  });

  // Selection state for results
  const [selections, setSelections] = useState<BulkContactSelection>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Adding state
  const [addedCount, setAddedCount] = useState(0);
  const [addedOrgsCount, setAddedOrgsCount] = useState(0);

  // Abort ref for cancellation
  const abortRef = useRef(false);

  // Check if contact providers are configured
  const [hasProviders, setHasProviders] = useState<boolean | null>(null);

  // Fetch custom roles and check for providers when dialog opens
  useEffect(() => {
    if (open) {
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setRoles([]);
      setRoleInput('');
      setError(null);
      setProgress({
        status: 'idle',
        current: 0,
        total: organizationIds.length,
        completed: 0,
        failed: 0,
        results: [],
      });
      setSelections({});
      setExpandedOrgs(new Set());
      setAddedCount(0);
      setAddedOrgsCount(0);
      abortRef.current = false;
    }
  }, [open, organizationIds.length]);

  // Merge custom roles with standard suggestions
  const roleSuggestions = useMemo(() => {
    const combined = [...customRoles];
    for (const role of STANDARD_ROLE_SUGGESTIONS) {
      if (!combined.some((r) => r.toLowerCase() === role.toLowerCase())) {
        combined.push(role);
      }
    }
    return combined;
  }, [customRoles]);

  // Computed values for results
  const successfulResults = useMemo(
    () => progress.results.filter((r) => r.status === 'success'),
    [progress.results]
  );

  const totalContacts = useMemo(
    () => successfulResults.reduce((sum, r) => sum + r.contacts.length, 0),
    [successfulResults]
  );

  const totalSelected = useMemo(
    () => Object.values(selections).reduce((sum, set) => sum + set.size, 0),
    [selections]
  );

  const handleClose = () => {
    if (progress.status === 'discovering') {
      return; // Don't close while discovering
    }
    if (step === 'success') {
      onComplete?.();
    }
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
        setCustomRoles((prev) => [...prev, trimmed]);
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

  const handleStartDiscovery = async () => {
    if (roles.length === 0) {
      setError('Please add at least one role to search for');
      return;
    }

    setError(null);
    setStep('discovering');
    setProgress((prev) => ({ ...prev, status: 'discovering' }));
    abortRef.current = false;

    const results: OrganizationDiscoveryResult[] = [];

    // Process in batches with concurrency limit
    for (let i = 0; i < organizationIds.length; i += CONCURRENCY_LIMIT) {
      if (abortRef.current) {
        setProgress((prev) => ({ ...prev, status: 'cancelled' }));
        break;
      }

      const batch = organizationIds.slice(i, i + CONCURRENCY_LIMIT);

      const batchPromises = batch.map(async (orgId) => {
        // First fetch org name
        let orgName = 'Organization';
        try {
          const orgResponse = await fetch(`/api/projects/${slug}/organizations/${orgId}`);
          if (orgResponse.ok) {
            const orgData = await orgResponse.json();
            orgName = orgData.organization?.name ?? orgName;
          }
        } catch {
          // Continue with default name
        }

        try {
          // Use search-contacts (waterfall) if providers are configured, otherwise fall back to discover-contacts (LLM)
          const endpoint = hasProviders
            ? `/api/projects/${slug}/organizations/${orgId}/search-contacts`
            : `/api/projects/${slug}/organizations/${orgId}/discover-contacts`;

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles, max_results: 10 }),
          });

          if (!response.ok) {
            const data = await response.json();
            // If search-contacts fails due to no providers, fall back to discover-contacts
            if (hasProviders && data.error?.includes('No contact discovery providers')) {
              const fallbackResponse = await fetch(
                `/api/projects/${slug}/organizations/${orgId}/discover-contacts`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roles, max_results: 10 }),
                }
              );
              if (!fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                throw new Error(fallbackData.error ?? 'Discovery failed');
              }
              const fallbackData = await fallbackResponse.json();
              return {
                organizationId: orgId,
                organizationName: orgName,
                status: 'success' as const,
                contacts: fallbackData.contacts ?? [],
              };
            }
            throw new Error(data.error ?? 'Discovery failed');
          }

          const data = await response.json();

          return {
            organizationId: orgId,
            organizationName: orgName,
            status: 'success' as const,
            contacts: data.contacts ?? [],
          };
        } catch (error) {
          return {
            organizationId: orgId,
            organizationName: orgName,
            status: 'failed' as const,
            contacts: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        results.push(result);

        setProgress((prev) => ({
          ...prev,
          current: results.length,
          currentOrgName: result.organizationName,
          completed: result.status === 'success' ? prev.completed + 1 : prev.completed,
          failed: result.status === 'failed' ? prev.failed + 1 : prev.failed,
          results: [...results],
        }));
      }

      // Delay between batches
      if (i + CONCURRENCY_LIMIT < organizationIds.length && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    if (!abortRef.current) {
      setProgress((prev) => ({ ...prev, status: 'completed' }));

      // Auto-select high confidence contacts and expand orgs with contacts
      const autoSelections: BulkContactSelection = {};
      const autoExpanded = new Set<string>();

      for (const result of results) {
        if (result.status === 'success' && result.contacts.length > 0) {
          autoExpanded.add(result.organizationId);
          autoSelections[result.organizationId] = new Set(
            result.contacts.filter((c) => c.confidence >= 0.7).map((c) => c.id)
          );
        }
      }

      setSelections(autoSelections);
      setExpandedOrgs(autoExpanded);
      setStep('results');
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  // Selection helpers
  const toggleContact = (orgId: string, contactId: string) => {
    setSelections((prev) => {
      const orgSet = new Set(prev[orgId] ?? []);
      if (orgSet.has(contactId)) {
        orgSet.delete(contactId);
      } else {
        orgSet.add(contactId);
      }
      return { ...prev, [orgId]: orgSet };
    });
  };

  const selectAllForOrg = (orgId: string) => {
    const result = progress.results.find((r) => r.organizationId === orgId);
    if (result && result.status === 'success') {
      setSelections((prev) => ({
        ...prev,
        [orgId]: new Set(result.contacts.map((c) => c.id)),
      }));
    }
  };

  const clearSelectionForOrg = (orgId: string) => {
    setSelections((prev) => ({
      ...prev,
      [orgId]: new Set(),
    }));
  };

  const selectAllHighConfidence = () => {
    const newSelections: BulkContactSelection = {};
    for (const result of progress.results) {
      if (result.status === 'success') {
        newSelections[result.organizationId] = new Set(
          result.contacts.filter((c) => c.confidence >= 0.7).map((c) => c.id)
        );
      }
    }
    setSelections(newSelections);
  };

  const clearAllSelections = () => {
    setSelections({});
  };

  const toggleOrgExpanded = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
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

  const handleAddContacts = async () => {
    const orgsWithSelections = Object.entries(selections).filter(
      ([, contactIds]) => contactIds.size > 0
    );

    if (orgsWithSelections.length === 0) {
      setError('Please select at least one contact to add');
      return;
    }

    setError(null);
    setStep('adding');

    let totalAdded = 0;
    let orgsProcessed = 0;

    for (const [orgId, contactIds] of orgsWithSelections) {
      const result = progress.results.find((r) => r.organizationId === orgId);
      if (!result || result.status !== 'success') continue;

      const selectedContacts = result.contacts.filter((c) => contactIds.has(c.id));

      try {
        const response = await fetch(
          `/api/projects/${slug}/organizations/${orgId}/add-contacts`,
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

        if (response.ok) {
          const data = await response.json();
          totalAdded += data.created_count ?? 0;
          orgsProcessed++;
        }
      } catch (err) {
        console.error(`Failed to add contacts for org ${orgId}:`, err);
      }
    }

    setAddedCount(totalAdded);
    setAddedOrgsCount(orgsProcessed);
    setStep('success');
    toast.success(
      `Added ${totalAdded} contact${totalAdded !== 1 ? 's' : ''} across ${orgsProcessed} organization${orgsProcessed !== 1 ? 's' : ''}`
    );
  };

  const progressPercentage =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Find People at {organizationIds.length} Organization{organizationIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Enter the roles or titles you want to find at these companies.'}
            {step === 'discovering' && 'Discovering contacts...'}
            {step === 'results' &&
              `Found ${totalContacts} potential contact${totalContacts !== 1 ? 's' : ''} across ${successfulResults.length} organization${successfulResults.length !== 1 ? 's' : ''}`}
            {step === 'adding' && 'Adding contacts...'}
            {step === 'success' &&
              `Successfully added ${addedCount} contact${addedCount !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {/* Step 1: Role Input */}
          {step === 'input' && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{organizationIds.length} organizations selected</p>
                  <p className="text-sm text-muted-foreground">
                    AI will search for contacts at each organization matching the roles you specify.
                  </p>
                </div>
              </div>

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
                  {roleSuggestions
                    .filter((r) => !roles.includes(r))
                    .slice(0, 12)
                    .map((suggestion) => (
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

          {/* Step 2: Discovering */}
          {step === 'discovering' && (
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching: {progress.currentOrgName}
                </div>
                <span className="text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {progress.completed} completed
                </span>
                {progress.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {progress.failed} failed
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {totalContacts === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Search className="mx-auto h-8 w-8 mb-2" />
                  <p>No contacts found for the specified roles.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {totalSelected} of {totalContacts} selected
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllHighConfidence}
                      >
                        Select High Confidence
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearAllSelections}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[350px] rounded-md border">
                    <div className="p-2 space-y-2">
                      {progress.results.map((result) => {
                        if (result.status === 'failed') {
                          return (
                            <div
                              key={result.organizationId}
                              className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                            >
                              <XCircle className="h-4 w-4 text-destructive shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{result.organizationName}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  {result.error}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        if (result.contacts.length === 0) {
                          return (
                            <div
                              key={result.organizationId}
                              className="flex items-center gap-2 rounded-lg border p-3 text-muted-foreground"
                            >
                              <Search className="h-4 w-4 shrink-0" />
                              <span>{result.organizationName} - No contacts found</span>
                            </div>
                          );
                        }

                        const orgSelections = selections[result.organizationId] ?? new Set();
                        const isExpanded = expandedOrgs.has(result.organizationId);

                        return (
                          <Collapsible
                            key={result.organizationId}
                            open={isExpanded}
                            onOpenChange={() => toggleOrgExpanded(result.organizationId)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{result.organizationName}</span>
                                  <span className="text-muted-foreground text-sm ml-2">
                                    ({result.contacts.length} contact
                                    {result.contacts.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {orgSelections.size} selected
                                </span>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-6 mt-1 space-y-1 border-l pl-4">
                                <div className="flex gap-2 py-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectAllForOrg(result.organizationId);
                                    }}
                                  >
                                    Select All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearSelectionForOrg(result.organizationId);
                                    }}
                                  >
                                    Clear
                                  </Button>
                                </div>
                                {result.contacts.map((contact) => (
                                  <div
                                    key={contact.id}
                                    className={`flex items-start gap-3 rounded-lg border p-2 cursor-pointer transition-colors ${
                                      orgSelections.has(contact.id)
                                        ? 'border-primary bg-primary/5'
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() =>
                                      toggleContact(result.organizationId, contact.id)
                                    }
                                  >
                                    <Checkbox
                                      checked={orgSelections.has(contact.id)}
                                      onCheckedChange={() =>
                                        toggleContact(result.organizationId, contact.id)
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{contact.name}</span>
                                        {getConfidenceBadge(contact.confidence)}
                                      </div>
                                      {contact.title && (
                                        <p className="text-xs text-muted-foreground">
                                          {contact.title}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 mt-0.5">
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
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </ScrollArea>
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
                Across {addedOrgsCount} organization{addedOrgsCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleStartDiscovery} disabled={roles.length === 0}>
                <Search className="mr-2 h-4 w-4" />
                Find People
              </Button>
            </>
          )}

          {step === 'discovering' && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}

          {step === 'results' && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button type="button" onClick={handleAddContacts} disabled={totalSelected === 0}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add {totalSelected} Contact{totalSelected !== 1 ? 's' : ''}
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
