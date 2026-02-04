export type CommentEntityType = 'person' | 'organization' | 'opportunity';

export interface CommentMention {
  user_id: string;
  display_name: string;
}

export interface CommentAuthor {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface EntityComment {
  id: string;
  project_id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  content: string;
  mentions: CommentMention[];
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: CommentAuthor;
}

export interface ProjectMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
}
