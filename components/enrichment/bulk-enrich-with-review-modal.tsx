'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  Users,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Mail,
  Phone,
  Briefcase,
  Linkedin,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import type { EnrichmentJob } from '@/types/enrichment';

interface SelectedPerson {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_country?: string | null;
}

interface BulkEnrichWithReviewModalProps {
  open: boolean;
  onClose: () => void;
  selectedPeople: SelectedPerson[];
  projectSlug: string;
  onComplete: () => void;
}

type Phase = 'confirming' | 'processing' | 'reviewing' | 'completed';

interface JobState {
  personId: string;
  personName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: EnrichmentPerson | null;
  error: string | null;
  jobId?: string;
}

interface SelectableField {
  key: string;
  label: string;
  value: string;
  type?: string;
  status?: string;
  icon: React.ReactNode;
  currentValue?: string | null;
}

export function BulkEnrichWithReviewModal({
  open,
  onClose,
  selectedPeople,
  projectSlug,
  onComplete,
}: BulkEnrichWithReviewModalProps) {
  const [phase, setPhase] = useState<Phase>('confirming');
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState(false);
  const personIdsRef = useRef<string[]>([]);
  const pollCountRef = useRef(0);
  const phaseRef = useRef<Phase>('confirming');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setPhase('confirming');
      phaseRef.current = 'confirming';
      setJobs([]);
      setCurrentReviewIndex(0);
      setAppliedCount(0);
      setSkippedCount(0);
      setSelectedFields({});
      personIdsRef.current = [];
      pollCountRef.current = 0;
    }
  }, [open]);

  // Poll for job completion
  const pollJobs = useCallback(async () => {
    if (phase !== 'processing' || personIdsRef.current.length === 0) return;

    console.log('[BulkEnrich] Polling for jobs...', personIdsRef.current);

    try {
      // Poll for each person's enrichment job individually
      const personIds = personIdsRef.current;
      const enrichmentJobs: EnrichmentJob[] = [];

      // Fetch jobs for each person (in parallel)
      const responses = await Promise.all(
        personIds.map((personId) =>
          fetch(
            `/api/projects/${projectSlug}/enrich?poll=true&person_id=${personId}`
          ).then((r) => r.json())
        )
      );

      for (const data of responses) {
        if (data.jobs && data.jobs.length > 0) {
          // Get the most recent job for this person
          enrichmentJobs.push(data.jobs[0]);
        }
      }

      console.log('[BulkEnrich] Poll results:', enrichmentJobs.map(j => ({ person_id: j.person_id, status: j.status, hasResult: !!j.result })));

      // Update job states based on enrichment jobs
      setJobs((prevJobs) => {
        const updatedJobs = prevJobs.map((job) => {
          const enrichmentJob = enrichmentJobs.find(
            (ej) => ej.person_id === job.personId
          );
          if (enrichmentJob) {
            return {
              ...job,
              status: enrichmentJob.status,
              result: enrichmentJob.result,
              error: enrichmentJob.error,
              jobId: enrichmentJob.id,
            };
          }
          return job;
        });

        // Check if all jobs are done
        const allDone = updatedJobs.every(
          (j) => j.status === 'completed' || j.status === 'failed'
        );

        if (allDone) {
          const hasCompletedJobs = updatedJobs.some(
            (j) => j.status === 'completed' && j.result
          );
          if (hasCompletedJobs) {
            // Find first completed job for review
            const firstCompletedIndex = updatedJobs.findIndex(
              (j) => j.status === 'completed' && j.result
            );
            setCurrentReviewIndex(firstCompletedIndex);
            setPhase('reviewing');
            phaseRef.current = 'reviewing';
          } else {
            // All failed
            setPhase('completed');
            phaseRef.current = 'completed';
          }
        }

        return updatedJobs;
      });
    } catch (error) {
      console.error('Error polling jobs:', error);
    }
  }, [phase, projectSlug]);

  // Set up polling with exponential backoff
  useEffect(() => {
    if (phase !== 'processing') return;

    let timeoutId: NodeJS.Timeout;

    const scheduleNextPoll = () => {
      // Exponential backoff: 3s, 4.5s, 6.75s, up to max 15s
      const baseInterval = 3000;
      const maxInterval = 15000;
      const backoffFactor = 1.5;
      const interval = Math.min(
        baseInterval * Math.pow(backoffFactor, pollCountRef.current),
        maxInterval
      );

      console.log(`[BulkEnrich] Next poll in ${Math.round(interval / 1000)}s (poll #${pollCountRef.current + 1})`);

      timeoutId = setTimeout(async () => {
        pollCountRef.current += 1;
        await pollJobs();
        // Schedule next poll if still processing
        if (phaseRef.current === 'processing') {
          scheduleNextPoll();
        }
      }, interval);
    };

    // Initial poll immediately
    pollJobs().then(() => {
      scheduleNextPoll();
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phase, pollJobs]);

  const startEnrichment = async () => {
    if (selectedPeople.length === 0) return;

    // Initialize job states
    const initialJobs: JobState[] = selectedPeople.map((person) => ({
      personId: person.id,
      personName: `${person.first_name} ${person.last_name}`.trim(),
      status: 'pending',
      result: null,
      error: null,
    }));
    setJobs(initialJobs);
    personIdsRef.current = selectedPeople.map((p) => p.id);
    pollCountRef.current = 0;
    setPhase('processing');
    phaseRef.current = 'processing';

    try {
      const response = await fetch(`/api/projects/${projectSlug}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_ids: selectedPeople.map((p) => p.id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Bulk enrichment failed');
      }

      // Update jobs to processing status
      setJobs((prev) =>
        prev.map((job) => ({
          ...job,
          status: 'processing',
        }))
      );

      toast.success(`Enrichment started for ${selectedPeople.length} people`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bulk enrichment failed';
      toast.error(message);
      setPhase('completed');
      phaseRef.current = 'completed';
    }
  };

  const getCurrentPerson = () => {
    if (currentReviewIndex < 0 || currentReviewIndex >= jobs.length) return null;
    const job = jobs[currentReviewIndex];
    if (!job) return null;
    return selectedPeople.find((p) => p.id === job.personId);
  };

  const getCurrentJob = () => {
    if (currentReviewIndex < 0 || currentReviewIndex >= jobs.length) return null;
    return jobs[currentReviewIndex];
  };

  const getCompletedJobsForReview = () => {
    return jobs.filter((j) => j.status === 'completed' && j.result);
  };

  const getCurrentReviewNumber = () => {
    const completedJobs = getCompletedJobsForReview();
    const currentJob = getCurrentJob();
    if (!currentJob) return 0;
    return completedJobs.findIndex((j) => j.personId === currentJob.personId) + 1;
  };

  const getTotalReviewCount = () => {
    return getCompletedJobsForReview().length;
  };

  const buildSelectableFields = (
    enrichmentData: EnrichmentPerson,
    currentPerson: SelectedPerson
  ) => {
    const emailFields: SelectableField[] = [];
    const phoneFields: SelectableField[] = [];
    const otherFields: SelectableField[] = [];

    // Process emails
    if (enrichmentData.all_emails && enrichmentData.all_emails.length > 0) {
      enrichmentData.all_emails.forEach((e, i) => {
        emailFields.push({
          key: `email_${i}`,
          label: e.type ? `${e.type} email` : 'Email',
          value: e.email,
          type: e.type,
          status: e.status,
          icon: <Mail className="h-4 w-4" />,
          currentValue: currentPerson.email,
        });
      });
    } else if (enrichmentData.email) {
      emailFields.push({
        key: 'email_0',
        label: 'Email',
        value: enrichmentData.email,
        icon: <Mail className="h-4 w-4" />,
        currentValue: currentPerson.email,
      });
    }

    // Process phones
    if (enrichmentData.all_phones && enrichmentData.all_phones.length > 0) {
      enrichmentData.all_phones.forEach((p, i) => {
        const isMobile = p.type?.toLowerCase() === 'mobile';
        phoneFields.push({
          key: isMobile ? `mobile_phone_${i}` : `phone_${i}`,
          label: p.type
            ? `${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Phone`
            : 'Phone',
          value: p.phone,
          type: p.type,
          icon: <Phone className="h-4 w-4" />,
          currentValue: isMobile
            ? currentPerson.mobile_phone
            : currentPerson.phone,
        });
      });
    } else if (enrichmentData.phone) {
      phoneFields.push({
        key: 'phone_0',
        label: 'Phone',
        value: enrichmentData.phone,
        icon: <Phone className="h-4 w-4" />,
        currentValue: currentPerson.phone,
      });
    }

    // Process other fields
    if (enrichmentData.job_title) {
      otherFields.push({
        key: 'job_title',
        label: 'Job Title',
        value: enrichmentData.job_title,
        icon: <Briefcase className="h-4 w-4" />,
        currentValue: currentPerson.job_title,
      });
    }

    if (enrichmentData.linkedin_url) {
      otherFields.push({
        key: 'linkedin_url',
        label: 'LinkedIn',
        value: enrichmentData.linkedin_url,
        icon: <Linkedin className="h-4 w-4" />,
        currentValue: currentPerson.linkedin_url,
      });
    }

    if (
      enrichmentData.location?.city ||
      enrichmentData.location?.state ||
      enrichmentData.location?.country
    ) {
      const locationParts = [
        enrichmentData.location.city,
        enrichmentData.location.state,
        enrichmentData.location.country,
      ].filter(Boolean);

      if (locationParts.length > 0) {
        otherFields.push({
          key: 'location',
          label: 'Location',
          value: locationParts.join(', '),
          icon: <MapPin className="h-4 w-4" />,
          currentValue: [
            currentPerson.address_city,
            currentPerson.address_state,
            currentPerson.address_country,
          ]
            .filter(Boolean)
            .join(', ') || null,
        });
      }
    }

    return { emailFields, phoneFields, otherFields };
  };

  const toggleField = (field: SelectableField) => {
    setSelectedFields((prev) => {
      const newSelected = { ...prev };
      if (newSelected[field.key]) {
        delete newSelected[field.key];
      } else {
        newSelected[field.key] = field.value;
      }
      return newSelected;
    });
  };

  const applyAndNext = async () => {
    const currentJob = getCurrentJob();
    const currentPerson = getCurrentPerson();

    if (!currentJob || !currentPerson || !currentJob.result) return;

    setIsApplying(true);

    try {
      // Build updates from selected fields
      const updates: Record<string, string | null> = {};
      const selectedEmails: string[] = [];
      const selectedPhones: string[] = [];
      const selectedMobilePhones: string[] = [];

      Object.entries(selectedFields).forEach(([key, value]) => {
        if (key.startsWith('email_')) {
          selectedEmails.push(value);
        } else if (key.startsWith('mobile_phone_')) {
          selectedMobilePhones.push(value);
        } else if (key.startsWith('phone_')) {
          selectedPhones.push(value);
        } else if (key === 'job_title') {
          updates.job_title = value;
        } else if (key === 'linkedin_url') {
          updates.linkedin_url = value;
        } else if (key === 'location' && currentJob.result?.location) {
          if (currentJob.result.location.city)
            updates.address_city = currentJob.result.location.city;
          if (currentJob.result.location.state)
            updates.address_state = currentJob.result.location.state;
          if (currentJob.result.location.country)
            updates.address_country = currentJob.result.location.country;
        }
      });

      if (selectedEmails.length > 0) {
        updates.email = selectedEmails.join(', ');
      }
      if (selectedPhones.length > 0) {
        updates.phone = selectedPhones.join(', ');
      }
      if (selectedMobilePhones.length > 0) {
        updates.mobile_phone = selectedMobilePhones.join(', ');
      }

      // Apply updates if any fields selected
      if (Object.keys(updates).length > 0) {
        const response = await fetch(
          `/api/projects/${projectSlug}/people/${currentPerson.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to apply enrichment');
        }

        setAppliedCount((prev) => prev + 1);
        toast.success(
          `Applied ${Object.keys(selectedFields).length} fields to ${currentJob.personName}`
        );
      } else {
        setSkippedCount((prev) => prev + 1);
      }

      // Mark job as reviewed
      if (currentJob.jobId) {
        await fetch(`/api/projects/${projectSlug}/enrich`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: currentJob.jobId }),
        });
      }

      moveToNext();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to apply enrichment';
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  const skipAndNext = async () => {
    const currentJob = getCurrentJob();

    setSkippedCount((prev) => prev + 1);

    // Mark job as reviewed
    if (currentJob?.jobId) {
      await fetch(`/api/projects/${projectSlug}/enrich`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: currentJob.jobId }),
      });
    }

    moveToNext();
  };

  const moveToNext = () => {
    setSelectedFields({});

    // Find next completed job
    const completedJobs = getCompletedJobsForReview();
    const currentJob = getCurrentJob();
    if (!currentJob) {
      setPhase('completed');
      phaseRef.current = 'completed';
      return;
    }

    const currentIndexInCompleted = completedJobs.findIndex(
      (j) => j.personId === currentJob.personId
    );

    if (currentIndexInCompleted < completedJobs.length - 1) {
      // Move to next completed job
      const nextJob = completedJobs[currentIndexInCompleted + 1];
      const nextIndex = jobs.findIndex((j) => j.personId === nextJob?.personId);
      setCurrentReviewIndex(nextIndex);
    } else {
      // All done
      setPhase('completed');
      phaseRef.current = 'completed';
    }
  };

  const handleClose = () => {
    if (phase === 'completed') {
      onComplete();
    }
    onClose();
  };

  const getProgressPercentage = () => {
    if (jobs.length === 0) return 0;
    const done = jobs.filter(
      (j) => j.status === 'completed' || j.status === 'failed'
    ).length;
    return Math.round((done / jobs.length) * 100);
  };

  const renderFieldRow = (field: SelectableField) => {
    const isSelected = !!selectedFields[field.key];
    const willOverwrite =
      field.currentValue && field.currentValue !== field.value;

    return (
      <div
        key={field.key}
        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50'
        }`}
        onClick={() => toggleField(field)}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleField(field)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {field.icon}
            <Label className="text-sm font-medium capitalize cursor-pointer">
              {field.label}
            </Label>
            {field.type && (
              <Badge variant="secondary" className="text-xs">
                {field.type}
              </Badge>
            )}
            {field.status && (
              <Badge
                variant={field.status === 'DELIVERABLE' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {field.status.toLowerCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground mt-1 truncate">{field.value}</p>
          {field.currentValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {willOverwrite ? (
                <span className="text-amber-600">
                  Will replace: {field.currentValue}
                </span>
              ) : (
                <span className="text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Same as current
                </span>
              )}
            </p>
          )}
          {!field.currentValue && (
            <p className="text-xs text-green-600 mt-1">New field</p>
          )}
        </div>
      </div>
    );
  };

  const currentJob = getCurrentJob();
  const currentPerson = getCurrentPerson();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {phase === 'confirming' && 'Bulk Enrich People'}
            {phase === 'processing' && 'Enriching People'}
            {phase === 'reviewing' && 'Review Enrichment Results'}
            {phase === 'completed' && 'Enrichment Complete'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'confirming' &&
              `Enrich ${selectedPeople.length} selected ${selectedPeople.length === 1 ? 'person' : 'people'} with contact information.`}
            {phase === 'processing' &&
              'Processing enrichment requests...'}
            {phase === 'reviewing' &&
              'Select which fields to apply for each person.'}
            {phase === 'completed' && 'Review completed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {/* Confirming Phase */}
          {phase === 'confirming' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {selectedPeople.length} people selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This will use approximately {selectedPeople.length} credits
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                After enrichment completes, you&apos;ll review each person&apos;s
                results and select which fields to apply.
              </p>
            </div>
          )}

          {/* Processing Phase */}
          {phase === 'processing' && (
            <div className="space-y-4">
              <Progress value={getProgressPercentage()} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {getProgressPercentage()}% complete
              </p>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job.personId}
                      className="flex items-center gap-2 p-2 rounded border"
                    >
                      {job.status === 'pending' && (
                        <div className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      {job.status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {job.status === 'completed' && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                      {job.status === 'failed' && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                      <span className="flex-1 text-sm">{job.personName}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Reviewing Phase */}
          {phase === 'reviewing' && currentJob && currentPerson && currentJob.result && (
            <div className="space-y-4 overflow-hidden flex flex-col h-full">
              {/* Progress indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Person {getCurrentReviewNumber()} of {getTotalReviewCount()}
                </span>
                <Progress
                  value={(getCurrentReviewNumber() / getTotalReviewCount()) * 100}
                  className="flex-1 h-2"
                />
              </div>

              {/* Person name */}
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{currentJob.personName}</span>
              </div>

              {/* Field selection */}
              <ScrollArea className="flex-1 -mx-2 px-2">
                {(() => {
                  const { emailFields, phoneFields, otherFields } =
                    buildSelectableFields(currentJob.result, currentPerson);
                  const hasData =
                    emailFields.length > 0 ||
                    phoneFields.length > 0 ||
                    otherFields.length > 0;

                  if (!hasData) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        No enrichment data found for this person.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {emailFields.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Emails ({emailFields.length})
                          </h4>
                          <div className="space-y-2">
                            {emailFields.map(renderFieldRow)}
                          </div>
                        </div>
                      )}

                      {phoneFields.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Phone Numbers ({phoneFields.length})
                          </h4>
                          <div className="space-y-2">
                            {phoneFields.map(renderFieldRow)}
                          </div>
                        </div>
                      )}

                      {otherFields.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Other Information
                          </h4>
                          <div className="space-y-2">
                            {otherFields.map(renderFieldRow)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </ScrollArea>
            </div>
          )}

          {/* Completed Phase */}
          {phase === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Sparkles className="h-6 w-6" />
                <span className="text-lg font-medium">Review Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-green-600">
                    {appliedCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Applied</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {skippedCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-destructive">
                    {jobs.filter((j) => j.status === 'failed').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === 'confirming' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={startEnrichment}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Enrichment
              </Button>
            </>
          )}

          {phase === 'processing' && (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </Button>
          )}

          {phase === 'reviewing' && (
            <>
              <Button variant="outline" onClick={skipAndNext} disabled={isApplying}>
                Skip
              </Button>
              <Button onClick={applyAndNext} disabled={isApplying}>
                {isApplying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                {Object.keys(selectedFields).length > 0
                  ? `Apply ${Object.keys(selectedFields).length} & Next`
                  : getCurrentReviewNumber() === getTotalReviewCount()
                    ? 'Finish'
                    : 'Next'}
              </Button>
            </>
          )}

          {phase === 'completed' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
