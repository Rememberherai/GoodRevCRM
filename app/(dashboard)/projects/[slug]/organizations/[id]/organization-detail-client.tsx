'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Globe,
  Pencil,
  Trash2,
  Users,
  Target,
  Plus,
  Mail,
  Bot,
  Check,
  X,
  Settings,
  FileText,
  DollarSign,
  Calendar,
  Send,
  Clock,
  Loader2,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useOrganization } from '@/hooks/use-organizations';
import { useOrganizationStore, deleteOrganization, updateOrganizationApi } from '@/stores/organization';
import { useEntityCustomFields } from '@/hooks/use-custom-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { AddPersonDialog } from '@/components/organizations/add-person-dialog';
import { AddOpportunityDialog } from '@/components/organizations/add-opportunity-dialog';
import { AddRfpDialog } from '@/components/organizations/add-rfp-dialog';
import { ContactDiscoveryDialog } from '@/components/organizations/contact-discovery-dialog';
import { ResearchPanel } from '@/components/research/research-panel';
import { ResearchResultsDialog } from '@/components/research/research-results-dialog';
import { ResearchSettingsDialog } from '@/components/research/research-settings-dialog';
import { toast } from 'sonner';
import { AddFieldDialog } from '@/components/schema/add-field-dialog';
import { EditFieldDialog } from '@/components/schema/edit-field-dialog';
import { DeleteFieldDialog } from '@/components/schema/delete-field-dialog';
import { OrgSequencesTab } from '@/components/organizations/org-sequences-tab';
import { EntityActivitySection } from '@/components/activity/entity-activity-section';
import { EntityMeetingsSection } from '@/components/meetings/entity-meetings-section';
import { EntityEmailTab } from '@/components/email/entity-email-tab';
import { SendEmailModal } from '@/components/gmail';
import { EntityCommentsFeed } from '@/components/comments';
import { BulkActionsBar } from '@/components/bulk/bulk-actions-bar';
import { BulkEnrichWithReviewModal } from '@/components/enrichment/bulk-enrich-with-review-modal';
import { OrgNewsSection } from '@/components/news/org-news-section';
import { OrgNewsFetchCard } from '@/components/news/org-news-fetch-card';
import { ClickToDialButton } from '@/components/calls/click-to-dial-button';
import { CallLogTable } from '@/components/calls/call-log-table';
import { SmsConversation } from '@/components/sms/sms-conversation';
import { PhoneCall, MessageSquareText } from 'lucide-react';
import { LogoUpload } from '@/components/ui/logo-upload';
import { fetchPeople } from '@/stores/person';
import type { ResearchJob } from '@/types/research';
import { ClickableEmail } from '@/components/contacts/clickable-email';
import { ClickablePhone } from '@/components/contacts/clickable-phone';
// Activity types no longer needed - EntityActivitySection handles its own data
import type { CompanyContext } from '@/lib/validators/project';
import type { Person } from '@/types/person';
import type { Opportunity } from '@/types/opportunity';
import type { Rfp } from '@/types/rfp';
import type { CustomFieldDefinition } from '@/types/custom-field';
import { STAGE_LABELS } from '@/types/opportunity';
import { STATUS_LABELS } from '@/types/rfp';

interface OrganizationDetailClientProps {
  organizationId: string;
  companyContext?: CompanyContext;
  currentUserId?: string;
}

interface EditableFieldProps {
  label: string;
  value: string | number | null | undefined;
  fieldKey: string;
  type?: 'text' | 'number' | 'url' | 'textarea';
  onSave: (key: string, value: string | number | null) => Promise<void>;
  prefix?: string;
  suffix?: string;
}

function EditableField({ label, value, fieldKey, type = 'text', onSave, prefix, suffix }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalValue: string | number | null = editValue || null;
      if (type === 'number' && editValue) {
        finalValue = parseFloat(editValue);
      }
      await onSave(fieldKey, finalValue);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() ?? '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {type === 'textarea' ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm"
              rows={3}
              autoFocus
            />
          ) : (
            <Input
              type={type === 'number' ? 'number' : type === 'url' ? 'url' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              autoFocus
            />
          )}
          <Button size="sm" variant="ghost" onClick={handleSave} disabled={isSaving}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </div>
    );
  }

  const displayValue = value !== null && value !== undefined && value !== ''
    ? `${prefix ?? ''}${type === 'number' ? Number(value).toLocaleString() : value}${suffix ?? ''}`
    : '—';

  return (
    <div
      className="space-y-1 p-2 -m-2 rounded cursor-pointer hover:bg-muted/50 transition-colors group"
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to edit"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {type === 'url' && value ? (
        <a
          href={value.toString()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {value.toString()}
        </a>
      ) : (
        <p className={`text-sm ${!value ? 'text-muted-foreground' : ''}`}>{displayValue}</p>
      )}
    </div>
  );
}

export function OrganizationDetailClient({ organizationId, companyContext, currentUserId }: OrganizationDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState('info');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResearchResults, setShowResearchResults] = useState(false);
  const [researchJob, setResearchJob] = useState<ResearchJob | null>(null);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [showAddOpportunityDialog, setShowAddOpportunityDialog] = useState(false);
  const [showAddRfpDialog, setShowAddRfpDialog] = useState(false);
  const [showContactDiscovery, setShowContactDiscovery] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
  const [bulkEnrichOpen, setBulkEnrichOpen] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [rfpsLoading, setRfpsLoading] = useState(false);

  // Research buttons state (for custom fields card)
  const [isResearching, setIsResearching] = useState(false);
  const [showResearchSettings, setShowResearchSettings] = useState(false);

  // Custom field dialog states
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [showEditFieldDialog, setShowEditFieldDialog] = useState(false);
  const [showDeleteFieldDialog, setShowDeleteFieldDialog] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomFieldDefinition | null>(null);

  // News refresh state
  const [newsRefreshKey, setNewsRefreshKey] = useState(0);
  const handleNewsFetchComplete = useCallback(() => {
    setNewsRefreshKey(prev => prev + 1);
  }, []);

  const { organization, isLoading, error, refresh } = useOrganization(organizationId);
  const { fields: customFields } = useEntityCustomFields('organization');
  const setCurrentOrganization = useOrganizationStore((s) => s.setCurrentOrganization);

  const loadPeople = useCallback(async () => {
    if (!slug) return;
    setPeopleLoading(true);
    try {
      const result = await fetchPeople(slug, { organizationId });
      setPeople(result.people);
    } catch {
      // Silently fail, people section will show empty
    } finally {
      setPeopleLoading(false);
    }
  }, [slug, organizationId]);

  const loadOpportunities = useCallback(async () => {
    if (!slug) return;
    setOpportunitiesLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/opportunities?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities);
      }
    } catch {
      // Silently fail
    } finally {
      setOpportunitiesLoading(false);
    }
  }, [slug, organizationId]);

  const loadRfps = useCallback(async () => {
    if (!slug) return;
    setRfpsLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/rfps?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setRfps(data.rfps);
      }
    } catch {
      // Silently fail
    } finally {
      setRfpsLoading(false);
    }
  }, [slug, organizationId]);


  useEffect(() => {
    loadPeople();
    loadOpportunities();
    loadRfps();
  }, [loadPeople, loadOpportunities, loadRfps]);


  const handleResearchComplete = (job: ResearchJob) => {
    setResearchJob(job);
    setShowResearchResults(true);
  };

  const startResearch = useCallback(async () => {
    if (!slug || isResearching) return;
    setIsResearching(true);
    try {
      const response = await fetch(`/api/projects/${slug}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'organization',
          entity_id: organizationId,
          include_custom_fields: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start research');
      }
      if (data.job.status === 'completed') {
        toast.success('Research completed successfully');
        handleResearchComplete(data.job);
      } else if (data.job.status === 'failed') {
        toast.error('Research failed: ' + (data.job.error ?? 'Unknown error'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start research';
      toast.error(message);
    } finally {
      setIsResearching(false);
    }
  }, [slug, organizationId, isResearching]);

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

  const handleFieldSave = async (key: string, value: string | number | null) => {
    if (!organization) return;

    const updateData = { [key]: value };
    const updated = await updateOrganizationApi(slug, organizationId, updateData);
    setCurrentOrganization({ ...updated, people_count: organization.people_count ?? 0, opportunities_count: organization.opportunities_count ?? 0 });
  };

  const handleCustomFieldSave = async (fieldName: string, value: unknown) => {
    if (!organization) return;

    const currentCustomFields = (organization.custom_fields as Record<string, unknown>) ?? {};
    const updatedCustomFields = { ...currentCustomFields, [fieldName]: value };

    const updated = await updateOrganizationApi(slug, organizationId, { custom_fields: updatedCustomFields });
    setCurrentOrganization({ ...updated, people_count: organization.people_count ?? 0, opportunities_count: organization.opportunities_count ?? 0 });
  };

  const handleEditField = (field: CustomFieldDefinition) => {
    setSelectedField(field);
    setShowEditFieldDialog(true);
  };

  const handleDeleteField = (field: CustomFieldDefinition) => {
    setSelectedField(field);
    setShowDeleteFieldDialog(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPersonInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  };

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`.trim();
  };

  const handlePersonAdded = () => {
    loadPeople();
    refresh();
  };

  const togglePersonSelection = (id: string) => {
    setSelectedPeopleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllPeople = () => {
    if (selectedPeopleIds.size === people.length) {
      setSelectedPeopleIds(new Set());
    } else {
      setSelectedPeopleIds(new Set(people.map((p) => p.id)));
    }
  };

  const clearPeopleSelection = () => {
    setSelectedPeopleIds(new Set());
  };

  const selectedPeople = people.filter((p) => selectedPeopleIds.has(p.id));

  const handleOpportunityAdded = () => {
    loadOpportunities();
    refresh();
  };

  const handleRfpAdded = () => {
    loadRfps();
    refresh();
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

  const customFieldValues = (organization.custom_fields as Record<string, unknown>) ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${slug}/organizations`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSendEmail(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Send Email
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

      {/* Organization Header */}
      <div className="flex items-center gap-4">
        <LogoUpload
          currentUrl={organization.logo_url}
          fallbackInitials={getInitials(organization.name)}
          entityType="organization"
          entityId={organization.id}
          onUploaded={(url) => {
            setCurrentOrganization({ ...organization, logo_url: url });
          }}
          size="lg"
        />
        <div className="flex-1">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info" className="gap-2">
            <Building2 className="h-4 w-4" />
            Info
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-2">
            <Users className="h-4 w-4" />
            People
            {(organization.people_count ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {organization.people_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-2">
            <Target className="h-4 w-4" />
            Opportunities
            {(organization.opportunities_count ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {organization.opportunities_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rfps" className="gap-2">
            <FileText className="h-4 w-4" />
            RFPs
            {rfps.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {rfps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-2">
            <Send className="h-4 w-4" />
            Sequences
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Clock className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <Calendar className="h-4 w-4" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Research
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <PhoneCall className="h-4 w-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField
                  label="Description"
                  value={organization.description}
                  fieldKey="description"
                  type="textarea"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Employees"
                  value={organization.employee_count}
                  fieldKey="employee_count"
                  type="number"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Annual Revenue"
                  value={organization.annual_revenue}
                  fieldKey="annual_revenue"
                  type="number"
                  onSave={handleFieldSave}
                  prefix="$"
                />
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
                <EditableField
                  label="Website"
                  value={organization.website}
                  fieldKey="website"
                  type="url"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="LinkedIn"
                  value={organization.linkedin_url}
                  fieldKey="linkedin_url"
                  type="url"
                  onSave={handleFieldSave}
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <EditableField
                      label="Phone"
                      value={organization.phone}
                      fieldKey="phone"
                      onSave={handleFieldSave}
                    />
                  </div>
                  {organization.phone && (
                    <ClickToDialButton
                      phoneNumber={organization.phone}
                      organizationId={organizationId}
                    />
                  )}
                </div>
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

          {/* All Fields - Read Only with Double Click to Edit */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Double-click any field to edit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <EditableField
                  label="Name"
                  value={organization.name}
                  fieldKey="name"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Domain"
                  value={organization.domain}
                  fieldKey="domain"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Industry"
                  value={organization.industry}
                  fieldKey="industry"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Street Address"
                  value={organization.address_street}
                  fieldKey="address_street"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="City"
                  value={organization.address_city}
                  fieldKey="address_city"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="State"
                  value={organization.address_state}
                  fieldKey="address_state"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Postal Code"
                  value={organization.address_postal_code}
                  fieldKey="address_postal_code"
                  onSave={handleFieldSave}
                />
                <EditableField
                  label="Country"
                  value={organization.address_country}
                  fieldKey="address_country"
                  onSave={handleFieldSave}
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom Fields with CRUD */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Custom Fields</CardTitle>
                <CardDescription>Custom data fields for this organization</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResearchSettings(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  onClick={startResearch}
                  disabled={isResearching}
                  size="sm"
                >
                  {isResearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Researching...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Research {organization.name}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddFieldDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {customFields.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No custom fields defined yet. Click &quot;Add Field&quot; to create one.
                </p>
              ) : (
                <div className="space-y-4">
                  {customFields.map((field) => {
                    const value = customFieldValues[field.name];
                    return (
                      <div key={field.id} className="flex items-start gap-4 p-3 rounded-lg border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">{field.label}</p>
                            {field.is_required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <EditableField
                            label=""
                            value={value as string | number | null | undefined}
                            fieldKey={field.name}
                            type={field.field_type === 'textarea' ? 'textarea' : field.field_type === 'number' || field.field_type === 'currency' || field.field_type === 'percentage' ? 'number' : field.field_type === 'url' ? 'url' : 'text'}
                            onSave={(_, val) => handleCustomFieldSave(field.name, val)}
                            prefix={field.field_type === 'currency' ? '$' : undefined}
                            suffix={field.field_type === 'percentage' ? '%' : undefined}
                          />
                          {field.description && (
                            <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditField(field)}
                            title="Edit field definition"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteField(field)}
                            className="text-destructive hover:text-destructive"
                            title="Delete field"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* News Fetch Card */}
          <OrgNewsFetchCard
            projectSlug={slug}
            organizationId={organizationId}
            organizationName={organization.name}
            onFetchComplete={handleNewsFetchComplete}
          />

          {/* Related News */}
          <OrgNewsSection key={newsRefreshKey} projectSlug={slug} organizationId={organizationId} />
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">People</h3>
              <p className="text-sm text-muted-foreground">
                Contacts associated with this organization
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowContactDiscovery(true)}>
                <Bot className="mr-2 h-4 w-4" />
                Find People
              </Button>
              <Button onClick={() => setShowAddPersonDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Person
              </Button>
            </div>
          </div>

          {peopleLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : people.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No people yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add contacts associated with this organization
                  </p>
                  <Button onClick={() => setShowAddPersonDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first person
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20">
                <Checkbox
                  checked={people.length > 0 && selectedPeopleIds.size === people.length}
                  onCheckedChange={toggleSelectAllPeople}
                  aria-label="Select all people"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedPeopleIds.size > 0 ? `${selectedPeopleIds.size} selected` : 'Select all'}
                </span>
              </div>
              <div className="grid gap-3">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedPeopleIds.has(person.id)}
                      onCheckedChange={() => togglePersonSelection(person.id)}
                      aria-label={`Select ${getFullName(person.first_name, person.last_name)}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Link
                      href={`/projects/${slug}/people/${person.id}?from=org&orgId=${organizationId}`}
                      className="flex items-center gap-4 flex-1 min-w-0"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={person.avatar_url ?? undefined} alt={getFullName(person.first_name, person.last_name)} />
                        <AvatarFallback>{getPersonInitials(person.first_name, person.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {getFullName(person.first_name, person.last_name)}
                        </div>
                        {person.job_title && (
                          <div className="text-sm text-muted-foreground">
                            {person.job_title}
                          </div>
                        )}
                      </div>
                      {person.email && (
                        <div
                          className="hidden md:flex items-center gap-2 text-sm"
                          onClick={(e) => e.preventDefault()}
                        >
                          <ClickableEmail
                            email={person.email}
                            onEmailClick={() => {
                              // Open email modal - would need to implement state for this
                              window.location.href = `mailto:${person.email}`;
                            }}
                            showIcon={true}
                            variant="link"
                            size="sm"
                          />
                        </div>
                      )}
                      {person.phone && (
                        <div
                          className="hidden lg:flex items-center gap-2 text-sm"
                          onClick={(e) => e.preventDefault()}
                        >
                          <ClickablePhone
                            phoneNumber={person.phone}
                            personId={person.id}
                            organizationId={organizationId}
                            showIcon={true}
                            variant="link"
                            size="sm"
                          />
                        </div>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bulk Actions Bar */}
          {selectedPeopleIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <BulkActionsBar
                selectedCount={selectedPeopleIds.size}
                entityType="person"
                onClearSelection={clearPeopleSelection}
                onBulkAction={async () => {}}
                showEnrich
                onEnrich={() => setBulkEnrichOpen(true)}
              />
            </div>
          )}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Opportunities</h3>
              <p className="text-sm text-muted-foreground">
                Sales opportunities associated with this organization
              </p>
            </div>
            <Button onClick={() => setShowAddOpportunityDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Opportunity
            </Button>
          </div>

          {opportunitiesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : opportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No opportunities yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Track sales opportunities for this organization
                  </p>
                  <Button onClick={() => setShowAddOpportunityDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first opportunity
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/projects/${slug}/opportunities/${opp.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{opp.name}</div>
                    <Badge
                      variant="secondary"
                      className={
                        opp.stage === 'closed_won' ? 'bg-green-100 text-green-800' :
                        opp.stage === 'closed_lost' ? 'bg-red-100 text-red-800' :
                        opp.stage === 'negotiation' ? 'bg-orange-100 text-orange-800' :
                        opp.stage === 'proposal' ? 'bg-amber-100 text-amber-800' :
                        opp.stage === 'qualification' ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      }
                    >
                      {STAGE_LABELS[opp.stage]}
                    </Badge>
                  </div>
                  {opp.amount && (
                    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>{opp.currency ?? 'USD'} {Number(opp.amount).toLocaleString()}</span>
                    </div>
                  )}
                  {opp.expected_close_date && (
                    <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(opp.expected_close_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* RFPs Tab */}
        <TabsContent value="rfps" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">RFPs</h3>
              <p className="text-sm text-muted-foreground">
                Request for Proposals associated with this organization
              </p>
            </div>
            <Button onClick={() => setShowAddRfpDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add RFP
            </Button>
          </div>

          {rfpsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : rfps.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No RFPs yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Track RFPs from this organization
                  </p>
                  <Button onClick={() => setShowAddRfpDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first RFP
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {rfps.map((rfp) => (
                <Link
                  key={rfp.id}
                  href={`/projects/${slug}/rfps/${rfp.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{rfp.title}</div>
                    {rfp.rfp_number && (
                      <div className="text-sm text-muted-foreground">{rfp.rfp_number}</div>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        rfp.status === 'won' ? 'bg-green-100 text-green-800' :
                        rfp.status === 'lost' ? 'bg-red-100 text-red-800' :
                        rfp.status === 'no_bid' ? 'bg-slate-100 text-slate-800' :
                        rfp.status === 'submitted' ? 'bg-purple-100 text-purple-800' :
                        rfp.status === 'preparing' ? 'bg-amber-100 text-amber-800' :
                        rfp.status === 'reviewing' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {STATUS_LABELS[rfp.status]}
                    </Badge>
                  </div>
                  {rfp.estimated_value && (
                    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>{rfp.currency ?? 'USD'} {Number(rfp.estimated_value).toLocaleString()}</span>
                    </div>
                  )}
                  {rfp.due_date && (
                    <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(rfp.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-6">
          <EntityEmailTab
            projectSlug={slug}
            organizationId={organizationId}
          />
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-6">
          <OrgSequencesTab
            projectSlug={slug}
            organizationId={organizationId}
            organizationName={organization.name}
            organizationDomain={organization.domain}
            organizationDescription={organization.description}
            projectCompanyContext={companyContext}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <EntityActivitySection
            projectSlug={slug}
            entityType="organization"
            entityId={organizationId}
            organizationId={organizationId}
            organizationName={organization.name}
          />
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-6">
          <EntityMeetingsSection
            projectSlug={slug}
            entityType="organization"
            entityId={organizationId}
            organizationId={organizationId}
            organizationName={organization.name}
          />
        </TabsContent>

        {/* AI Research Tab */}
        <TabsContent value="research" className="space-y-6">
          <ResearchPanel
            entityType="organization"
            entityId={organizationId}
            entityName={organization.name}
            onResearchComplete={handleResearchComplete}
          />
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-6">
          <CallLogTable organizationId={organizationId} />
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-6">
          <SmsConversation
            organizationId={organizationId}
            phoneNumbers={organization.phone ? [{ number: organization.phone, label: 'Main' }] : []}
            entityName={organization.name}
          />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-6">
          <EntityCommentsFeed
            entityType="organization"
            entityId={organizationId}
            currentUserId={currentUserId ?? ''}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
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

      <AddPersonDialog
        open={showAddPersonDialog}
        onOpenChange={setShowAddPersonDialog}
        organizationId={organizationId}
        organizationName={organization.name}
        onPersonAdded={handlePersonAdded}
      />

      <ContactDiscoveryDialog
        open={showContactDiscovery}
        onOpenChange={setShowContactDiscovery}
        organizationId={organizationId}
        organizationName={organization.name}
        onContactsAdded={handlePersonAdded}
      />

      <AddOpportunityDialog
        open={showAddOpportunityDialog}
        onOpenChange={setShowAddOpportunityDialog}
        organizationId={organizationId}
        organizationName={organization.name}
        onOpportunityAdded={handleOpportunityAdded}
      />

      <AddRfpDialog
        open={showAddRfpDialog}
        onOpenChange={setShowAddRfpDialog}
        organizationId={organizationId}
        organizationName={organization.name}
        onRfpAdded={handleRfpAdded}
      />

      <SendEmailModal
        open={showSendEmail}
        onOpenChange={setShowSendEmail}
        projectSlug={slug}
        organizationId={organizationId}
      />

      <AddFieldDialog
        open={showAddFieldDialog}
        onOpenChange={setShowAddFieldDialog}
        entityType="organization"
      />

      <EditFieldDialog
        open={showEditFieldDialog}
        onOpenChange={setShowEditFieldDialog}
        field={selectedField}
      />

      <DeleteFieldDialog
        open={showDeleteFieldDialog}
        onOpenChange={setShowDeleteFieldDialog}
        field={selectedField}
      />

      <ResearchSettingsDialog
        slug={slug}
        entityType="organization"
        open={showResearchSettings}
        onOpenChange={setShowResearchSettings}
      />

      <BulkEnrichWithReviewModal
        open={bulkEnrichOpen}
        onClose={() => setBulkEnrichOpen(false)}
        selectedPeople={selectedPeople}
        projectSlug={slug}
        onComplete={() => {
          clearPeopleSelection();
          loadPeople();
        }}
      />
    </div>
  );
}
