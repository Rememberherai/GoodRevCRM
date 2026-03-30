'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Home, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseholdMembersTab } from '@/components/community/households/household-members-tab';
import { NewReferralDialog } from '@/components/community/referrals/new-referral-dialog';
import { CasePlanTab } from '@/components/community/cases/case-plan-tab';
import { HouseholdTimelineTab } from '@/components/community/cases/household-timeline-tab';
import { ReportIncidentDialog } from '@/components/community/incidents/report-incident-dialog';

interface HouseholdMemberRecord {
  id: string;
  person_id: string;
  relationship: string;
  is_primary_contact: boolean;
  start_date: string;
  end_date: string | null;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface HouseholdIntakeRecord {
  id: string;
  assessed_at: string;
  status: string;
  notes: string | null;
}

interface HouseholdDetail {
  id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  household_size: number | null;
  notes: string | null;
  household_members: HouseholdMemberRecord[];
  intake_records: HouseholdIntakeRecord[];
  can_view_intake: boolean;
  can_manage_cases: boolean;
  can_manage_incidents: boolean;
  program_enrollments_count: number;
  contributions_count: number;
  active_case: {
    id: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    opened_at: string;
    last_contact_at: string | null;
    next_follow_up_at: string | null;
    summary: string | null;
  } | null;
}

export function HouseholdDetailClient({ householdId }: { householdId: string }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [household, setHousehold] = useState<HouseholdDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canViewIntake, setCanViewIntake] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'members');

  const loadHousehold = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${slug}/households/${householdId}`);
      const data = await response.json() as { household?: HouseholdDetail; error?: string };

      if (!response.ok || !data.household) {
        throw new Error(data.error ?? 'Failed to load household');
      }

      setHousehold(data.household);
      setCanViewIntake(data.household.can_view_intake);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load household');
    } finally {
      setIsLoading(false);
    }
  }, [householdId, slug]);

  useEffect(() => {
    void loadHousehold(true);
  }, [loadHousehold]);

  const address = useMemo(() => {
    if (!household) return '';
    return [
      household.address_street,
      household.address_city,
      household.address_state,
      household.address_postal_code,
    ].filter(Boolean).join(', ');
  }, [household]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !household) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/households`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Households
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? 'Household not found'}
        </div>
        {household?.can_manage_incidents && (
          <Button variant="outline" onClick={() => setShowIncidentDialog(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/households`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Households
        </Link>
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{household.name}</h2>
              <div className="text-sm text-muted-foreground">
                {address || 'No address recorded'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              {household.household_members.length} members
            </Badge>
            {household.household_size !== null && (
              <Badge variant="outline">Household size {household.household_size}</Badge>
            )}
          </div>
        </div>
        {household.can_manage_incidents ? (
          <Button variant="outline" onClick={() => setShowIncidentDialog(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{address || 'No address recorded yet'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Program Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{household.program_enrollments_count}</div>
            <p className="text-sm text-muted-foreground">Linked enrollments so far</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{household.contributions_count}</div>
            <p className="text-sm text-muted-foreground">Recorded value exchanges</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          {canViewIntake && <TabsTrigger value="intake">Intake</TabsTrigger>}
          {household.can_manage_cases && <TabsTrigger value="case-plan">Case Plan</TabsTrigger>}
          {household.can_manage_cases && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="pt-4">
          <HouseholdMembersTab
            householdId={household.id}
            initialMembers={household.household_members}
            onRefresh={() => loadHousehold(false)}
          />
        </TabsContent>

        <TabsContent value="programs" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Programs</CardTitle>
              <CardDescription>
                Program enrollments linked to this household.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This household currently has {household.program_enrollments_count} linked enrollment
              {household.program_enrollments_count === 1 ? '' : 's'}.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contributions</CardTitle>
              <CardDescription>
                Contributions linked to this household.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This household currently has {household.contributions_count} linked contribution
              {household.contributions_count === 1 ? '' : 's'}.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Referrals</CardTitle>
                <CardDescription>
                  Create and follow community service handoffs for this household.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowReferralDialog(true)}>New Referral</Button>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Use the referrals workspace to monitor partner acknowledgements, in-progress services, and completed outcomes tied to this household.
            </CardContent>
          </Card>
        </TabsContent>

        {canViewIntake && (
          <TabsContent value="intake" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Intake Records</CardTitle>
                <CardDescription>
                  Sensitive intake data is limited to case-management roles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {household.intake_records.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No intake records yet.
                  </div>
                ) : (
                  household.intake_records.map((record) => (
                    <div key={record.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Badge variant="secondary">{record.status}</Badge>
                        <div className="text-xs text-muted-foreground">
                          {new Date(record.assessed_at).toLocaleString()}
                        </div>
                      </div>
                      {record.notes && (
                        <p className="mt-3 text-sm text-muted-foreground">{record.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {household.can_manage_cases && (
          <TabsContent value="case-plan" className="pt-4">
            <CasePlanTab
              projectSlug={slug}
              householdId={household.id}
              activeCase={household.active_case}
              onCaseChanged={() => loadHousehold(false)}
            />
          </TabsContent>
        )}

        {household.can_manage_cases && (
          <TabsContent value="timeline" className="pt-4">
            <HouseholdTimelineTab projectSlug={slug} householdId={household.id} />
          </TabsContent>
        )}
      </Tabs>

      <NewReferralDialog
        open={showReferralDialog}
        onOpenChange={setShowReferralDialog}
        initialHouseholdId={household.id}
        onCreated={() => setShowReferralDialog(false)}
      />

      <ReportIncidentDialog
        open={showIncidentDialog}
        onOpenChange={setShowIncidentDialog}
        projectSlug={slug}
        initialHouseholdId={household.id}
        showVisibilitySelector={household.can_manage_cases}
      />
    </div>
  );
}
