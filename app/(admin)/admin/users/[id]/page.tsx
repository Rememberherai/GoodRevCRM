'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { AdminHeader } from '@/components/admin/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AdminUserListItem } from '@/types/admin';

interface UserDetail {
  user: AdminUserListItem;
  memberships: Array<{
    id: string;
    role: string;
    joined_at: string;
    project: { id: string; name: string; slug: string; project_type: string };
  }>;
  connections: {
    gmail: string | null;
    telnyx: string | null;
  };
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: 'deactivate' | 'reactivate') => {
    setActionLoading(true);
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    // Refresh data
    const res = await fetch(`/api/admin/users/${id}`);
    setDetail(await res.json());
    setActionLoading(false);
  };

  if (loading) return <><AdminHeader title="User Detail" /><main className="flex-1 p-6"><p className="text-muted-foreground">Loading...</p></main></>;
  if (!detail) return <><AdminHeader title="User Detail" /><main className="flex-1 p-6"><p className="text-muted-foreground">User not found</p></main></>;

  const { user, memberships, connections } = detail;

  return (
    <>
      <AdminHeader title={user.full_name ?? user.email} />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Profile card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback>{(user.full_name ?? user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{user.full_name ?? '—'}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="flex gap-2 mt-2">
                  {user.is_system_admin && <Badge variant="secondary">System Admin</Badge>}
                  {user.is_banned ? (
                    <Badge variant="destructive">Deactivated</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                {user.is_banned ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={actionLoading}>Reactivate</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reactivate User</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will restore {user.email}&apos;s ability to log in.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleAction('reactivate')}>Reactivate</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={actionLoading}>Deactivate</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will prevent {user.email} from logging in. Their data will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleAction('deactivate')}>Deactivate</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Projects ({memberships.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project memberships</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => router.push(`/admin/projects/${m.project.id}`)}
                    >
                      <TableCell className="font-medium text-sm">{m.project.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{m.project.project_type}</Badge></TableCell>
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

        {/* Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Gmail</span>
              {connections.gmail ? (
                <Badge variant="outline">{connections.gmail}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Not connected</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Telnyx</span>
              {connections.telnyx ? (
                <Badge variant="outline">{connections.telnyx}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Not connected</span>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
