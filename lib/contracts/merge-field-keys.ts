/** Supported merge field keys and their display labels (safe for client + server import) */
export const MERGE_FIELD_OPTIONS: Array<{ key: string; label: string; group: string }> = [
  { key: 'person.full_name', label: 'Full Name', group: 'Person' },
  { key: 'person.email', label: 'Email', group: 'Person' },
  { key: 'person.phone', label: 'Phone', group: 'Person' },
  { key: 'person.job_title', label: 'Job Title', group: 'Person' },
  { key: 'organization.name', label: 'Name', group: 'Organization' },
  { key: 'organization.domain', label: 'Domain', group: 'Organization' },
  { key: 'opportunity.name', label: 'Name', group: 'Opportunity' },
  { key: 'opportunity.amount', label: 'Amount', group: 'Opportunity' },
  { key: 'date.today', label: "Today's Date", group: 'System' },
];

/** Set of valid auto_populate_from keys for validation */
export const VALID_MERGE_FIELD_KEYS = new Set(MERGE_FIELD_OPTIONS.map((o) => o.key));
