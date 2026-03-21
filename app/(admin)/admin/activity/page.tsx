'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AdminHeader } from '@/components/admin/admin-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ActivityEntry {
  id: string;
  source: 'crm' | 'admin';
  user_id: string;
  user_name: string;
  user_email: string;
  project_name: string | null;
  action: string;
  entity_type: string | null;
  details: unknown;
  created_at: string;
}

export default function AdminActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType !== 'all') params.set('type', filterType);
    params.set('page', String(page));

    const res = await fetch(`/api/admin/activity?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
    }
    setLoading(false);
  }, [filterType, page]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / 50);

  return (
    <>
      <AdminHeader title="Activity Log" />
      <main className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex gap-4 items-center">
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Activity source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activity</SelectItem>
              <SelectItem value="crm">CRM Activity</SelectItem>
              <SelectItem value="admin">Admin Activity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No activity found
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={`${entry.source}-${entry.id}`}>
                      <TableCell>
                        <Badge
                          variant={entry.source === 'admin' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {entry.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{entry.user_name}</span>
                          <p className="text-xs text-muted-foreground">{entry.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{entry.action.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.entity_type ?? '—'}</TableCell>
                      <TableCell className="text-sm">{entry.project_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
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
            <p className="text-sm text-muted-foreground">{total} entries total</p>
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
