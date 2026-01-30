// Note author info
export interface NoteAuthor {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

// Note
export interface Note {
  id: string;
  project_id: string;
  content: string;
  content_html: string | null;
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  author?: NoteAuthor;
}

// Note with author info
export interface NoteWithAuthor extends Note {
  author: NoteAuthor;
}
