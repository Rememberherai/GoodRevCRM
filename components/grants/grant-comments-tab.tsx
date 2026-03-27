'use client';

import { EntityCommentsFeed } from '@/components/comments/entity-comments-feed';

interface GrantCommentsTabProps {
  grantId: string;
  currentUserId: string;
}

export function GrantCommentsTab({ grantId, currentUserId }: GrantCommentsTabProps) {
  return (
    <div className="p-6">
      <EntityCommentsFeed
        entityType="grant"
        entityId={grantId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
