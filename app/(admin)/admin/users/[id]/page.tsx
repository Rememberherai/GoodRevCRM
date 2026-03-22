'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Bug, Mail, Phone, Send } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { StatCard } from '@/components/admin/admin-stats-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AdminUserDetail } from '@/types/admin';

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
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
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const res = await fetch(`/api/admin/users/${id}`);
      setDetail(await res.json());
    } finally {
      setActionLoading(false);
    }
  };

  const headerBreadcrumbs = [{ label: 'Users', href: '/admin/users' }];

  if (loading) return <><AdminHeader title="User Detail" breadcrumbs={headerBreadcrumbs} /><main className="flex-1 p-6"><p className="text-muted-foreground">Loading...</p></main></>;
  if (!detail) return <><AdminHeader title="User Detail" breadcrumbs={headerBreadcrumbs} /><main className="flex-1 p-6"><p className="text-muted-foreground">User not found</p></main></>;

  const { user, memberships, connections, last_sign_in_at, latest_session, usage_stats, ai_usage, recent_sessions, recent_bug_reports, recent_activity, settings } = detail;

  return (
    <>
      <AdminHeader title={user.full_name ?? user.email} breadcrumbs={headerBreadcrumbs} />
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
                <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
                  <p>Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}</p>
                  {last_sign_in_at && (
                    <p>Last sign-in: {formatDistanceToNow(new Date(last_sign_in_at), { addSuffix: true })}</p>
                  )}
                  {latest_session && (
                    <p>
                      Last active: {formatDistanceToNow(new Date(latest_session.last_active_at), { addSuffix: true })}
                      {latest_session.ip_address && <span className="ml-1">from {latest_session.ip_address}</span>}
                    </p>
                  )}
                </div>
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

        {/* Usage stats row */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard title="Actions" value={usage_stats.total_actions} icon={Activity} />
          <StatCard title="Emails Synced" value={usage_stats.emails_synced} icon={Mail} />
          <StatCard title="Emails Sent" value={usage_stats.emails_sent} icon={Send} />
          <StatCard title="Calls" value={usage_stats.calls_made} icon={Phone} />
          <StatCard title="Bug Reports" value={usage_stats.bug_reports_filed} icon={Bug} />
        </div>

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

        {/* Activity / Sessions / Bug Reports tabs */}
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <Card>
              <CardContent className="p-0">
                {recent_activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No recent activity</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent_activity.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{a.action.replace(/_/g, ' ')}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.entity_type}</Badge></TableCell>
                          <TableCell className="text-sm">{a.project_name ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardContent className="p-0">
                {recent_sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No session history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Last Active</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>User Agent</TableHead>
                        <TableHead>Project</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent_sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{s.ip_address ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {s.user_agent ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm">{s.project_name ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bugs">
            <Card>
              <CardContent className="p-0">
                {recent_bug_reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No bug reports filed</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Reported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent_bug_reports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm max-w-xs truncate">{r.description}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusColors[r.status] ?? ''}`}>
                              {r.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.priority && (
                              <Badge className={`text-xs ${priorityColors[r.priority] ?? ''}`}>
                                {r.priority}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{r.project_name ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Connections + AI Usage + Settings row */}
        <div className="grid gap-4 md:grid-cols-3">
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

          {/* AI Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">AI Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ai_usage.request_count === 0 ? (
                <p className="text-sm text-muted-foreground">No AI usage</p>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requests</span>
                    <span>{ai_usage.request_count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tokens</span>
                    <span>{ai_usage.total_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prompt Tokens</span>
                    <span>{ai_usage.prompt_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completion Tokens</span>
                    <span>{ai_usage.completion_tokens.toLocaleString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* User Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">User Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {settings ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Theme</span>
                    <span className="capitalize">{settings.theme ?? 'Default'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Timezone</span>
                    <span>{settings.timezone ?? 'Not set'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date Format</span>
                    <span>{settings.date_format ?? 'Default'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email Notifications</span>
                    <span>{settings.notifications_email ? 'On' : 'Off'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Push Notifications</span>
                    <span>{settings.notifications_push ? 'On' : 'Off'}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No settings configured</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
