'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Send,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useEntityComments } from '@/hooks/use-entity-comments';
import { useProjectMembers } from '@/hooks/use-project-members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MentionTextarea } from './mention-textarea';
import { toast } from 'sonner';
import type { CommentEntityType, CommentMention, EntityComment } from '@/types/entity-comment';

interface EntityCommentsFeedProps {
  entityType: CommentEntityType;
  entityId: string;
  currentUserId: string;
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

function renderContentWithMentions(content: string, mentions: CommentMention[]) {
  if (!mentions || mentions.length === 0) {
    return <span>{content}</span>;
  }

  // Build a regex that matches any @DisplayName from the mentions
  const mentionNames = mentions.map((m) => m.display_name).filter(Boolean);
  if (mentionNames.length === 0) return <span>{content}</span>;

  const escapedNames = mentionNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'g');
  const parts = content.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMention = mentionNames.some((name) => part === `@${name}`);
        if (isMention) {
          return (
            <span key={i} className="text-primary font-medium">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function EntityCommentsFeed({
  entityType,
  entityId,
  currentUserId,
}: EntityCommentsFeedProps) {
  const { comments, count, isLoading, addComment, deleteComment } =
    useEntityComments(entityType, entityId);
  const { members } = useProjectMembers();
  const [newComment, setNewComment] = useState('');
  const [currentMentions, setCurrentMentions] = useState<CommentMention[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSubmit = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await addComment({ content: trimmed, mentions: currentMentions });
      setNewComment('');
      setCurrentMentions([]);
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const handleTextChange = (value: string, mentions: CommentMention[]) => {
    setNewComment(value);
    setCurrentMentions(mentions);
  };

  const entityLabel = entityType === 'person' ? 'contact' : entityType;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Comments</h3>
        {count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading comments...
        </div>
      ) : comments.length > 0 ? (
        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
          {comments.map((comment) => (
            <CommentBubble
              key={comment.id}
              comment={comment}
              isOwn={comment.created_by === currentUserId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No comments yet.</p>
          <p className="text-xs mt-1">
            Start a conversation about this {entityLabel}. Use @mention to notify teammates.
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <MentionTextarea
            value={newComment}
            onChange={handleTextChange}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
            members={members}
          />
        </div>
        <Button
          size="icon"
          className="shrink-0"
          onClick={handleSubmit}
          disabled={isSubmitting || !newComment.trim()}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function CommentBubble({
  comment,
  isOwn,
  onDelete,
}: {
  comment: EntityComment;
  isOwn: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarImage src={comment.author?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">
          {getInitials(comment.author?.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {comment.author?.full_name ?? comment.author?.email ?? 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDelete(comment.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
          {renderContentWithMentions(comment.content, comment.mentions)}
        </p>
      </div>
    </div>
  );
}
