import type { ProjectType } from '@/types/project';

export type VariableEntity = 'person' | 'organization' | 'user' | 'household' | 'program';

export interface BuilderVariable {
  name: string;
  label: string;
  description: string;
  entity: VariableEntity;
  /** Shown in the builder preview mode */
  previewValue: string;
}

// ── Base variables (all project types) ────────────────────────────────────

const BASE_VARIABLES: BuilderVariable[] = [
  { name: 'first_name', label: 'First Name', description: "Recipient's first name", entity: 'person', previewValue: 'Jane' },
  { name: 'last_name', label: 'Last Name', description: "Recipient's last name", entity: 'person', previewValue: 'Doe' },
  { name: 'full_name', label: 'Full Name', description: "Recipient's full name", entity: 'person', previewValue: 'Jane Doe' },
  { name: 'email', label: 'Email', description: "Recipient's email", entity: 'person', previewValue: 'jane@example.com' },
  { name: 'job_title', label: 'Job Title', description: "Recipient's job title", entity: 'person', previewValue: 'Program Director' },
  { name: 'company_name', label: 'Company Name', description: 'Company name', entity: 'organization', previewValue: 'Acme Inc.' },
  { name: 'company_domain', label: 'Company Domain', description: 'Company domain', entity: 'organization', previewValue: 'acme.com' },
  { name: 'sender_name', label: 'Sender Name', description: "Sender's name", entity: 'user', previewValue: 'Alex Johnson' },
  { name: 'sender_email', label: 'Sender Email', description: "Sender's email", entity: 'user', previewValue: 'alex@yourorg.com' },
];

// ── Community-specific variables ──────────────────────────────────────────

const COMMUNITY_VARIABLES: BuilderVariable[] = [
  { name: 'household_name', label: 'Household', description: 'Household name', entity: 'household', previewValue: 'Smith Family' },
  { name: 'program_name', label: 'Program', description: 'Program name', entity: 'program', previewValue: 'Youth Mentorship' },
];

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Returns the available template/builder variables for a given project type.
 * Community projects include household and program variables.
 */
export function getVariablesForProjectType(type: ProjectType): BuilderVariable[] {
  return type === 'community'
    ? [...BASE_VARIABLES, ...COMMUNITY_VARIABLES]
    : BASE_VARIABLES;
}

/**
 * Build a flat variable map from pre-fetched recipient + sender data.
 * Used by broadcasts and sequences to avoid per-recipient DB queries.
 */
export function buildVariableMap(
  recipient: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    job_title?: string | null;
    household_name?: string | null;
    program_name?: string | null;
  },
  sender: {
    full_name?: string | null;
    email?: string | null;
  },
  organization?: {
    name?: string | null;
    domain?: string | null;
  } | null
): Record<string, string> {
  const first = recipient.first_name ?? '';
  const last = recipient.last_name ?? '';
  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' '),
    email: recipient.email ?? '',
    job_title: recipient.job_title ?? '',
    company_name: organization?.name ?? '',
    company_domain: organization?.domain ?? '',
    sender_name: sender.full_name ?? '',
    sender_email: sender.email ?? '',
    household_name: recipient.household_name ?? '',
    program_name: recipient.program_name ?? '',
  };
}

/**
 * Substitute `{{variable}}` placeholders in a plain-text string.
 */
export function substituteText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Substitute `{{variable}}` placeholders in HTML, escaping values.
 */
export function substituteHtml(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) return match;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  });
}
