'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  FileText,
  Mail,
  Pencil,
  Percent,
  Target,
  Trash2,
  Trophy,
  XCircle,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { useRfp } from '@/hooks/use-rfps';
import { useRfpStore, deleteRfp } from '@/stores/rfp';
import { STATUS_LABELS, type RfpStatus } from '@/types/rfp';
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
import { RfpForm } from '@/components/rfps/rfp-form';

interface RfpDetailClientProps {
  rfpId: string;
}

const STATUS_COLORS: Record<RfpStatus, string> = {
  identified: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  reviewing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  preparing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  submitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  no_bid: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

export function RfpDetailClient({ rfpId }: RfpDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { rfp, isLoading, error, refresh } = useRfp(rfpId);
  const removeRfp = useRfpStore((s) => s.removeRfp);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRfp(slug, rfpId);
      removeRfp(rfpId);
      router.push(`/projects/${slug}/rfps`);
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

  const formatDateTime = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getGoNoGoIcon = (decision: string | null) => {
    switch (decision) {
      case 'go':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'no_go':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-amber-600" />;
    }
  };

  const getGoNoGoLabel = (decision: string | null) => {
    switch (decision) {
      case 'go':
        return 'Go';
      case 'no_go':
        return 'No Go';
      default:
        return 'Pending';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/rfps`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to RFPs
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error || 'RFP not found'}
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
          <h2 className="text-2xl font-bold">Edit RFP</h2>
        </div>
        <RfpForm
          rfp={rfp}
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
          <Link href={`/projects/${slug}/rfps`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to RFPs
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

      <div>
        <h2 className="text-2xl font-bold">{rfp.title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={STATUS_COLORS[rfp.status]} variant="secondary">
            {STATUS_LABELS[rfp.status]}
          </Badge>
          {rfp.rfp_number && (
            <span className="text-muted-foreground">#{rfp.rfp_number}</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDateTime(rfp.due_date)}</p>
            </div>
            {rfp.issue_date && (
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDate(rfp.issue_date)}</p>
              </div>
            )}
            {rfp.questions_due_date && (
              <div>
                <p className="text-sm text-muted-foreground">Questions Due</p>
                <p className="font-medium">{formatDateTime(rfp.questions_due_date)}</p>
              </div>
            )}
            {rfp.decision_date && (
              <div>
                <p className="text-sm text-muted-foreground">Decision Date</p>
                <p className="font-medium">{formatDate(rfp.decision_date)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Value
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">
                {formatCurrency(rfp.estimated_value, rfp.currency)}
              </p>
              {rfp.budget_range && (
                <p className="text-sm text-muted-foreground">{rfp.budget_range}</p>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Win Probability</span>
              </div>
              <span className="font-medium">
                {rfp.win_probability !== null ? `${rfp.win_probability}%` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Go/No-Go Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {getGoNoGoIcon(rfp.go_no_go_decision)}
              <span className="font-medium">{getGoNoGoLabel(rfp.go_no_go_decision)}</span>
            </div>
            {rfp.go_no_go_date && (
              <div>
                <p className="text-sm text-muted-foreground">Decision Date</p>
                <p className="font-medium">{formatDate(rfp.go_no_go_date)}</p>
              </div>
            )}
            {rfp.go_no_go_notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{rfp.go_no_go_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfp.submission_method && (
              <div>
                <p className="text-sm text-muted-foreground">Method</p>
                <p className="font-medium capitalize">{rfp.submission_method}</p>
              </div>
            )}
            {rfp.submission_portal_url && (
              <div>
                <p className="text-sm text-muted-foreground">Portal</p>
                <a
                  href={rfp.submission_portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Portal
                </a>
              </div>
            )}
            {rfp.submission_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a
                  href={`mailto:${rfp.submission_email}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  {rfp.submission_email}
                </a>
              </div>
            )}
            {rfp.submission_instructions && (
              <div>
                <p className="text-sm text-muted-foreground">Instructions</p>
                <p className="whitespace-pre-wrap">{rfp.submission_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(rfp.organization || rfp.opportunity) && (
        <div className="grid gap-6 md:grid-cols-2">
          {rfp.organization && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Issuing Organization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/projects/${slug}/organizations/${rfp.organization.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{rfp.organization.name}</p>
                    {rfp.organization.domain && (
                      <p className="text-sm text-muted-foreground">
                        {rfp.organization.domain}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {rfp.opportunity && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Related Opportunity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/projects/${slug}/opportunities/${rfp.opportunity.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Target className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{rfp.opportunity.name}</p>
                    {rfp.opportunity.amount && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(rfp.opportunity.amount, null)}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {rfp.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{rfp.description}</p>
          </CardContent>
        </Card>
      )}

      {(rfp.rfp_document_url || rfp.response_document_url) && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfp.rfp_document_url && (
              <a
                href={rfp.rfp_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                RFP Document
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {rfp.response_document_url && (
              <a
                href={rfp.response_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                Response Document
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {(rfp.outcome_reason || rfp.feedback || rfp.awarded_to) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {rfp.status === 'won' ? (
                <Trophy className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfp.outcome_reason && (
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="whitespace-pre-wrap">{rfp.outcome_reason}</p>
              </div>
            )}
            {rfp.awarded_to && (
              <div>
                <p className="text-sm text-muted-foreground">Awarded To</p>
                <p>{rfp.awarded_to}</p>
              </div>
            )}
            {rfp.feedback && (
              <div>
                <p className="text-sm text-muted-foreground">Feedback</p>
                <p className="whitespace-pre-wrap">{rfp.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rfp.custom_fields && Object.keys(rfp.custom_fields).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(rfp.custom_fields).map(([key, value]) => (
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
            <AlertDialogTitle>Delete RFP</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{rfp.title}&quot;? This action
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
