'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Search,
  UserPlus,
  Check,
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

interface DiscoveredGenericEmail {
  id: string;
  name: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string;
  linkedin_url: string | null;
  confidence: number;
  source_hint: string | null;
}

interface OrgDiscoveryResult {
  organizationId: string;
  organizationName: string;
  status: 'success' | 'failed';
  contacts: DiscoveredGenericEmail[];
  discovered_domain?: string | null;
  error?: string;
}

interface BulkGenericEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationIds: string[];
  onComplete?: () => void;
}

type DialogStep = 'input' | 'discovering' | 'results' | 'adding' | 'success';

const DEPARTMENT_SUGGESTIONS = [
  'Water/Wastewater',
  'Public Works/DPW',
  'General/Clerk',
  'Utilities',
  'Engineering',
];

const CONCURRENCY_LIMIT = 3;
const DELAY_BETWEEN_BATCHES = 500;

export function BulkGenericEmailDialog({
  open,
  onOpenChange,
  organizationIds,
  onComplete,
}: BulkGenericEmailDialogProps) {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<DialogStep>('input');
  const [departments, setDepartments] = useState<string[]>([
    'Water/Wastewater',
    'Public Works/DPW',
    'General/Clerk',
  ]);
  const [error, setError] = useState<string | null>(null);

  // Discovery progress state
  const [results, setResults] = useState<OrgDiscoveryResult[]>([]);
  const [current, setCurrent] = useState(0);
  const [currentOrgName, setCurrentOrgName] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Selection state
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Adding state
  const [addedCount, setAddedCount] = useState(0);
  const [addedOrgsCount, setAddedOrgsCount] = useState(0);

  const abortRef = useRef(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setDepartments(['Water/Wastewater', 'Public Works/DPW', 'General/Clerk']);
      setError(null);
      setResults([]);
      setCurrent(0);
      setCurrentOrgName('');
      setCompletedCount(0);
      setFailedCount(0);
      setSelections({});
      setExpandedOrgs(new Set());
      setAddedCount(0);
      setAddedOrgsCount(0);
      abortRef.current = false;
    }
  }, [open, organizationIds.length]);

  const successfulResults = useMemo(
    () => results.filter((r) => r.status === 'success'),
    [results]
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
    if (step === 'discovering') return;
    if (step === 'success') onComplete?.();
    onOpenChange(false);
  };

  const toggleDepartment = (dept: string) => {
    setDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleStartDiscovery = async () => {
    if (departments.length === 0) {
      setError('Please select at least one department');
      return;
    }

    setError(null);
    setStep('discovering');
    abortRef.current = false;

    const allResults: OrgDiscoveryResult[] = [];
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < organizationIds.length; i += CONCURRENCY_LIMIT) {
      if (abortRef.current) break;

      const batch = organizationIds.slice(i, i + CONCURRENCY_LIMIT);

      const batchPromises = batch.map(async (orgId) => {
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
          const response = await fetch(
            `/api/projects/${slug}/organizations/${orgId}/discover-generic-emails`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ departments, max_results: 3 }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          return {
            organizationId: orgId,
            organizationName: data.organization?.name ?? orgName,
            status: 'success' as const,
            contacts: data.contacts ?? [],
            discovered_domain: data.discovered_domain,
          };
        } catch (err) {
          return {
            organizationId: orgId,
            organizationName: orgName,
            status: 'failed' as const,
            contacts: [],
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        allResults.push(result);
        if (result.status === 'success') completed++;
        else failed++;
      }

      setResults([...allResults]);
      setCurrent(allResults.length);
      setCurrentOrgName(batchResults[batchResults.length - 1]?.organizationName ?? '');
      setCompletedCount(completed);
      setFailedCount(failed);

      if (i + CONCURRENCY_LIMIT < organizationIds.length && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    if (!abortRef.current) {
      // Auto-select all contacts with confidence >= 0.5 and expand orgs with contacts
      const autoSelections: Record<string, Set<string>> = {};
      const autoExpanded = new Set<string>();

      for (const result of allResults) {
        if (result.status === 'success' && result.contacts.length > 0) {
          autoExpanded.add(result.organizationId);
          autoSelections[result.organizationId] = new Set(
            result.contacts.filter((c) => c.confidence >= 0.5).map((c) => c.id)
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
    const result = results.find((r) => r.organizationId === orgId);
    if (result && result.status === 'success') {
      setSelections((prev) => ({
        ...prev,
        [orgId]: new Set(result.contacts.map((c) => c.id)),
      }));
    }
  };

  const clearSelectionForOrg = (orgId: string) => {
    setSelections((prev) => ({ ...prev, [orgId]: new Set() }));
  };

  const selectAll = () => {
    const newSelections: Record<string, Set<string>> = {};
    for (const result of results) {
      if (result.status === 'success') {
        newSelections[result.organizationId] = new Set(
          result.contacts.map((c) => c.id)
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
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return <Badge variant="default" className="bg-green-500">High</Badge>;
    }
    if (confidence >= 0.4) {
      return <Badge variant="secondary">Medium</Badge>;
    }
    return <Badge variant="outline">Low</Badge>;
  };

  const handleAddContacts = async () => {
    const orgsWithSelections = Object.entries(selections).filter(
      ([, contactIds]) => contactIds.size > 0
    );

    if (orgsWithSelections.length === 0) {
      setError('Please select at least one email to add');
      return;
    }

    setError(null);
    setStep('adding');

    let totalAdded = 0;
    let orgsProcessed = 0;

    for (const [orgId, contactIds] of orgsWithSelections) {
      const result = results.find((r) => r.organizationId === orgId);
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
                first_name: c.first_name ?? c.name,
                last_name: c.last_name ?? '',
                email: c.email,
                job_title: c.title ?? 'Department',
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
      `Added ${totalAdded} department email${totalAdded !== 1 ? 's' : ''} across ${orgsProcessed} organization${orgsProcessed !== 1 ? 's' : ''}`
    );
  };

  const progressPercentage =
    organizationIds.length > 0
      ? Math.round((current / organizationIds.length) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Find Department Emails at {organizationIds.length} Organization
            {organizationIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              'Select department types to find generic email addresses (e.g., water@, dpw@, info@).'}
            {step === 'discovering' && 'Discovering department emails...'}
            {step === 'results' &&
              `Found ${totalContacts} department email${totalContacts !== 1 ? 's' : ''} across ${successfulResults.length} organization${successfulResults.length !== 1 ? 's' : ''}`}
            {step === 'adding' && 'Adding department contacts...'}
            {step === 'success' &&
              `Successfully added ${addedCount} department email${addedCount !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {/* Step 1: Department Selection */}
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
                  <p className="font-medium">
                    {organizationIds.length} organizations selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    AI will find the official email domain for each municipality and
                    generate likely department email addresses.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Department types to find</Label>
                <div className="space-y-2">
                  {DEPARTMENT_SUGGESTIONS.map((dept) => (
                    <div
                      key={dept}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        departments.includes(dept)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleDepartment(dept)}
                    >
                      <Checkbox
                        checked={departments.includes(dept)}
                        onCheckedChange={() => toggleDepartment(dept)}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{dept}</span>
                        <p className="text-xs text-muted-foreground">
                          {dept === 'Water/Wastewater' &&
                            'water@, wastewater@, sewer@ addresses'}
                          {dept === 'Public Works/DPW' &&
                            'dpw@, publicworks@, pw@ addresses'}
                          {dept === 'General/Clerk' &&
                            'info@, clerk@, admin@ addresses (gets forwarded)'}
                          {dept === 'Utilities' && 'utilities@, utility@ addresses'}
                          {dept === 'Engineering' &&
                            'engineering@, engineer@ addresses'}
                        </p>
                      </div>
                    </div>
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
                  Searching: {currentOrgName}
                </div>
                <span className="text-muted-foreground">
                  {current} / {organizationIds.length}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {completedCount} completed
                </span>
                {failedCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {failedCount} failed
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
                  <p>No department emails found.</p>
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
                        onClick={selectAll}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllSelections}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[350px] rounded-md border">
                    <div className="p-2 space-y-2">
                      {results.map((result) => {
                        if (result.status === 'failed') {
                          return (
                            <div
                              key={result.organizationId}
                              className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                            >
                              <XCircle className="h-4 w-4 text-destructive shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">
                                  {result.organizationName}
                                </span>
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
                              <span>
                                {result.organizationName} - No emails found
                              </span>
                            </div>
                          );
                        }

                        const orgSelections =
                          selections[result.organizationId] ?? new Set();
                        const isExpanded = expandedOrgs.has(result.organizationId);

                        return (
                          <Collapsible
                            key={result.organizationId}
                            open={isExpanded}
                            onOpenChange={() =>
                              toggleOrgExpanded(result.organizationId)
                            }
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">
                                    {result.organizationName}
                                  </span>
                                  {result.discovered_domain && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({result.discovered_domain})
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-sm ml-2">
                                    - {result.contacts.length} email
                                    {result.contacts.length !== 1 ? 's' : ''}
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
                                      toggleContact(
                                        result.organizationId,
                                        contact.id
                                      )
                                    }
                                  >
                                    <Checkbox
                                      checked={orgSelections.has(contact.id)}
                                      onCheckedChange={() =>
                                        toggleContact(
                                          result.organizationId,
                                          contact.id
                                        )
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                          {contact.name}
                                        </span>
                                        {getConfidenceBadge(contact.confidence)}
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                          {contact.email}
                                        </span>
                                      </div>
                                      {contact.source_hint && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {contact.source_hint}
                                        </p>
                                      )}
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
              <p className="mt-4 text-muted-foreground">
                Adding department contacts...
              </p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="mt-4 font-medium">
                Added {addedCount} department email
                {addedCount !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                Across {addedOrgsCount} organization
                {addedOrgsCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                These contacts can now be enrolled in email sequences.
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
              <Button
                type="button"
                onClick={handleStartDiscovery}
                disabled={departments.length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Find Department Emails
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
                disabled={totalSelected === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add {totalSelected} Email{totalSelected !== 1 ? 's' : ''}
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
