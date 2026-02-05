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
  Phone,
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
import { usePersonStore, deletePerson } from '@/stores/person';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { PersonForm } from '@/components/people/person-form';
import { PersonSequencesTab } from '@/components/people/person-sequences-tab';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import { EntityEmailTab } from '@/components/email/entity-email-tab';
import { SendEmailModal } from '@/components/gmail';
import { EntityCommentsFeed } from '@/components/comments';
import { ClickToDialButton } from '@/components/calls/click-to-dial-button';
import { CallLogTable } from '@/components/calls/call-log-table';
import { PhoneCall } from 'lucide-react';
import type { CompanyContext } from '@/lib/validators/project';
import type { ActivityWithUser } from '@/types/activity';

interface PersonDetailClientProps {
  personId: string;
  companyContext?: CompanyContext;
  currentUserId?: string;
}

export function PersonDetailClient({ personId, companyContext, currentUserId }: PersonDetailClientProps) {
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

  const { person, isLoading, error, refresh } = usePerson(personId);
  const removePerson = usePersonStore((s) => s.removePerson);

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
      router.push(backUrl);
    } catch {
      setIsDeleting(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !person) {
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
          {person.email && (
            <Button variant="outline" onClick={() => setShowSendEmail(true)}>
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
          {person.department && (
            <Badge variant="secondary" className="mt-1">
              {person.department}
            </Badge>
          )}
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
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments
          </TabsTrigger>
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
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowSendEmail(true)}
                      className="text-primary hover:underline"
                    >
                      {person.email}
                    </button>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="select-all">{person.phone}</span>
                    <ClickToDialButton
                      phoneNumber={person.phone}
                      personId={personId}
                      organizationId={person.organizations?.[0]?.id}
                    />
                  </div>
                )}
                {person.mobile_phone && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="select-all">{person.mobile_phone}</span>
                    <ClickToDialButton
                      phoneNumber={person.mobile_phone}
                      personId={personId}
                      organizationId={person.organizations?.[0]?.id}
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
                <CardTitle>Social</CardTitle>
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
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendEmailModal
        open={showSendEmail}
        onOpenChange={setShowSendEmail}
        projectSlug={slug}
        defaultTo={person.email ?? ''}
        personId={personId}
        organizationId={person.organizations?.[0]?.id}
      />

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
