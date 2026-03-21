'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RiskContribution {
  key: string;
  label: string;
  weight: number;
  active: boolean;
}

interface HouseholdRiskScore {
  householdId: string;
  householdName?: string | null;
  score: number;
  tier: 'low' | 'medium' | 'high';
  contributions: RiskContribution[];
}

function tierVariant(tier: HouseholdRiskScore['tier']) {
  if (tier === 'high') return 'destructive';
  if (tier === 'medium') return 'secondary';
  return 'outline';
}

export function RiskExplainability({ score }: { score: HouseholdRiskScore }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <ShieldAlert className="mr-2 h-4 w-4" />
          Explain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{score.householdName ?? 'Household Risk Score'}</span>
            <Badge variant={tierVariant(score.tier)}>{score.tier}</Badge>
            <span className="text-sm font-normal text-muted-foreground">Score {score.score}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            This score is a decision-support signal for case managers. It does not trigger automated outreach or service decisions.
          </div>

          <div className="space-y-3">
            {score.contributions.map((contribution) => (
              <div key={contribution.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="font-medium">{contribution.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Weight: {contribution.weight}
                  </div>
                </div>
                <Badge variant={contribution.active ? 'destructive' : 'outline'}>
                  {contribution.active ? 'Active signal' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Demographic signals should be interpreted carefully. They are disabled by default in the model and should never be used as adverse-action triggers.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
