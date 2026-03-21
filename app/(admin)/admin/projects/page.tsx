'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { AdminHeader } from '@/components/admin/admin-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AdminProjectListItem } from '@/types/admin';

export default function AdminProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterType !== 'all') params.set('filter_type', filterType);
    if (filterStatus !== 'all') params.set('filter_status', filterStatus);
    params.set('page', String(page));

    const res = await fetch(`/api/admin/projects?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
      setTotal(data.total);
    }
    setLoading(false);
  }, [search, filterType, filterStatus, page]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <AdminHeader title="Projects" />
      <main className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="max-w-sm"
          />
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Project type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="community">Community</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No projects found
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => router.push(`/admin/projects/${p.id}`)}
                    >
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{p.project_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{p.owner_name ?? p.owner_email}</TableCell>
                      <TableCell className="text-sm">{p.member_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {p.has_api_key ? (
                          <Badge variant="outline" className="text-xs">Configured</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.deleted_at ? (
                          <Badge variant="destructive" className="text-xs">Deleted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total} projects total</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
