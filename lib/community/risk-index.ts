export interface RiskWeights {
  noPrograms: number;
  noRelationships: number;
  unresolvedReferrals: number;
  noRecentEngagement: number;
  youngChildren: number;
  singleAdultHousehold: number;
}

export interface HouseholdRiskSignals {
  householdId: string;
  householdName?: string | null;
  activeProgramEnrollments: number;
  relationshipCount: number;
  unresolvedReferrals: number;
  recentEngagementCount: number;
  childCount?: number;
  adultCount?: number;
}

export interface RiskContribution {
  key: keyof RiskWeights;
  label: string;
  weight: number;
  active: boolean;
}

export interface HouseholdRiskScore {
  householdId: string;
  householdName?: string | null;
  score: number;
  tier: 'low' | 'medium' | 'high';
  contributions: RiskContribution[];
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  noPrograms: 25,
  noRelationships: 20,
  unresolvedReferrals: 25,
  noRecentEngagement: 20,
  youngChildren: 5,
  singleAdultHousehold: 5,
};

export interface RiskComputationOptions {
  weights?: Partial<RiskWeights>;
  enableDemographicSignals?: boolean;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(Math.round(value), 100));
}

function getTier(score: number): HouseholdRiskScore['tier'] {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function computeHouseholdRiskScore(
  signals: HouseholdRiskSignals,
  options: RiskComputationOptions = {}
): HouseholdRiskScore {
  const weights: RiskWeights = {
    ...DEFAULT_RISK_WEIGHTS,
    ...(options.weights ?? {}),
  };

  const includeDemographics = Boolean(options.enableDemographicSignals);

  const contributions: RiskContribution[] = [
    {
      key: 'noPrograms',
      label: 'No active program enrollments',
      weight: weights.noPrograms,
      active: signals.activeProgramEnrollments === 0,
    },
    {
      key: 'noRelationships',
      label: 'No social relationships recorded',
      weight: weights.noRelationships,
      active: signals.relationshipCount === 0,
    },
    {
      key: 'unresolvedReferrals',
      label: 'Open referrals unresolved',
      weight: weights.unresolvedReferrals,
      active: signals.unresolvedReferrals > 0,
    },
    {
      key: 'noRecentEngagement',
      label: 'No recent engagement recorded',
      weight: weights.noRecentEngagement,
      active: signals.recentEngagementCount === 0,
    },
    {
      key: 'youngChildren',
      label: 'Young children present',
      weight: weights.youngChildren,
      active: includeDemographics && (signals.childCount ?? 0) > 0,
    },
    {
      key: 'singleAdultHousehold',
      label: 'Single-adult household',
      weight: weights.singleAdultHousehold,
      active: includeDemographics && (signals.adultCount ?? 0) === 1,
    },
  ];

  const score = clampScore(
    contributions.reduce((sum, contribution) => (
      contribution.active ? sum + contribution.weight : sum
    ), 0)
  );

  return {
    householdId: signals.householdId,
    householdName: signals.householdName,
    score,
    tier: getTier(score),
    contributions,
  };
}

export function sortRiskScores(scores: HouseholdRiskScore[]) {
  return [...scores].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return (left.householdName ?? '').localeCompare(right.householdName ?? '');
  });
}
