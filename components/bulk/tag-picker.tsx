'use client';

import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EntityTag } from '@/types/bulk';

interface TagPickerProps {
  tags: EntityTag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  onCreateTag?: (name: string) => Promise<void>;
  loading?: boolean;
}

export function TagPicker({
  tags,
  selectedTagIds,
  onTagToggle,
  onCreateTag,
  loading = false,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption =
    search.length > 0 &&
    !tags.some((tag) => tag.name.toLowerCase() === search.toLowerCase()) &&
    onCreateTag;

  const handleCreate = async () => {
    if (!onCreateTag || !search) return;

    setCreating(true);
    try {
      await onCreateTag(search);
      setSearch('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tags
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder="Search or create tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);

            return (
              <button
                key={tag.id}
                onClick={() => onTagToggle(tag.id)}
                className={cn(
                  'flex items-center justify-between w-full px-2 py-1.5 rounded text-sm',
                  'hover:bg-muted transition-colors',
                  isSelected && 'bg-muted'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}

          {filteredTags.length === 0 && !showCreateOption && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No tags found
            </p>
          )}

          {showCreateOption && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-primary"
            >
              <Plus className="h-4 w-4" />
              Create &quot;{search}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TagListProps {
  tags: EntityTag[];
  onRemove?: (tagId: string) => void;
  size?: 'sm' | 'default';
}

export function TagList({ tags, onRemove, size = 'default' }: TagListProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn(
            'flex items-center gap-1',
            size === 'sm' && 'text-xs px-1.5 py-0'
          )}
          style={{
            backgroundColor: `${tag.color}20`,
            borderColor: tag.color,
            color: tag.color,
          }}
        >
          {tag.name}
          {onRemove && (
            <button
              onClick={() => onRemove(tag.id)}
              className="ml-1 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
