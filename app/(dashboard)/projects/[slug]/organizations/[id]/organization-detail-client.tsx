'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Globe,
  Pencil,
  Phone,
  Trash2,
  Users,
  Target,
  Plus,
  Mail,
  Bot,
  Check,
  X,
  Settings,
} from 'lucide-react';
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
import { ContactDiscoveryDialog } from '@/components/organizations/contact-discovery-dialog';
import { ResearchPanel } from '@/components/research/research-panel';
import { ResearchResultsDialog } from '@/components/research/research-results-dialog';
import { AddFieldDialog } from '@/components/schema/add-field-dialog';
import { EditFieldDialog } from '@/components/schema/edit-field-dialog';
import { DeleteFieldDialog } from '@/components/schema/delete-field-dialog';
import { fetchPeople } from '@/stores/person';
import type { ResearchJob } from '@/types/research';
import type { Person } from '@/types/person';
import type { CustomFieldDefinition } from '@/types/custom-field';

interface OrganizationDetailClientProps {
  organizationId: string;
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

export function OrganizationDetailClient({ organizationId }: OrganizationDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState('info');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResearchResults, setShowResearchResults] = useState(false);
  const [researchJob, setResearchJob] = useState<ResearchJob | null>(null);
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [showContactDiscovery, setShowContactDiscovery] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  // Custom field dialog states
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [showEditFieldDialog, setShowEditFieldDialog] = useState(false);
  const [showDeleteFieldDialog, setShowDeleteFieldDialog] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomFieldDefinition | null>(null);

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

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

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
        <Avatar className="h-16 w-16">
          <AvatarImage src={organization.logo_url ?? undefined} alt={organization.name} />
          <AvatarFallback className="text-lg">{getInitials(organization.name)}</AvatarFallback>
        </Avatar>
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
          <TabsTrigger value="research" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Research
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
                <EditableField
                  label="Phone"
                  value={organization.phone}
                  fieldKey="phone"
                  onSave={handleFieldSave}
                />
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
                  label="Logo URL"
                  value={organization.logo_url}
                  fieldKey="logo_url"
                  type="url"
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddFieldDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
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
            <div className="grid gap-3">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={`/projects/${slug}/people/${person.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
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
                    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{person.email}</span>
                    </div>
                  )}
                  {person.phone && (
                    <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{person.phone}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
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
    </div>
  );
}
