'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Plus, Trash2 } from 'lucide-react';
interface MemberUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface MemberWithUser {
  id: string;
  event_type_id: string;
  user_id: string;
  is_active: boolean | null;
  priority: number | null;
  created_at: string | null;
  user: MemberUser;
}

interface TeamMembersEditorProps {
  eventTypeId: string;
  schedulingType: string;
}

export function TeamMembersEditor({ eventTypeId, schedulingType }: TeamMembersEditorProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState('');
  const [newPriority, setNewPriority] = useState(1);
  const [adding, setAdding] = useState(false);

  const isTeamType = schedulingType === 'round_robin' || schedulingType === 'collective';

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/calendar/event-types/${eventTypeId}/members`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to load members');
        return;
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [eventTypeId]);

  useEffect(() => {
    if (isTeamType) {
      fetchMembers();
    }
  }, [isTeamType, fetchMembers]);

  if (!isTeamType) return null;

  const handleAdd = async () => {
    if (!newUserId.trim()) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch(`/api/calendar/event-types/${eventTypeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: newUserId.trim(),
          priority: schedulingType === 'round_robin' ? newPriority : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
        return;
      }

      setNewUserId('');
      setNewPriority(1);
      await fetchMembers();
    } catch {
      setError('Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (member: MemberWithUser) => {
    try {
      const res = await fetch(
        `/api/calendar/event-types/${eventTypeId}/members/${member.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !member.is_active }),
        }
      );

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, is_active: !m.is_active } : m
          )
        );
      }
    } catch {
      // Silently fail
    }
  };

  const handlePriorityChange = async (member: MemberWithUser, priority: number) => {
    try {
      const res = await fetch(
        `/api/calendar/event-types/${eventTypeId}/members/${member.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority }),
        }
      );

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, priority } : m
          )
        );
      }
    } catch {
      // Silently fail
    }
  };

  const handleRemove = async (member: MemberWithUser) => {
    try {
      const res = await fetch(
        `/api/calendar/event-types/${eventTypeId}/members/${member.id}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      }
    } catch {
      // Silently fail
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
          <Badge variant="secondary" className="ml-auto">
            {schedulingType === 'round_robin' ? 'Round Robin' : 'Collective'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members added yet. Add members to enable team scheduling.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.user.full_name || member.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.user.email}
                  </p>
                </div>

                {schedulingType === 'round_robin' && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={member.priority ?? 1}
                      onChange={(e) =>
                        handlePriorityChange(member, parseInt(e.target.value) || 1)
                      }
                      className="w-16 h-8 text-xs"
                    />
                  </div>
                )}

                <Switch
                  checked={member.is_active !== false}
                  onCheckedChange={() => handleToggleActive(member)}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-medium">Add Member</Label>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">User ID</Label>
              <Input
                placeholder="Enter user UUID"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              />
            </div>
            {schedulingType === 'round_robin' && (
              <div className="w-24 space-y-1">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
            <Button onClick={handleAdd} disabled={adding || !newUserId.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
