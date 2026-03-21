import { describe, expect, it } from 'vitest';
import { buildInfluencerScores } from '@/lib/community/social-network';

describe('community social network utilities', () => {
  it('computes relationship and bridging scores', () => {
    const scores = buildInfluencerScores([
      {
        id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
        person_a_id: 'person-a',
        person_b_id: 'person-b',
        project_id: 'project-1',
        type: 'neighbor',
      },
      {
        id: '2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
        person_a_id: 'person-a',
        person_b_id: 'person-c',
        project_id: 'project-1',
        type: 'friend',
      },
    ]);

    expect(scores[0]).toEqual({
      personId: 'person-a',
      relationshipCount: 2,
      bridgingCount: 1,
    });
  });
});
