'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskExplainability } from '@/components/community/households/risk-explainability';

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

export function RiskAlerts({ scores }: { scores: RiskAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Alerts</CardTitle>
        <CardDescription>
          Households surfaced for case-manager review. This list is visible only to case-management roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {scores.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No elevated-risk households right now.
          </div>
        ) : (
          scores.map((score) => (
            <div key={score.householdId} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{score.householdName ?? 'Unnamed household'}</div>
                <div className="text-sm text-muted-foreground">
                  Score {score.score} with {score.contributions.filter((item) => item.active).length} active signals
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={score.tier === 'high' ? 'destructive' : 'secondary'}>
                  {score.tier}
                </Badge>
                <RiskExplainability score={score} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
