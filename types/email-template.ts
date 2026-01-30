// Email Template Types

export type EmailTemplateCategory =
  | 'outreach'
  | 'follow_up'
  | 'introduction'
  | 'proposal'
  | 'thank_you'
  | 'meeting'
  | 'reminder'
  | 'newsletter'
  | 'announcement'
  | 'other';

export type EmailDraftStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

// Template variable definition
export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'email' | 'url';
  required: boolean;
  default_value?: string;
  description?: string;
}

// Email template
export interface EmailTemplate {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  category: EmailTemplateCategory;
  variables: TemplateVariable[];
  is_active: boolean;
  is_shared: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Template version
export interface EmailTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  subject: string;
  body_html: string;
  body_text: string | null;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
}

// Template attachment
export interface EmailTemplateAttachment {
  id: string;
  template_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  created_at: string;
}

// Email draft
export interface EmailDraft {
  id: string;
  project_id: string;
  template_id: string | null;
  user_id: string;
  person_id: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  reply_to: string | null;
  scheduled_at: string | null;
  status: EmailDraftStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Rendered template result
export interface RenderedTemplate {
  subject: string;
  body_html: string;
  body_text: string | null;
}

// Category labels
export const categoryLabels: Record<EmailTemplateCategory, string> = {
  outreach: 'Outreach',
  follow_up: 'Follow-up',
  introduction: 'Introduction',
  proposal: 'Proposal',
  thank_you: 'Thank You',
  meeting: 'Meeting',
  reminder: 'Reminder',
  newsletter: 'Newsletter',
  announcement: 'Announcement',
  other: 'Other',
};

// Draft status labels
export const draftStatusLabels: Record<EmailDraftStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

// Common template variables available for all templates
export const commonVariables: TemplateVariable[] = [
  { name: 'first_name', label: 'First Name', type: 'text', required: false },
  { name: 'last_name', label: 'Last Name', type: 'text', required: false },
  { name: 'full_name', label: 'Full Name', type: 'text', required: false },
  { name: 'email', label: 'Email', type: 'email', required: false },
  { name: 'company', label: 'Company', type: 'text', required: false },
  { name: 'title', label: 'Job Title', type: 'text', required: false },
  { name: 'sender_name', label: 'Sender Name', type: 'text', required: false },
  { name: 'sender_email', label: 'Sender Email', type: 'email', required: false },
  { name: 'today', label: "Today's Date", type: 'date', required: false },
];
