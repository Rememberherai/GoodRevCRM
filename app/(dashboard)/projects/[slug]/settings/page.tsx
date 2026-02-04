'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2, Zap, Users, UserPlus, Settings, Search } from 'lucide-react';
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
import { useProjectStore } from '@/stores/project';
import { ResearchSettingsPanel } from '@/components/settings/research-settings';
import { MemberList } from '@/components/team/member-list';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { useAuth } from '@/hooks/use-auth';
import { AutomationPanel } from '@/components/automations/automation-panel';
import type { ProjectRole } from '@/types/user';


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

export default function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const { slug } = use(params);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<ProjectRole>('member');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const router = useRouter();
  const { currentProject, updateProject, removeProject } = useProjectStore();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/members?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      // Map joined_at from API to created_at expected by MemberList
      const mapped = (data.members ?? []).map((m: any) => ({
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

  const handleInvite = async (data: { email: string; role?: 'admin' | 'member' | 'viewer' }) => {
    const res = await fetch(`/api/projects/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send invitation');
    }
    toast.success('Invitation sent');
    fetchMembers();
  };

  const form = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: currentProject?.name ?? '',
      slug: currentProject?.slug ?? slug,
      description: currentProject?.description ?? '',
    },
  });

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

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Manage your project settings
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
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
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
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
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6">
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
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveMember}
                loading={membersLoading}
              />
            </CardContent>
          </Card>

          <InviteMemberDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            onInvite={handleInvite}
          />
        </TabsContent>

        <TabsContent value="research" className="space-y-6 mt-6">
          <ResearchSettingsPanel slug={slug} />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6 mt-6">
          <AutomationPanel slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
