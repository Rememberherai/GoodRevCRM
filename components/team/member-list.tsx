'use client';

import { useState } from 'react';
import { MoreHorizontal, Shield, ShieldCheck, User, Eye, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { ProjectRole } from '@/types/user';

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

interface MemberListProps {
  members: MemberWithUser[];
  currentUserId: string;
  currentUserRole: ProjectRole;
  onUpdateRole: (userId: string, role: ProjectRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  loading?: boolean;
}

const roleIcons: Record<ProjectRole, typeof Shield> = {
  owner: ShieldCheck,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors: Record<ProjectRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onRemove,
  loading = false,
}: MemberListProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);

  const canUpdateRole = (targetRole: ProjectRole): boolean => {
    if (!canManageMembers) return false;
    if (targetRole === 'owner') return false;
    if (currentUserRole === 'admin' && targetRole === 'admin') return false;
    return true;
  };

  const canRemove = (targetRole: ProjectRole, targetUserId: string): boolean => {
    if (!canManageMembers) return false;
    if (targetRole === 'owner') return false;
    if (targetUserId === currentUserId) return false;
    if (currentUserRole === 'admin' && targetRole === 'admin') return false;
    return true;
  };

  const handleRoleChange = async (userId: string, role: ProjectRole) => {
    setActionInProgress(true);
    try {
      await onUpdateRole(userId, role);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;

    setActionInProgress(true);
    try {
      await onRemove(memberToRemove);
    } finally {
      setActionInProgress(false);
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y">
        {members.map((member) => {
          const RoleIcon = roleIcons[member.role];

          return (
            <div key={member.id} className="flex items-center gap-4 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.user.avatar_url ?? undefined} />
                <AvatarFallback>
                  {getInitials(member.user.full_name, member.user.email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {member.user.full_name ?? member.user.email}
                  </p>
                  {member.user_id === currentUserId && (
                    <Badge variant="outline" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {member.user.email}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge className={roleColors[member.role]}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {member.role}
                </Badge>

                {member.last_active_at && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Active {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
                  </span>
                )}

                {canManageMembers && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionInProgress || member.role === 'owner'}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdateRole(member.role) && (
                        <>
                          {(['admin', 'member', 'viewer'] as ProjectRole[])
                            .filter((r) => r !== member.role)
                            .map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() => handleRoleChange(member.user_id, role)}
                              >
                                Make {role}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {canRemove(member.role, member.user_id) && (
                        <DropdownMenuItem
                          onClick={() => {
                            setMemberToRemove(member.user_id);
                            setRemoveDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the project? They will lose
              access to all project data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
