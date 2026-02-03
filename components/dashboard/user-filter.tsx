"use client";

import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TeamMember } from "@/types/analytics";

interface UserFilterProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  teamMembers: TeamMember[];
  currentUserId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserFilter({
  value,
  onChange,
  teamMembers,
  currentUserId,
}: UserFilterProps) {
  const currentUser = teamMembers.find((m) => m.userId === currentUserId);
  const otherMembers = teamMembers.filter((m) => m.userId !== currentUserId);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v === "" ? null : v)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={
          <span className="flex items-center gap-2">
            <Users className="size-4" />
            All Team
          </span>
        } />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">
          <span className="flex items-center gap-2">
            <Users className="size-4" />
            All Team
          </span>
        </SelectItem>

        {currentUser && (
          <SelectItem value={currentUser.userId}>
            <span className="flex items-center gap-2">
              <Avatar size="sm">
                {currentUser.avatarUrl && (
                  <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                )}
                <AvatarFallback>{getInitials(currentUser.fullName)}</AvatarFallback>
              </Avatar>
              <span className="flex flex-col leading-tight">
                <span className="text-sm">Me</span>
                <span className="text-xs text-muted-foreground">{currentUser.email}</span>
              </span>
            </span>
          </SelectItem>
        )}

        {otherMembers.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            <span className="flex items-center gap-2">
              <Avatar size="sm">
                {member.avatarUrl && (
                  <AvatarImage src={member.avatarUrl} alt={member.fullName} />
                )}
                <AvatarFallback>{getInitials(member.fullName)}</AvatarFallback>
              </Avatar>
              <span className="flex flex-col leading-tight">
                <span className="text-sm">{member.fullName}</span>
                <span className="text-xs text-muted-foreground">{member.email}</span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
