import type { Database } from './database';

// Database row types
export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row'];
export type ContractTemplateInsert = Database['public']['Tables']['contract_templates']['Insert'];
export type ContractTemplateUpdate = Database['public']['Tables']['contract_templates']['Update'];

export type ContractDocument = Database['public']['Tables']['contract_documents']['Row'];
export type ContractDocumentInsert = Database['public']['Tables']['contract_documents']['Insert'];
export type ContractDocumentUpdate = Database['public']['Tables']['contract_documents']['Update'];

export type ContractRecipient = Database['public']['Tables']['contract_recipients']['Row'];
export type ContractRecipientInsert = Database['public']['Tables']['contract_recipients']['Insert'];
export type ContractRecipientUpdate = Database['public']['Tables']['contract_recipients']['Update'];

export type ContractField = Database['public']['Tables']['contract_fields']['Row'];
export type ContractFieldInsert = Database['public']['Tables']['contract_fields']['Insert'];
export type ContractFieldUpdate = Database['public']['Tables']['contract_fields']['Update'];

export type ContractAuditTrail = Database['public']['Tables']['contract_audit_trail']['Row'];
export type ContractAuditTrailInsert = Database['public']['Tables']['contract_audit_trail']['Insert'];

// Status enums
export type ContractDocumentStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_signed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'voided';

export type ContractRecipientStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'delegated';

// Runtime currently supports signer recipients only.
export type ContractRecipientRole = 'signer';

export type ContractFieldType =
  | 'signature'
  | 'initials'
  | 'date_signed'
  | 'text_input'
  | 'checkbox'
  | 'dropdown'
  | 'name'
  | 'email'
  | 'company'
  | 'title';

export type ContractSigningOrderType = 'sequential' | 'parallel';

export type ContractAuditAction =
  | 'created'
  | 'sent'
  | 'send_failed'
  | 'viewed'
  | 'field_filled'
  | 'signed'
  | 'declined'
  | 'voided'
  | 'reminder_sent'
  | 'delegated'
  | 'downloaded'
  | 'completed'
  | 'expired'
  | 'consent_given'
  | 'link_opened'
  | 'signature_adopted';

export type ContractAuditActorType = 'user' | 'signer' | 'system';

// Signature data shape
export interface SignatureData {
  type: 'draw' | 'type' | 'upload' | 'adopt';
  data: string; // base64
  font?: string;
}

// Template role definition
export interface TemplateRole {
  name: string;
  order: number;
}

// Template field definition
export interface TemplateFieldDefinition {
  field_type: ContractFieldType;
  role_name: string;
  label?: string;
  placeholder?: string;
  is_required: boolean;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  options?: string[];
  validation_rule?: string;
  auto_populate_from?: string;
}

// Merge field definition
export interface MergeFieldDefinition {
  key: string;
  label: string;
  source?: string; // e.g., 'opportunity.title', 'person.full_name'
}

// Relations
export interface ContractDocumentWithRelations extends ContractDocument {
  template?: ContractTemplate | null;
  recipients?: ContractRecipient[];
  fields?: ContractField[];
  organization?: {
    id: string;
    name: string;
  } | null;
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  opportunity?: {
    id: string;
    title: string;
  } | null;
  owner?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export interface ContractRecipientWithFields extends ContractRecipient {
  fields?: ContractField[];
}

// Public signing page data (scoped to single recipient)
export interface SigningPageData {
  document_title: string;
  page_count: number;
  recipient_name: string;
  recipient_email: string;
  recipient_status: ContractRecipientStatus;
  fields: Array<{
    id: string;
    field_type: ContractFieldType;
    label: string | null;
    placeholder: string | null;
    is_required: boolean;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    options: string[] | null;
    value: string | null;
  }>;
  consent_given: boolean;
  document_status: ContractDocumentStatus;
  document_kind?: string;
  waiver_html?: string;
}

// Constants
export const DOCUMENT_STATUSES: ContractDocumentStatus[] = [
  'draft', 'sent', 'viewed', 'partially_signed',
  'completed', 'declined', 'expired', 'voided',
];

export const DOCUMENT_STATUS_LABELS: Record<ContractDocumentStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_signed: 'Partially Signed',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  voided: 'Voided',
};

export const DOCUMENT_STATUS_COLORS: Record<ContractDocumentStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'indigo',
  partially_signed: 'yellow',
  completed: 'green',
  declined: 'red',
  expired: 'orange',
  voided: 'gray',
};

export const RECIPIENT_STATUSES: ContractRecipientStatus[] = [
  'pending', 'sent', 'viewed', 'signed', 'declined', 'delegated',
];

export const RECIPIENT_STATUS_LABELS: Record<ContractRecipientStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  declined: 'Declined',
  delegated: 'Delegated',
};

export const FIELD_TYPES: ContractFieldType[] = [
  'signature', 'initials', 'date_signed', 'text_input',
  'checkbox', 'dropdown', 'name', 'email', 'company', 'title',
];

export const FIELD_TYPE_LABELS: Record<ContractFieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date_signed: 'Date Signed',
  text_input: 'Text Input',
  checkbox: 'Checkbox',
  dropdown: 'Dropdown',
  name: 'Full Name',
  email: 'Email',
  company: 'Company',
  title: 'Title',
};
