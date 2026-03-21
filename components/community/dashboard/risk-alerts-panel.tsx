'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RiskAlerts } from '@/components/community/dashboard/risk-alerts';

interface RiskAlert {
  householdId: string;
  householdName?: string | null;
  score: number;
  tier: 'low' | 'medium' | 'high';
  contributions: Array<{
    key: string;
    label: string;
    weight: number;
    active: boolean;
  }>;
}

export function RiskAlertsPanel() {
  const params = useParams();
  const slug = params.slug as string;
  const [scores, setScores] = useState<RiskAlert[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadRiskScores = async () => {
      const response = await fetch(`/api/projects/${slug}/community/risk-index`);
      if (!response.ok) {
        setReady(true);
        return;
      }

      const data = await response.json() as { scores?: RiskAlert[] };
      setScores((data.scores ?? []).filter((score) => score.score >= 35).slice(0, 5));
      setReady(true);
    };

    void loadRiskScores();
  }, [slug]);

  if (!ready || scores.length === 0) {
    return null;
  }

  return <RiskAlerts scores={scores} />;
}
