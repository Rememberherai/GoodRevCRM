'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ProjectMember, CommentMention } from '@/types/entity-comment';
import { cn } from '@/lib/utils';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string, mentions: CommentMention[]) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  members: ProjectMember[];
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder = 'Add a comment... Type @ to mention someone (Ctrl+Enter to send)',
  disabled = false,
  members,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [mentions, setMentions] = useState<CommentMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredMembers = members.filter((member) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(term) ||
      member.email.toLowerCase().includes(term)
    );
  });

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length]);

  const closeMentionDropdown = useCallback(() => {
    setShowDropdown(false);
    setSearchTerm('');
    setMentionStartPos(null);
    setSelectedIndex(0);
  }, []);

  const selectMember = useCallback(
    (member: ProjectMember) => {
      if (mentionStartPos === null) return;

      const displayName = member.full_name || member.email;
      const before = value.slice(0, mentionStartPos);
      const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
      const newValue = `${before}@${displayName} ${after}`;

      const newMention: CommentMention = {
        user_id: member.id,
        display_name: displayName,
      };

      // Deduplicate mentions by user_id
      const updatedMentions = [...mentions.filter((m) => m.user_id !== member.id), newMention];
      setMentions(updatedMentions);
      onChange(newValue, updatedMentions);
      closeMentionDropdown();

      // Refocus textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const cursorPos = before.length + displayName.length + 2; // +2 for @ and space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [value, mentionStartPos, mentions, onChange, closeMentionDropdown]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const atPos = cursorPos - mentionMatch[0].length;
      // Only trigger if @ is at start or preceded by whitespace
      if (atPos === 0 || /\s/.test(newValue[atPos - 1] ?? '')) {
        setMentionStartPos(atPos);
        setSearchTerm(mentionMatch[1] ?? '');
        setShowDropdown(true);
      } else {
        closeMentionDropdown();
      }
    } else {
      closeMentionDropdown();
    }

    // Recalculate valid mentions - remove any whose @DisplayName is no longer in text
    const updatedMentions = mentions.filter((m) =>
      newValue.includes(`@${m.display_name}`)
    );
    setMentions(updatedMentions);
    onChange(newValue, updatedMentions);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const member = filteredMembers[selectedIndex];
        if (member) selectMember(member);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionDropdown();
        return;
      }
    }

    // Ctrl+Enter / Cmd+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        closeMentionDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMentionDropdown]);

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selected = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[60px] text-sm resize-none"
        disabled={disabled}
      />

      {/* Mention autocomplete dropdown */}
      {showDropdown && filteredMembers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-1 left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
              onMouseDown={(e) => {
                e.preventDefault(); // Don't blur textarea
                selectMember(member);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {getInitials(member.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <span className="font-medium truncate block">
                  {member.full_name || member.email}
                </span>
                {member.full_name && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {member.email}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
