'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Globe,
  Linkedin,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Users,
  Target,
} from 'lucide-react';
import { useOrganization } from '@/hooks/use-organizations';
import { useOrganizationStore, deleteOrganization } from '@/stores/organization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { OrganizationForm } from '@/components/organizations/organization-form';
import { ResearchPanel } from '@/components/research/research-panel';
import { ResearchResultsDialog } from '@/components/research/research-results-dialog';
import type { ResearchJob } from '@/types/research';

interface OrganizationDetailClientProps {
  organizationId: string;
}

export function OrganizationDetailClient({ organizationId }: OrganizationDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResearchResults, setShowResearchResults] = useState(false);
  const [researchJob, setResearchJob] = useState<ResearchJob | null>(null);

  const { organization, isLoading, error, refresh } = useOrganization(organizationId);

  const handleResearchComplete = (job: ResearchJob) => {
    setResearchJob(job);
    setShowResearchResults(true);
  };
  const removeOrganization = useOrganizationStore((s) => s.removeOrganization);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOrganization(slug, organizationId);
      removeOrganization(organizationId);
      router.push(`/projects/${slug}/organizations`);
    } catch {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/organizations`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error || 'Organization not found'}
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
          <h2 className="text-2xl font-bold">Edit Organization</h2>
        </div>
        <OrganizationForm
          organization={organization}
          onSuccess={() => {
            setIsEditing(false);
            refresh();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const addressParts = [
    organization.address_street,
    organization.address_city,
    organization.address_state,
    organization.address_postal_code,
    organization.address_country,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/organizations`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
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
        <Avatar className="h-16 w-16">
          <AvatarImage src={organization.logo_url ?? undefined} alt={organization.name} />
          <AvatarFallback className="text-lg">{getInitials(organization.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">{organization.name}</h2>
          {organization.domain && (
            <p className="text-muted-foreground">{organization.domain}</p>
          )}
          {organization.industry && (
            <Badge variant="secondary" className="mt-1">
              {organization.industry}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm">{organization.description}</p>
              </div>
            )}
            {organization.employee_count && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Employees</p>
                <p>{organization.employee_count.toLocaleString()}</p>
              </div>
            )}
            {organization.annual_revenue && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Annual Revenue</p>
                <p>${organization.annual_revenue.toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {organization.website}
                </a>
              </div>
            )}
            {organization.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a
                  href={organization.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn Profile
                </a>
              </div>
            )}
            {organization.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{organization.phone}</span>
              </div>
            )}
            {addressParts.length > 0 && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{addressParts.join(', ')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Stats</CardTitle>
            <CardDescription>Related records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">People</span>
              </div>
              <Badge variant="outline">{organization.people_count ?? 0}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Opportunities</span>
              </div>
              <Badge variant="outline">{organization.opportunities_count ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {organization.custom_fields && Object.keys(organization.custom_fields).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(organization.custom_fields).map(([key, value]) => (
                <div key={key}>
                  <p className="text-sm font-medium text-muted-foreground">{key}</p>
                  <p>{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ResearchPanel
        entityType="organization"
        entityId={organizationId}
        entityName={organization.name}
        onResearchComplete={handleResearchComplete}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{organization.name}&quot;? This action cannot
              be undone.
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

      <ResearchResultsDialog
        open={showResearchResults}
        onOpenChange={setShowResearchResults}
        job={researchJob}
        onApplied={refresh}
      />
    </div>
  );
}
