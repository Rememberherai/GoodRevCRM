import { describe, expect, it } from 'vitest';
import { computeHouseholdRiskScore, sortRiskScores } from '@/lib/community/risk-index';

describe('community risk index', () => {
  it('scores households from active signals', () => {
    const result = computeHouseholdRiskScore({
      householdId: 'household-1',
      householdName: 'Martinez Family',
      activeProgramEnrollments: 0,
      relationshipCount: 0,
      unresolvedReferrals: 2,
      recentEngagementCount: 0,
      childCount: 2,
      adultCount: 1,
    }, {
      enableDemographicSignals: true,
    });

    expect(result.score).toBe(100);
    expect(result.tier).toBe('high');
    expect(result.contributions.filter((item) => item.active)).toHaveLength(6);
  });

  it('sorts higher-risk households first', () => {
    const sorted = sortRiskScores([
      computeHouseholdRiskScore({
        householdId: 'b',
        householdName: 'Bravo',
        activeProgramEnrollments: 1,
        relationshipCount: 1,
        unresolvedReferrals: 0,
        recentEngagementCount: 1,
      }),
      computeHouseholdRiskScore({
        householdId: 'a',
        householdName: 'Alpha',
        activeProgramEnrollments: 0,
        relationshipCount: 0,
        unresolvedReferrals: 1,
        recentEngagementCount: 0,
      }),
    ]);

    expect(sorted[0]?.householdId).toBe('a');
    expect(sorted[1]?.householdId).toBe('b');
  });
});
