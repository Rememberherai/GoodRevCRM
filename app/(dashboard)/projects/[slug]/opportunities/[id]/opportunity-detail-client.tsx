'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Pencil,
  Percent,
  Target,
  Trash2,
  User,
  Trophy,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { useOpportunity } from '@/hooks/use-opportunities';
import { useOpportunityStore, deleteOpportunity } from '@/stores/opportunity';
import { STAGE_LABELS, type OpportunityStage } from '@/types/opportunity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { OpportunityForm } from '@/components/opportunities/opportunity-form';

interface OpportunityDetailClientProps {
  opportunityId: string;
}

const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospecting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  qualification: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  proposal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  closed_won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed_lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function OpportunityDetailClient({ opportunityId }: OpportunityDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { opportunity, isLoading, error, refresh } = useOpportunity(opportunityId);
  const removeOpportunity = useOpportunityStore((s) => s.removeOpportunity);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOpportunity(slug, opportunityId);
      removeOpportunity(opportunityId);
      router.push(`/projects/${slug}/opportunities`);
    } catch {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/opportunities`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunities
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error || 'Opportunity not found'}
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
          <h2 className="text-2xl font-bold">Edit Opportunity</h2>
        </div>
        <OpportunityForm
          opportunity={opportunity}
          onSuccess={() => {
            setIsEditing(false);
            refresh();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/opportunities`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunities
          </Link>
        </Button>
        <div className="flex items-center gap-2">
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
        <div>
          <h2 className="text-2xl font-bold">{opportunity.name}</h2>
          <Badge className={STAGE_COLORS[opportunity.stage]} variant="secondary">
            {STAGE_LABELS[opportunity.stage]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Deal Value
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">
                {formatCurrency(opportunity.amount, opportunity.currency)}
              </p>
              {opportunity.currency && opportunity.currency !== 'USD' && (
                <p className="text-sm text-muted-foreground">{opportunity.currency}</p>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Probability</span>
              </div>
              <span className="font-medium">
                {opportunity.probability !== null ? `${opportunity.probability}%` : '—'}
              </span>
            </div>
            {opportunity.amount !== null && opportunity.probability !== null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Weighted Value</span>
                </div>
                <span className="font-medium">
                  {formatCurrency(
                    opportunity.amount * (opportunity.probability / 100),
                    opportunity.currency
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Expected Close Date</p>
              <p className="font-medium">{formatDate(opportunity.expected_close_date)}</p>
            </div>
            {opportunity.actual_close_date && (
              <div>
                <p className="text-sm text-muted-foreground">Actual Close Date</p>
                <p className="font-medium">{formatDate(opportunity.actual_close_date)}</p>
              </div>
            )}
            {opportunity.stage_changed_at && (
              <div>
                <p className="text-sm text-muted-foreground">Stage Changed</p>
                <p className="font-medium">{formatDate(opportunity.stage_changed_at)}</p>
              </div>
            )}
            {opportunity.days_in_stage !== null && opportunity.days_in_stage > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Days in Stage</p>
                <p className="font-medium">{opportunity.days_in_stage} days</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {opportunity.source && (
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium">{opportunity.source}</p>
              </div>
            )}
            {opportunity.campaign && (
              <div>
                <p className="text-sm text-muted-foreground">Campaign</p>
                <p className="font-medium">{opportunity.campaign}</p>
              </div>
            )}
            {opportunity.competitor && (
              <div>
                <p className="text-sm text-muted-foreground">Competitor</p>
                <p className="font-medium">{opportunity.competitor}</p>
              </div>
            )}
            {!opportunity.source && !opportunity.campaign && !opportunity.competitor && (
              <p className="text-sm text-muted-foreground">No additional details</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(opportunity.organization || opportunity.primary_contact) && (
        <div className="grid gap-6 md:grid-cols-2">
          {opportunity.organization && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/projects/${slug}/organizations/${opportunity.organization.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{opportunity.organization.name}</p>
                    {opportunity.organization.domain && (
                      <p className="text-sm text-muted-foreground">
                        {opportunity.organization.domain}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {opportunity.primary_contact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Primary Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/projects/${slug}/people/${opportunity.primary_contact.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {opportunity.primary_contact.first_name}{' '}
                      {opportunity.primary_contact.last_name}
                    </p>
                    {opportunity.primary_contact.email && (
                      <p className="text-sm text-muted-foreground">
                        {opportunity.primary_contact.email}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {opportunity.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{opportunity.description}</p>
          </CardContent>
        </Card>
      )}

      {(opportunity.won_reason || opportunity.lost_reason) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {opportunity.stage === 'closed_won' ? (
                <Trophy className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {opportunity.stage === 'closed_won' ? 'Won Reason' : 'Lost Reason'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">
              {opportunity.won_reason || opportunity.lost_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {opportunity.custom_fields && Object.keys(opportunity.custom_fields).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(opportunity.custom_fields).map(([key, value]) => (
                <div key={key}>
                  <p className="text-sm font-medium text-muted-foreground">{key}</p>
                  <p>{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action
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
    </div>
  );
}
