import type { Database } from '@/types/database';

type RelationshipRow = Database['public']['Tables']['relationships']['Row'];

export interface InfluencerScore {
  personId: string;
  relationshipCount: number;
  bridgingCount: number;
}

function increment(map: Map<string, number>, key: string, delta = 1) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

export function buildInfluencerScores(relationships: RelationshipRow[]): InfluencerScore[] {
  const relationshipCounts = new Map<string, number>();
  const bridgingCounts = new Map<string, number>();

  for (const relationship of relationships) {
    increment(relationshipCounts, relationship.person_a_id);
    increment(relationshipCounts, relationship.person_b_id);

    if (relationship.type === 'neighbor' || relationship.type === 'service_provider_client' || relationship.type === 'mentor_mentee') {
      increment(bridgingCounts, relationship.person_a_id);
      increment(bridgingCounts, relationship.person_b_id);
    }
  }

  return Array.from(relationshipCounts.entries())
    .map(([personId, relationshipCount]) => ({
      personId,
      relationshipCount,
      bridgingCount: bridgingCounts.get(personId) ?? 0,
    }))
    .sort((left, right) => {
      if (right.relationshipCount !== left.relationshipCount) {
        return right.relationshipCount - left.relationshipCount;
      }
      return right.bridgingCount - left.bridgingCount;
    });
}
