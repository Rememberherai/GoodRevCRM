export interface RfpQuestionCommentAuthor {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface RfpQuestionComment {
  id: string;
  question_id: string;
  rfp_id: string;
  project_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: RfpQuestionCommentAuthor;
}
