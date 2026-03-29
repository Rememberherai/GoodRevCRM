'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2, Zap, Users, UserPlus, Settings, Search, UserSearch, Copy, Plug, Package, Tag, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateProjectSchema, type UpdateProjectInput } from '@/lib/validators/project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { LogoUpload } from '@/components/ui/logo-upload';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/stores/project';
import { useTourStore } from '@/stores/tour';
import { ResearchSettingsPanel } from '@/components/settings/research-settings';
import { MemberList } from '@/components/team/member-list';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { MemberPermissionsDialog } from '@/components/team/member-permissions-dialog';
import { useAuth } from '@/hooks/use-auth';
import { AutomationPanel } from '@/components/automations/automation-panel';
import { ContactProvidersSettings } from '@/components/settings/contact-providers-settings';
import { EmailSignaturesPanel } from '@/components/settings/email-signatures-panel';
import { EmailProviderSettings } from '@/components/settings/email-provider-settings';
import { DuplicatesPanel } from '@/components/deduplication/duplicates-panel';
import { DuplicatesBadge } from '@/components/deduplication/duplicates-badge';
import { McpSettingsPanel } from '@/components/settings/mcp-settings-panel';
import { ApiConnectionsPanel } from '@/components/settings/api-connections-panel';
import { ProjectSecretsPanel } from '@/components/settings/project-secrets-panel';
import { SchedulerPanel } from '@/components/settings/scheduler-panel';
import { ProductsCatalogPanel } from '@/components/settings/products-catalog-panel';
import { DispositionsPanel } from '@/components/settings/dispositions-panel';
import { ServiceTypesPanel } from '@/components/settings/service-types-panel';
import { ServiceAreaPanel } from '@/components/settings/service-area-panel';
import type { ProjectRole } from '@/types/user';
import type { ProjectType } from '@/types/project';


interface ProjectSettingsPageProps {
  params: Promise<{ slug: string }>;
}

interface MemberWithUser {
  id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  last_active_at?: string | null;
}

type MemberApiRecord = MemberWithUser & {
  joined_at?: string | null;
};

export default function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const { slug } = use(params);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<ProjectRole>('member');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const permissionsMember = members.find((m) => m.user_id === permissionsUserId) ?? null;

  // Clear stale permissionsUserId if the member was removed from the list
  useEffect(() => {
    if (permissionsUserId && !permissionsMember) {
      setPermissionsUserId(null);
    }
  }, [permissionsUserId, permissionsMember]);

  const router = useRouter();
  const { currentProject, setCurrentProject, updateProject, removeProject } = useProjectStore();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  // Hydrate project store if not already loaded (needed for project_type checks)
  useEffect(() => {
    if (currentProject?.slug === slug) return;
    fetch(`/api/projects/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.project) setCurrentProject(data.project);
      })
      .catch(() => {});
  }, [slug, currentProject?.slug, setCurrentProject]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/members?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      // Map joined_at from API to created_at expected by MemberList
      const mapped = ((data.members ?? []) as MemberApiRecord[]).map((m) => ({
        ...m,
        created_at: m.joined_at ?? m.created_at,
      }));
      setMembers(mapped);
    } catch {
      // silently fail
    } finally {
      setMembersLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Derive current user's role from members list
  useEffect(() => {
    if (currentUserId && members.length > 0) {
      const me = members.find((m) => m.user_id === currentUserId);
      if (me) setCurrentUserRole(me.role);
    }
  }, [currentUserId, members]);

  const handleUpdateRole = async (userId: string, role: ProjectRole) => {
    try {
      const res = await fetch(`/api/projects/${slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }
      toast.success('Role updated');
      fetchMembers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      toast.success('Member removed');
      fetchMembers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  const handleInvite = async (data: { email: string; role?: Exclude<ProjectRole, 'owner'> }) => {
    const res = await fetch(`/api/projects/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send invitation');
    }
    const result = await res.json();
    fetchMembers();
    // Return the result so the dialog can show the invite link
    return { invite_url: result.invite_url, email: data.email };
  };

  const form = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: currentProject?.name ?? '',
      slug: currentProject?.slug ?? slug,
      description: currentProject?.description ?? '',
    },
  });

  // Reset form when project data loads
  useEffect(() => {
    if (currentProject) {
      form.reset({
        name: currentProject.name ?? '',
        slug: currentProject.slug ?? slug,
        description: currentProject.description ?? '',
      });
    }
  }, [currentProject, form, slug]);

  const onSubmit = async (values: UpdateProjectInput) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update project');
      }

      updateProject(slug, data.project);
      toast.success('Project updated successfully');

      // If slug changed, redirect to new URL
      if (values.slug && values.slug !== slug) {
        router.push(`/projects/${values.slug}/settings`);
      }
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${slug}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      removeProject(slug);
      toast.success('Project deleted successfully');
      router.push('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const projectType = (currentProject?.project_type as ProjectType | undefined) ?? 'standard';
  const isCommunity = projectType === 'community';
  const isGrants = projectType === 'grants';

  // Risk index toggle (community projects only)
  const [riskIndexEnabled, setRiskIndexEnabled] = useState(false);
  const [riskToggleLoading, setRiskToggleLoading] = useState(false);

  useEffect(() => {
    if (!isCommunity) {
      setRiskIndexEnabled(false);
      return;
    }

    let isMounted = true;

    fetch(`/api/projects/${slug}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        setRiskIndexEnabled(Boolean(data?.settings?.risk_index_enabled));
      })
      .catch(() => {
        if (!isMounted) return;
        setRiskIndexEnabled(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug, isCommunity]);

  const handleRiskToggle = async (enabled: boolean) => {
    setRiskToggleLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risk_index_enabled: enabled }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      setRiskIndexEnabled(enabled);
      toast.success(enabled ? 'Risk index enabled' : 'Risk index disabled');
    } catch {
      toast.error('Failed to update risk index setting');
    } finally {
      setRiskToggleLoading(false);
    }
  };

  // Shared content blocks used across both layouts
  const generalContent = (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Update your project&apos;s basic information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Label className="mb-2 block">Project Logo</Label>
          <div className="flex items-center gap-3">
            <LogoUpload
              currentUrl={currentProject?.logo_url}
              fallbackInitials={(currentProject?.name ?? slug).slice(0, 2).toUpperCase()}
              entityType="project"
              onUploaded={(url) => {
                if (currentProject) {
                  updateProject(slug, { ...currentProject, logo_url: url });
                }
              }}
              size="lg"
            />
            <p className="text-sm text-muted-foreground">Click to upload a logo for this project</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier. Changing this will change your project URL.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ''}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const handleReplayTour = () => {
    useTourStore.getState().clearSeen(currentProject?.id ?? '');
    // Navigate to dashboard — ProjectTour there will auto-launch since localStorage was cleared
    router.push(`/projects/${slug}`);
  };

  const tourReplayContent = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Project Walkthrough
        </CardTitle>
        <CardDescription>
          Take a guided tour of this project&apos;s features and navigation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleReplayTour}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Replay Tour
        </Button>
      </CardContent>
    </Card>
  );

  const dangerZoneContent = currentUserRole === 'owner' && (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions for your project
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                project and all associated data including organizations, people,
                opportunities, and RFPs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                Delete Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );

  const membersContent = (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Manage who has access to this project
              </CardDescription>
            </div>
            {['owner', 'admin'].includes(currentUserRole) && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MemberList
            members={members}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            projectType={projectType}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
            onOpenPermissions={setPermissionsUserId}
            loading={membersLoading}
          />
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        projectType={projectType}
        onInvite={handleInvite}
      />

      {permissionsUserId && permissionsMember && (
        <MemberPermissionsDialog
          open={true}
          onOpenChange={(open) => { if (!open) setPermissionsUserId(null); }}
          projectSlug={slug}
          projectType={projectType}
          userId={permissionsUserId}
          memberName={permissionsMember.user.full_name ?? permissionsMember.user.email}
          memberRole={permissionsMember.role}
        />
      )}
    </>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Manage your project settings
        </p>
      </div>

      {isGrants ? (
        /* ── Grants project layout ── */
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            {generalContent}
            {tourReplayContent}
            {dangerZoneContent}
          </TabsContent>

          <TabsContent value="members" className="space-y-6 mt-6">
            {membersContent}
          </TabsContent>

          <TabsContent value="automation" className="mt-6">
            <Tabs defaultValue="automations">
              <TabsList>
                <TabsTrigger value="automations">Automations</TabsTrigger>
                <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              </TabsList>
              <TabsContent value="automations" className="space-y-6 mt-4">
                <AutomationPanel slug={slug} />
              </TabsContent>
              <TabsContent value="scheduler" className="space-y-6 mt-4">
                <SchedulerPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6">
            <Tabs defaultValue="mcp">
              <TabsList>
                <TabsTrigger value="mcp">MCP</TabsTrigger>
                <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                <TabsTrigger value="connections">Connections</TabsTrigger>
              </TabsList>
              <TabsContent value="mcp" className="space-y-6 mt-4">
                <McpSettingsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="api-keys" className="space-y-6 mt-4">
                <ProjectSecretsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="connections" className="space-y-6 mt-4">
                <ApiConnectionsPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      ) : isCommunity ? (
        /* ── Community project layout (8 tabs, single row) ── */
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="research" className="gap-2">
              <Search className="h-4 w-4" />
              Research & Discovery
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
              <Copy className="h-4 w-4" />
              Duplicates
              <DuplicatesBadge projectSlug={slug} className="ml-1" />
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="data-labels" className="gap-2">
              <Tag className="h-4 w-4" />
              Data & Labels
            </TabsTrigger>
            <TabsTrigger value="service-area" className="gap-2">
              <MapPin className="h-4 w-4" />
              Service Area
            </TabsTrigger>
          </TabsList>

          {/* General + Signatures */}
          <TabsContent value="general" className="space-y-6 mt-6">
            {generalContent}
            <EmailSignaturesPanel slug={slug} />
            <EmailProviderSettings slug={slug} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Risk Index
                </CardTitle>
                <CardDescription>
                  Enable the household risk scoring system. When enabled, households are scored based on program enrollment, referrals, engagement, and relationships.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Switch
                    id="risk-index-toggle"
                    checked={riskIndexEnabled}
                    onCheckedChange={handleRiskToggle}
                    disabled={riskToggleLoading}
                  />
                  <Label htmlFor="risk-index-toggle">
                    {riskIndexEnabled ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>
              </CardContent>
            </Card>

            {tourReplayContent}
            {dangerZoneContent}
          </TabsContent>

          <TabsContent value="members" className="space-y-6 mt-6">
            {membersContent}
          </TabsContent>

          {/* Research + Contact Discovery — sub-tabs */}
          <TabsContent value="research" className="mt-6">
            <Tabs defaultValue="research-settings">
              <TabsList>
                <TabsTrigger value="research-settings">Research</TabsTrigger>
                <TabsTrigger value="contact-discovery">Contact Discovery</TabsTrigger>
              </TabsList>
              <TabsContent value="research-settings" className="space-y-6 mt-4">
                <ResearchSettingsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="contact-discovery" className="space-y-6 mt-4">
                <ContactProvidersSettings slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Automation + Scheduler — sub-tabs */}
          <TabsContent value="automation" className="mt-6">
            <Tabs defaultValue="automations">
              <TabsList>
                <TabsTrigger value="automations">Automations</TabsTrigger>
                <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              </TabsList>
              <TabsContent value="automations" className="space-y-6 mt-4">
                <AutomationPanel slug={slug} />
              </TabsContent>
              <TabsContent value="scheduler" className="space-y-6 mt-4">
                <SchedulerPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="duplicates" className="space-y-6 mt-6">
            <DuplicatesPanel slug={slug} />
          </TabsContent>

          {/* Integrations — sub-tabs */}
          <TabsContent value="integrations" className="mt-6">
            <Tabs defaultValue="mcp">
              <TabsList>
                <TabsTrigger value="mcp">MCP</TabsTrigger>
                <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                <TabsTrigger value="connections">Connections</TabsTrigger>
              </TabsList>
              <TabsContent value="mcp" className="space-y-6 mt-4">
                <McpSettingsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="api-keys" className="space-y-6 mt-4">
                <ProjectSecretsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="connections" className="space-y-6 mt-4">
                <ApiConnectionsPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Data & Labels — sub-tabs */}
          <TabsContent value="data-labels" className="mt-6">
            <Tabs defaultValue="dispositions">
              <TabsList>
                <TabsTrigger value="dispositions">Dispositions</TabsTrigger>
                <TabsTrigger value="service-types">Service Types</TabsTrigger>
              </TabsList>
              <TabsContent value="dispositions" className="space-y-6 mt-4">
                <DispositionsPanel currentUserRole={currentUserRole} />
              </TabsContent>
              <TabsContent value="service-types" className="space-y-6 mt-4">
                <ServiceTypesPanel currentUserRole={currentUserRole} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="service-area" className="space-y-6 mt-6">
            <ServiceAreaPanel slug={slug} />
          </TabsContent>
        </Tabs>
      ) : (
        /* ── Standard (sales) project layout (8 condensed tabs) ── */
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="research" className="gap-2">
              <Search className="h-4 w-4" />
              Research
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <UserSearch className="h-4 w-4" />
              Contacts
              <DuplicatesBadge projectSlug={slug} className="ml-1" />
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="dispositions" className="gap-2">
              <Tag className="h-4 w-4" />
              Dispositions
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
          </TabsList>

          {/* General + Signatures */}
          <TabsContent value="general" className="space-y-6 mt-6">
            {generalContent}
            <EmailSignaturesPanel slug={slug} />
            <EmailProviderSettings slug={slug} />
            {tourReplayContent}
            {dangerZoneContent}
          </TabsContent>

          <TabsContent value="members" className="space-y-6 mt-6">
            {membersContent}
          </TabsContent>

          <TabsContent value="research" className="space-y-6 mt-6">
            <ResearchSettingsPanel slug={slug} />
          </TabsContent>

          {/* Automation + Scheduler — sub-tabs */}
          <TabsContent value="automation" className="mt-6">
            <Tabs defaultValue="automations">
              <TabsList>
                <TabsTrigger value="automations">Automations</TabsTrigger>
                <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              </TabsList>
              <TabsContent value="automations" className="space-y-6 mt-4">
                <AutomationPanel slug={slug} />
              </TabsContent>
              <TabsContent value="scheduler" className="space-y-6 mt-4">
                <SchedulerPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Contacts — sub-tabs */}
          <TabsContent value="contacts" className="mt-6">
            <Tabs defaultValue="contact-discovery">
              <TabsList>
                <TabsTrigger value="contact-discovery">Contact Discovery</TabsTrigger>
                <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
              </TabsList>
              <TabsContent value="contact-discovery" className="space-y-6 mt-4">
                <ContactProvidersSettings slug={slug} />
              </TabsContent>
              <TabsContent value="duplicates" className="space-y-6 mt-4">
                <DuplicatesPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Integrations — sub-tabs */}
          <TabsContent value="integrations" className="mt-6">
            <Tabs defaultValue="mcp">
              <TabsList>
                <TabsTrigger value="mcp">MCP</TabsTrigger>
                <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                <TabsTrigger value="connections">Connections</TabsTrigger>
              </TabsList>
              <TabsContent value="mcp" className="space-y-6 mt-4">
                <McpSettingsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="api-keys" className="space-y-6 mt-4">
                <ProjectSecretsPanel slug={slug} />
              </TabsContent>
              <TabsContent value="connections" className="space-y-6 mt-4">
                <ApiConnectionsPanel slug={slug} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="dispositions" className="space-y-6 mt-6">
            <DispositionsPanel currentUserRole={currentUserRole} />
          </TabsContent>

          <TabsContent value="products" className="space-y-6 mt-6">
            <ProductsCatalogPanel slug={slug} currentUserRole={currentUserRole} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
