'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { AdminHeader } from '@/components/admin/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    slug: string;
    project_type: string;
    created_at: string;
    deleted_at: string | null;
  };
  owner: { id: string; full_name: string | null; email: string };
  members: Array<{
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    user: { id: string; full_name: string | null; email: string; avatar_url: string | null };
  }>;
}

export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [enterLoading, setEnterLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/projects/${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSoftDelete = async () => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'soft_delete', confirm_name: confirmName }),
    });
    if (res.ok) {
      const refreshRes = await fetch(`/api/admin/projects/${id}`);
      setDetail(await refreshRes.json());
      setConfirmName('');
    }
    setActionLoading(false);
  };

  const handleRestore = async () => {
    setActionLoading(true);
    await fetch(`/api/admin/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });
    const refreshRes = await fetch(`/api/admin/projects/${id}`);
    setDetail(await refreshRes.json());
    setActionLoading(false);
  };

  const handleEnterProject = async () => {
    setEnterLoading(true);
    const res = await fetch(`/api/admin/projects/${id}/enter`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      router.push(`/projects/${data.slug}`);
    }
    setEnterLoading(false);
  };

  if (loading) return <><AdminHeader title="Project Detail" /><main className="flex-1 p-6"><p className="text-muted-foreground">Loading...</p></main></>;
  if (!detail) return <><AdminHeader title="Project Detail" /><main className="flex-1 p-6"><p className="text-muted-foreground">Project not found</p></main></>;

  const { project, owner, members } = detail;

  return (
    <>
      <AdminHeader title={project.name} />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Project info card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{project.name}</h2>
                <p className="text-sm text-muted-foreground">/{project.slug}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">{project.project_type}</Badge>
                  {project.deleted_at ? (
                    <Badge variant="destructive">Deleted</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </p>
                <p className="text-sm">
                  Owner: <span className="font-medium">{owner.full_name ?? owner.email}</span>
                  <span className="text-muted-foreground ml-1">({owner.email})</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleEnterProject} disabled={enterLoading || !!project.deleted_at}>
                  {enterLoading ? 'Entering...' : 'Enter Project'}
                </Button>
                {project.deleted_at ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={actionLoading}>Restore</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will restore &quot;{project.name}&quot; and make it accessible again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={actionLoading}>Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          This is a soft delete. The project data will be preserved but it will be inaccessible to users.
                          Type the project name to confirm.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-2">
                        <Label htmlFor="confirm-name" className="text-sm">
                          Type &quot;{project.name}&quot; to confirm
                        </Label>
                        <Input
                          id="confirm-name"
                          value={confirmName}
                          onChange={(e) => setConfirmName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmName('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleSoftDelete}
                          disabled={confirmName !== project.name}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => router.push(`/admin/users/${m.user_id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={m.user.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {(m.user.full_name ?? m.user.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{m.user.full_name ?? '—'}</span>
                          {m.user_id === owner.id && (
                            <Badge variant="secondary" className="text-xs">Owner</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{m.user.email}</TableCell>
                      <TableCell className="text-sm capitalize">{m.role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
