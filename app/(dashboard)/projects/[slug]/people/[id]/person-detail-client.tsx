'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Linkedin,
  Mail,
  MapPin,
  Pencil,
  Smartphone,
  Sparkles,
  Trash2,
  Twitter,
  Target,
  User,
  Send,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { EnrichButton } from '@/components/enrichment';
import { EnrichmentReviewModal } from '@/components/enrichment/enrichment-review-modal';
import { usePerson } from '@/hooks/use-people';
import { usePersonStore, deletePerson, updatePersonApi } from '@/stores/person';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PersonForm } from '@/components/people/person-form';
import { PersonSequencesTab } from '@/components/people/person-sequences-tab';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import { EntityEmailTab } from '@/components/email/entity-email-tab';
import { SendEmailModal } from '@/components/gmail';
import { EntityCommentsFeed } from '@/components/comments';
import { ClickableEmail } from '@/components/contacts/clickable-email';
import { ClickablePhone } from '@/components/contacts/clickable-phone';
import { CallLogTable } from '@/components/calls/call-log-table';
import { SmsConversation } from '@/components/sms/sms-conversation';
import { PhoneCall, MessageSquareText, ExternalLink, Copy, Check, UserPlus, Users, ClipboardList, ListTodo, ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Plus, FileText } from 'lucide-react';
import type { CompanyContext } from '@/lib/validators/project';
import type { ActivityWithUser } from '@/types/activity';
import { getSalesNavUrl } from '@/lib/linkedin/utils';
import { toast } from 'sonner';
import { LogActivityModal } from '@/components/activity/log-activity-modal';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDispositions } from '@/hooks/use-dispositions';
import { DISPOSITION_COLOR_MAP, type DispositionColor } from '@/types/disposition';
import { useOutreachGuard } from '@/hooks/use-outreach-guard';
import { NewScopeDialog } from '@/components/community/contractors/new-scope-dialog';
import { PersonRelationshipsTab } from '@/components/community/people/person-relationships-tab';
import { PersonApprovedForTab } from '@/components/community/people/person-approved-for-tab';
import { PersonParticipationTab } from '@/components/community/people/person-participation-tab';

interface PersonDetailClientProps {
  personId: string;
  companyContext?: CompanyContext;
  currentUserId?: string;
  projectType?: string;
}

export function PersonDetailClient({ personId, companyContext, currentUserId, projectType }: PersonDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const fromOrg = searchParams.get('from') === 'org';
  const orgId = searchParams.get('orgId');
  const backUrl = fromOrg && orgId
    ? `/projects/${slug}/organizations/${orgId}`
    : `/projects/${slug}/people`;
  const backLabel = fromOrg && orgId ? 'Back to Organization' : 'Back to People';
  const [activeTab, setActiveTab] = useState('info');
  const { dispositions } = useDispositions('person');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [pendingEnrichmentData, setPendingEnrichmentData] = useState<EnrichmentPerson | null>(null);
  const [pendingEnrichmentJobId, setPendingEnrichmentJobId] = useState<string | null>(null);
  const [showPendingReviewModal, setShowPendingReviewModal] = useState(false);
  const [isApplyingEnrichment, setIsApplyingEnrichment] = useState(false);
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [loggingLinkedIn, setLoggingLinkedIn] = useState<string | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [emailValidating, setEmailValidating] = useState(false);
  const [scopes, setScopes] = useState<Array<{ id: string; title: string; status: string; start_date: string | null; end_date: string | null; service_categories: string[] }>>([]);
  const [scopesLoading, setScopesLoading] = useState(false);
  const [showNewScope, setShowNewScope] = useState(false);
  const [isEmployeeToggling, setIsEmployeeToggling] = useState(false);
  const { checkWithDisposition, GuardDialog } = useOutreachGuard(slug);

  const { person, isLoading, error, refresh, setPerson } = usePerson(personId);
  const removePerson = usePersonStore((s) => s.removePerson);

  const getPersonDisposition = useCallback(() => {
    if (!person?.disposition_id) return null;
    const disp = dispositions.find((d) => d.id === person.disposition_id);
    if (!disp) return null;
    return { name: disp.name, blocks_outreach: disp.blocks_outreach ?? false };
  }, [person?.disposition_id, dispositions]);

  const handleGuardedSendEmail = useCallback(() => {
    if (!person) return;
    const disp = getPersonDisposition();
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unknown';
    checkWithDisposition(person.id, name, disp, () => setShowSendEmail(true));
  }, [person, getPersonDisposition, checkWithDisposition]);

  const handleValidateEmail = async () => {
    if (!person?.email) return;
    setEmailValidating(true);
    try {
      const response = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: [person.email],
          personIds: [personId],
          projectSlug: slug,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result?.valid) {
          toast.success('Email verified successfully');
        } else {
          toast.warning(`Email validation failed: ${result?.reason ?? 'Unknown'}`);
        }
        refresh();
      }
    } catch {
      toast.error('Failed to validate email');
    } finally {
      setEmailValidating(false);
    }
  };

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${slug}/activity?person_id=${personId}&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  }, [slug, personId]);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadActivities();
    }
  }, [activeTab, loadActivities]);

  // Open Sales Navigator with person profile
  const openInSalesNav = useCallback(() => {
    if (!person) return;
    const orgName = person.organizations?.[0]?.organization?.name;
    const url = getSalesNavUrl(person, orgName);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [person]);

  // Generate and copy LinkedIn connection message
  const copyConnectionMessage = useCallback(async () => {
    if (!person) return;
    setIsGeneratingMessage(true);
    try {
      const orgName = person.organizations?.[0]?.organization?.name;
      const response = await fetch(`/api/projects/${slug}/linkedin/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: person.first_name,
          last_name: person.last_name,
          job_title: person.job_title,
          company: orgName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate message');
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.message);
      setMessageCopied(true);
      toast.success('LinkedIn message copied to clipboard');
      setTimeout(() => setMessageCopied(false), 3000);
    } catch (err) {
      console.error('Error generating message:', err);
      toast.error('Failed to generate connection message');
    } finally {
      setIsGeneratingMessage(false);
    }
  }, [person, slug]);

  // Log LinkedIn activity
  const logLinkedInActivity = useCallback(async (
    outcome: 'linkedin_connection_sent' | 'linkedin_connection_accepted' | 'linkedin_inmail_sent' | 'linkedin_message_sent'
  ) => {
    if (!person) return;
    setLoggingLinkedIn(outcome);
    try {
      const outcomeLabels: Record<string, string> = {
        linkedin_connection_sent: 'Connection request sent',
        linkedin_connection_accepted: 'Connection accepted',
        linkedin_inmail_sent: 'InMail sent',
        linkedin_message_sent: 'Message sent',
      };

      const response = await fetch(`/api/projects/${slug}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'person',
          entity_id: personId,
          action: 'logged',
          activity_type: 'linkedin',
          person_id: personId,
          organization_id: person.organizations?.[0]?.organization_id || null,
          subject: `LinkedIn: ${outcomeLabels[outcome]}`,
          outcome,
          direction: 'outbound',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to log activity');
      }

      toast.success(outcomeLabels[outcome]);

      // Refresh activities if on activity tab
      if (activeTab === 'activity') {
        loadActivities();
      }
    } catch (err) {
      console.error('Error logging LinkedIn activity:', err);
      toast.error('Failed to log LinkedIn activity');
    } finally {
      setLoggingLinkedIn(null);
    }
  }, [person, personId, slug, activeTab, loadActivities]);

  // Load contractor scopes for community projects
  const loadScopes = useCallback(async () => {
    if (projectType !== 'community') return;
    setScopesLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/contractor-scopes?contractorId=${personId}`);
      if (response.ok) {
        const data = await response.json() as { scopes?: typeof scopes };
        setScopes(data.scopes ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setScopesLoading(false);
    }
  }, [slug, personId, projectType]);

  useEffect(() => {
    if (projectType === 'community') {
      void loadScopes();
    }
  }, [projectType, loadScopes]);

  async function toggleIsEmployee() {
    if (!person) return;
    const newValue = !(person.is_employee ?? false);
    setIsEmployeeToggling(true);
    try {
      const res = await fetch(`/api/projects/${slug}/employees/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_employee: newValue }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to update');
      }
      toast.success(newValue ? 'Marked as employee' : 'Employee status removed');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update employee status');
    } finally {
      setIsEmployeeToggling(false);
    }
  }

  // Check for completed but unreviewed enrichments on mount (no auto-popup)
  useEffect(() => {
    const checkForCompletedEnrichment = async () => {
      try {
        const response = await fetch(
          `/api/projects/${slug}/enrich?person_id=${personId}&limit=1`
        );
        if (!response.ok) return;

        const data = await response.json();
        const latestJob = data.jobs?.[0];

        // Store unreviewed enrichment data for the "View Enrichment" button
        if (latestJob?.status === 'completed' && latestJob.result && !latestJob.reviewed_at) {
          setPendingEnrichmentData(latestJob.result as EnrichmentPerson);
          setPendingEnrichmentJobId(latestJob.id);
        }
      } catch (err) {
        console.error('Error checking for completed enrichment:', err);
      }
    };

    if (slug && personId) {
      checkForCompletedEnrichment();
    }
  }, [slug, personId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePerson(slug, personId);
      removePerson(personId);
      toast.success('Person deleted');
      setShowDeleteDialog(false);
      router.push(backUrl);
    } catch (err) {
      setIsDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Failed to delete person');
    }
  };

  const markEnrichmentReviewed = useCallback(async () => {
    if (!pendingEnrichmentJobId) return;
    try {
      await fetch(`/api/projects/${slug}/enrich`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: pendingEnrichmentJobId }),
      });
    } catch {
      // Non-critical — just prevents auto-showing next time
    }
  }, [slug, pendingEnrichmentJobId]);

  const handleApplyPendingEnrichment = async (selectedFields: Record<string, string | null>) => {
    if (Object.keys(selectedFields).length === 0) return;

    setIsApplyingEnrichment(true);
    try {
      const response = await fetch(`/api/projects/${slug}/people/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedFields),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to apply enrichment');
      }

      await markEnrichmentReviewed();
      setShowPendingReviewModal(false);
      setPendingEnrichmentData(null);
      setPendingEnrichmentJobId(null);
      refresh();
    } catch (err) {
      console.error('Error applying enrichment:', err);
    } finally {
      setIsApplyingEnrichment(false);
    }
  };

  const handleDismissEnrichment = async () => {
    await markEnrichmentReviewed();
    setShowPendingReviewModal(false);
    setPendingEnrichmentData(null);
    setPendingEnrichmentJobId(null);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  };

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`.trim();
  };

  if (isLoading && !person) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error || 'Person not found'}
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <h2 className="text-2xl font-bold">Edit Person</h2>
        </div>
        <PersonForm
          person={person}
          onSuccess={() => {
            setIsEditing(false);
            refresh();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const addressParts = [
    person.address_city,
    person.address_state,
    person.address_country,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowLogActivity(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Log Activity
          </Button>
          <Button variant="outline" onClick={() => setShowCreateTask(true)}>
            <ListTodo className="mr-2 h-4 w-4" />
            Follow Up
          </Button>
          {person.email && (
            <Button variant="outline" onClick={handleGuardedSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          )}
          {pendingEnrichmentData && (
            <Button
              variant="outline"
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
              onClick={() => setShowPendingReviewModal(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              View Enrichment Results
            </Button>
          )}
          <EnrichButton
            personId={personId}
            personName={getFullName(person.first_name, person.last_name)}
            currentPerson={{
              email: person.email,
              phone: person.phone,
              mobile_phone: person.mobile_phone,
              job_title: person.job_title,
              linkedin_url: person.linkedin_url,
              address_city: person.address_city,
              address_state: person.address_state,
              address_country: person.address_country,
            }}
            onEnriched={() => refresh()}
          />
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage
            src={person.avatar_url ?? undefined}
            alt={getFullName(person.first_name, person.last_name)}
          />
          <AvatarFallback className="text-lg">
            {getInitials(person.first_name, person.last_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">
            {getFullName(person.first_name, person.last_name)}
          </h2>
          {person.job_title && (
            <p className="text-muted-foreground">{person.job_title}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {dispositions.length > 0 && (
              <Select
                value={person.disposition_id ?? 'none'}
                onValueChange={async (v) => {
                  const newId = v === 'none' ? null : v;
                  try {
                    await updatePersonApi(slug, person.id, { disposition_id: newId });
                    setPerson((current) => (
                      current ? { ...current, disposition_id: newId } : current
                    ));
                    toast.success('Disposition updated');
                  } catch {
                    toast.error('Failed to update disposition');
                  }
                }}
              >
                <SelectTrigger className="h-7 w-auto gap-1 border-dashed text-xs px-2">
                  <SelectValue placeholder="Set disposition">
                    {(() => {
                      const disp = dispositions.find((d) => d.id === person.disposition_id);
                      if (disp) {
                        const colors = DISPOSITION_COLOR_MAP[disp.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray;
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {disp.name}
                          </span>
                        );
                      }
                      return <span className="text-muted-foreground">Set disposition</span>;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No disposition</SelectItem>
                  {dispositions.map((d) => {
                    const colors = DISPOSITION_COLOR_MAP[d.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray;
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`} />
                          {d.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {person.department && (
              <Badge variant="secondary">
                {person.department}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            Info
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-2">
            <Send className="h-4 w-4" />
            Sequences
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Clock className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <PhoneCall className="h-4 w-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments
          </TabsTrigger>
          {projectType === 'community' && (
            <TabsTrigger value="relationships" className="gap-2">
              <Users className="h-4 w-4" />
              Relationships
            </TabsTrigger>
          )}
          {projectType === 'community' && (
            <TabsTrigger value="approved-for" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Assets
            </TabsTrigger>
          )}
          {projectType === 'community' && (
            <TabsTrigger value="participation" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Participation
            </TabsTrigger>
          )}
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {person.email && (
                  <div className="flex items-center gap-2">
                    <ClickableEmail
                      email={person.email}
                      onEmailClick={handleGuardedSendEmail}
                      showIcon={true}
                      variant="link"
                    />
                    {person.email_verified === true && (
                      <span title={`Verified${person.email_verified_at ? ` on ${new Date(person.email_verified_at).toLocaleDateString()}` : ''}`}>
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      </span>
                    )}
                    {person.email_verified === false && person.email_verified_at && (
                      <span title="Email verification failed">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleValidateEmail}
                      disabled={emailValidating}
                      title="Validate email (MX check)"
                    >
                      {emailValidating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <ClickablePhone
                      phoneNumber={person.phone}
                      personId={personId}
                      organizationId={person.organizations?.[0]?.organization_id}
                      showIcon={true}
                      variant="link"
                    />
                  </div>
                )}
                {person.mobile_phone && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <ClickablePhone
                      phoneNumber={person.mobile_phone}
                      personId={personId}
                      organizationId={person.organizations?.[0]?.organization_id}
                      showIcon={false}
                      variant="link"
                    />
                  </div>
                )}
                {addressParts.length > 0 && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{addressParts.join(', ')}</span>
                  </div>
                )}
                {person.timezone && (
                  <div className="text-sm text-muted-foreground">
                    Timezone: {person.timezone}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>LinkedIn & Social</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {person.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={person.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                {person.twitter_handle && (
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-muted-foreground" />
                    <span>@{person.twitter_handle}</span>
                  </div>
                )}
                {!person.linkedin_url && !person.twitter_handle && (
                  <p className="text-sm text-muted-foreground">
                    No social profiles added
                  </p>
                )}

                {/* LinkedIn Quick Actions */}
                <div className="pt-3 border-t space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openInSalesNav}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Sales Navigator
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyConnectionMessage}
                      disabled={isGeneratingMessage}
                      className="gap-1.5"
                    >
                      {messageCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {isGeneratingMessage ? 'Generating...' : messageCopied ? 'Copied!' : 'Copy Message'}
                    </Button>
                  </div>

                  {/* Log LinkedIn Activity */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Log LinkedIn Activity:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => logLinkedInActivity('linkedin_connection_sent')}
                        disabled={loggingLinkedIn !== null}
                        className="h-7 text-xs gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        {loggingLinkedIn === 'linkedin_connection_sent' ? 'Logging...' : 'Sent Request'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => logLinkedInActivity('linkedin_connection_accepted')}
                        disabled={loggingLinkedIn !== null}
                        className="h-7 text-xs gap-1"
                      >
                        <Users className="h-3 w-3" />
                        {loggingLinkedIn === 'linkedin_connection_accepted' ? 'Logging...' : 'Connected'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Stats</CardTitle>
                <CardDescription>Related records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Organizations</span>
                  </div>
                  <Badge variant="outline">{person.organization_count ?? 0}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Opportunities</span>
                  </div>
                  <Badge variant="outline">{person.opportunities_count ?? 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contractor Scopes — community projects only */}
          {projectType === 'community' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Contractor Scopes
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowNewScope(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Scope
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scopesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : scopes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contractor scopes yet. Add one to define their work agreement.</p>
                ) : (
                  <div className="space-y-3">
                    {scopes.map((scope) => (
                      <Link
                        key={scope.id}
                        href={`/projects/${slug}/contractors/${personId}`}
                        className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{scope.title}</span>
                          <Badge variant="secondary">{(scope.status ?? 'draft').replace(/_/g, ' ')}</Badge>
                        </div>
                        {scope.service_categories?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {scope.service_categories.map((cat) => (
                              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                        )}
                        {(scope.start_date || scope.end_date) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {scope.start_date && `From ${new Date(scope.start_date).toLocaleDateString()}`}
                            {scope.start_date && scope.end_date && ' — '}
                            {scope.end_date && `To ${new Date(scope.end_date).toLocaleDateString()}`}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employee status — community projects only */}
          {projectType === 'community' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Hourly employee</p>
                    <p className="text-xs text-muted-foreground">
                      Enables kiosk clock-in/out and the employee portal for this person.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={person.is_employee ? 'default' : 'outline'}
                    onClick={() => void toggleIsEmployee()}
                    disabled={isEmployeeToggling}
                    className="shrink-0"
                  >
                    {person.is_employee ? 'Employee ✓' : 'Mark as Employee'}
                  </Button>
                </div>
                {person.is_employee && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Set a kiosk PIN from the{' '}
                    <Link href={`/projects/${slug}/employees/${personId}`} className="underline hover:text-foreground">
                      employee detail page
                    </Link>
                    .
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {person.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{person.notes}</p>
              </CardContent>
            </Card>
          )}

          {person.custom_fields && Object.keys(person.custom_fields).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Custom Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(person.custom_fields).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm font-medium text-muted-foreground">{key}</p>
                      <p>{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-6">
          <EntityEmailTab
            projectSlug={slug}
            personId={personId}
          />
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-6">
          <PersonSequencesTab
            projectSlug={slug}
            personId={personId}
            personName={getFullName(person.first_name, person.last_name)}
            personEmail={person.email}
            personJobTitle={person.job_title}
            projectCompanyContext={companyContext}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Recent activity for this person
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                activities={activities}
                loading={activitiesLoading}
                emptyMessage="No activity recorded for this person yet"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Call Log</CardTitle>
              <CardDescription>
                Calls made to and from this person
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CallLogTable personId={personId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-6">
          <SmsConversation
            personId={personId}
            phoneNumbers={[
              ...(person.mobile_phone
                ? [{ number: person.mobile_phone, label: 'Mobile' }]
                : []),
              ...(person.phone ? [{ number: person.phone, label: 'Phone' }] : []),
            ]}
            entityName={`${person.first_name} ${person.last_name}`}
          />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
              <CardDescription>
                Internal notes and discussion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EntityCommentsFeed
                entityType="person"
                entityId={personId}
                currentUserId={currentUserId ?? ''}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {projectType === 'community' && (
          <TabsContent value="relationships" className="space-y-6">
            <PersonRelationshipsTab personId={personId} />
          </TabsContent>
        )}
        {projectType === 'community' && (
          <TabsContent value="approved-for" className="space-y-6">
            <PersonApprovedForTab personId={personId} />
          </TabsContent>
        )}
        {projectType === 'community' && (
          <TabsContent value="participation" className="space-y-6">
            <PersonParticipationTab personId={personId} />
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Person</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {getFullName(person.first_name, person.last_name)}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {GuardDialog}

      <SendEmailModal
        open={showSendEmail}
        onOpenChange={setShowSendEmail}
        projectSlug={slug}
        defaultTo={person.email ?? ''}
        personId={personId}
        organizationId={person.organizations?.[0]?.organization_id}
      />

      <LogActivityModal
        open={showLogActivity}
        onOpenChange={setShowLogActivity}
        projectSlug={slug}
        personId={personId}
        personName={getFullName(person.first_name, person.last_name)}
        organizationId={person.organizations?.[0]?.organization_id}
        onSuccess={() => {
          if (activeTab === 'activity') {
            loadActivities();
          }
        }}
      />

      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectSlug={slug}
        personId={personId}
        organizationId={person.organizations?.[0]?.organization_id}
        defaultTitle={`Follow up with ${getFullName(person.first_name, person.last_name)}`}
      />

      {projectType === 'community' && (
        <NewScopeDialog
          open={showNewScope}
          onOpenChange={setShowNewScope}
          projectSlug={slug}
          contractorId={personId}
          onCreated={() => void loadScopes()}
        />
      )}

      <EnrichmentReviewModal
        open={showPendingReviewModal}
        onClose={handleDismissEnrichment}
        enrichmentData={pendingEnrichmentData}
        currentPerson={{
          email: person.email,
          phone: person.phone,
          mobile_phone: person.mobile_phone,
          job_title: person.job_title,
          linkedin_url: person.linkedin_url,
          address_city: person.address_city,
          address_state: person.address_state,
          address_country: person.address_country,
        }}
        onApply={handleApplyPendingEnrichment}
        isApplying={isApplyingEnrichment}
      />
    </div>
  );
}
