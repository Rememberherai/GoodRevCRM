/**
 * LinkedIn/Sales Navigator utility functions
 */

interface PersonForLinkedIn {
  linkedin_url?: string | null;
  first_name: string;
  last_name: string;
  job_title?: string | null;
}

/**
 * Build Sales Navigator URL from person data
 * If we have a LinkedIn URL, converts it to Sales Navigator format
 * Otherwise falls back to a search URL
 */
export function getSalesNavUrl(
  person: PersonForLinkedIn,
  orgName?: string | null
): string {
  // If we have LinkedIn URL, convert to Sales Nav profile
  if (person.linkedin_url) {
    const match = person.linkedin_url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match) {
      return `https://www.linkedin.com/sales/people/${match[1]},-1`;
    }
  }

  // Fallback to search
  const query = [
    person.first_name,
    person.last_name,
    orgName,
  ]
    .filter(Boolean)
    .join(' ');

  const params = new URLSearchParams({ query });
  return `https://www.linkedin.com/sales/search/people?${params}`;
}

/**
 * Get regular LinkedIn profile URL (if stored)
 */
export function getLinkedInUrl(person: PersonForLinkedIn): string | null {
  return person.linkedin_url || null;
}

/**
 * Build a personalized connection message prompt for AI generation
 */
export function buildConnectionMessagePrompt(
  person: PersonForLinkedIn,
  orgName?: string | null,
  additionalContext?: string
): string {
  const parts = [
    `Write a brief, personalized LinkedIn connection request message (max 280 characters) for:`,
    `Name: ${person.first_name} ${person.last_name}`,
  ];

  if (person.job_title) {
    parts.push(`Title: ${person.job_title}`);
  }

  if (orgName) {
    parts.push(`Company: ${orgName}`);
  }

  if (additionalContext) {
    parts.push(`Context: ${additionalContext}`);
  }

  parts.push('');
  parts.push('Guidelines:');
  parts.push('- Be professional and specific');
  parts.push('- Avoid generic templates like "I came across your profile"');
  parts.push('- Mention something relevant to their role or company');
  parts.push('- Keep it under 280 characters (LinkedIn limit)');
  parts.push('- Do not include a greeting like "Hi [Name]" - just the message body');

  return parts.join('\n');
}

/**
 * LinkedIn outreach status values
 */
export type LinkedInOutreachStatus =
  | 'pending'
  | 'connection_sent'
  | 'connected'
  | 'not_interested';

export const LINKEDIN_STATUS_LABELS: Record<LinkedInOutreachStatus, string> = {
  pending: 'Pending',
  connection_sent: 'Connection Sent',
  connected: 'Connected',
  not_interested: 'Not Interested',
};

export const LINKEDIN_STATUS_COLORS: Record<LinkedInOutreachStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  connection_sent: 'bg-blue-100 text-blue-800',
  connected: 'bg-green-100 text-green-800',
  not_interested: 'bg-gray-100 text-gray-800',
};
