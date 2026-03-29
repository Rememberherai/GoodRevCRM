import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { computeHouseholdRiskScore, sortRiskScores, type RiskWeights } from '@/lib/community/risk-index';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function computeProjectRiskScores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  weights?: Partial<RiskWeights>
) {
  const householdsResult = await supabase
    .from('households')
    .select('id, name')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  const households = householdsResult.data ?? [];
  const householdIds = households.map((household: { id: string }) => household.id);
  if (householdIds.length === 0) {
    return [];
  }

  const [enrollmentsResult, referralsResult, contributionsResult, membersResult, relationshipsResult] = await Promise.all([
    supabase
      .from('program_enrollments')
      .select('household_id, status')
      .in('household_id', householdIds)
      .in('status', ['active', 'pending']),
    supabase
      .from('referrals')
      .select('household_id, status')
      .eq('project_id', projectId)
      .in('household_id', householdIds),
    supabase.from('contributions').select('donor_household_id, recipient_household_id, date').eq('project_id', projectId),
    supabase
      .from('household_members')
      .select('household_id, person_id, relationship')
      .in('household_id', householdIds),
    supabase.from('relationships').select('person_a_id, person_b_id').eq('project_id', projectId),
  ]);

  const relationshipCounts = new Map<string, number>();
  const childCounts = new Map<string, number>();
  const adultCounts = new Map<string, number>();
  for (const member of membersResult.data ?? []) {
    if (member.relationship === 'child' || member.relationship === 'dependent') {
      childCounts.set(member.household_id, (childCounts.get(member.household_id) ?? 0) + 1);
    } else {
      adultCounts.set(member.household_id, (adultCounts.get(member.household_id) ?? 0) + 1);
    }
  }
  for (const relationship of relationshipsResult.data ?? []) {
    for (const member of membersResult.data ?? []) {
      if (member.person_id === relationship.person_a_id || member.person_id === relationship.person_b_id) {
        relationshipCounts.set(member.household_id, (relationshipCounts.get(member.household_id) ?? 0) + 1);
      }
    }
  }

  const enrollmentCounts = new Map<string, number>();
  for (const enrollment of enrollmentsResult.data ?? []) {
    if (!enrollment.household_id) continue;
    enrollmentCounts.set(enrollment.household_id, (enrollmentCounts.get(enrollment.household_id) ?? 0) + 1);
  }

  const unresolvedReferralCounts = new Map<string, number>();
  for (const referral of referralsResult.data ?? []) {
    if (!referral.household_id) continue;
    if (referral.status === 'completed' || referral.status === 'closed') continue;
    unresolvedReferralCounts.set(referral.household_id, (unresolvedReferralCounts.get(referral.household_id) ?? 0) + 1);
  }

  const engagementCounts = new Map<string, number>();
  for (const contribution of contributionsResult.data ?? []) {
    if (contribution.donor_household_id) {
      engagementCounts.set(contribution.donor_household_id, (engagementCounts.get(contribution.donor_household_id) ?? 0) + 1);
    }
    if (contribution.recipient_household_id) {
      engagementCounts.set(contribution.recipient_household_id, (engagementCounts.get(contribution.recipient_household_id) ?? 0) + 1);
    }
  }

  return sortRiskScores(households.map((household: { id: string; name: string | null }) => computeHouseholdRiskScore({
    householdId: household.id,
    householdName: household.name,
    activeProgramEnrollments: enrollmentCounts.get(household.id) ?? 0,
    relationshipCount: relationshipCounts.get(household.id) ?? 0,
    unresolvedReferrals: unresolvedReferralCounts.get(household.id) ?? 0,
    recentEngagementCount: engagementCounts.get(household.id) ?? 0,
    childCount: childCounts.get(household.id) ?? 0,
    adultCount: adultCounts.get(household.id) ?? 0,
  }, {
    weights,
    enableDemographicSignals: true,
  })));
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type, settings').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const settings = (project.settings ?? {}) as { risk_index_enabled?: boolean; risk_index_weights?: Partial<RiskWeights> };
    if (!settings.risk_index_enabled) {
      return NextResponse.json({ scores: [] });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'risk_scores', 'view');

    const weights = settings.risk_index_weights;
    const scores = await computeProjectRiskScores(supabase as never, project.id, weights);
    return NextResponse.json({ scores });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/community/risk-index:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type, settings').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const postSettings = (project.settings ?? {}) as { risk_index_enabled?: boolean; risk_index_weights?: Partial<RiskWeights> };
    if (!postSettings.risk_index_enabled) {
      return NextResponse.json({ scores: [] });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'risk_scores', 'update');

    const body = await request.json().catch(() => ({})) as { weights?: Partial<RiskWeights> };
    const fallbackWeights = postSettings.risk_index_weights;
    const scores = await computeProjectRiskScores(supabase as never, project.id, body.weights ?? fallbackWeights);

    for (const score of scores.filter((item) => item.tier === 'high')) {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'risk_score.high' as never,
        entityType: 'household',
        entityId: score.householdId,
        data: score as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ scores });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/community/risk-index:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
