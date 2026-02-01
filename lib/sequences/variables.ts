import { createClient } from '@supabase/supabase-js';

interface Person {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  phone: string | null;
  mobile_phone: string | null;
  linkedin_url: string | null;
}

interface Organization {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  linkedin_url: string | null;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

interface VariableContext {
  person: Person | null;
  organization: Organization | null;
  sender: User | null;
}

/**
 * Create admin client for fetching data
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Fetch all context data needed for variable substitution
 */
export async function fetchVariableContext(
  personId: string,
  senderId: string
): Promise<VariableContext> {
  const supabase = createAdminClient();

  // Fetch person data
  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, job_title, phone, mobile_phone, linkedin_url')
    .eq('id', personId)
    .single();

  // Fetch primary organization for the person
  let organization: Organization | null = null;
  if (person) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: personOrg } = await supabaseAny
      .from('people_organizations')
      .select(`
        organization:organizations(id, name, domain, industry, website, linkedin_url)
      `)
      .eq('person_id', personId)
      .eq('is_primary', true)
      .single();

    organization = personOrg?.organization ?? null;
  }

  // Fetch sender (user) data
  const { data: sender } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', senderId)
    .single();

  return {
    person: person as Person | null,
    organization,
    sender: sender as User | null,
  };
}

/**
 * Get the full name from first and last name parts
 */
function getFullName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || '';
}

/**
 * Map variable names to their values from context
 */
function getVariableValue(variableName: string, context: VariableContext): string {
  const { person, organization, sender } = context;

  switch (variableName) {
    // Person variables
    case 'first_name':
      return person?.first_name ?? '';
    case 'last_name':
      return person?.last_name ?? '';
    case 'full_name':
      return person ? getFullName(person.first_name, person.last_name) : '';
    case 'email':
      return person?.email ?? '';
    case 'job_title':
      return person?.job_title ?? '';
    case 'phone':
      return person?.phone ?? person?.mobile_phone ?? '';
    case 'linkedin':
      return person?.linkedin_url ?? '';

    // Organization variables
    case 'company_name':
      return organization?.name ?? '';
    case 'company_domain':
      return organization?.domain ?? '';
    case 'company_industry':
      return organization?.industry ?? '';
    case 'company_website':
      return organization?.website ?? '';

    // Sender variables
    case 'sender_name':
      return sender?.full_name ?? '';
    case 'sender_email':
      return sender?.email ?? '';

    default:
      // Return empty string for unknown variables
      return '';
  }
}

/**
 * Substitute all variables in a string with their values
 * Variables are in the format {{variable_name}}
 */
export function substituteVariables(
  template: string,
  context: VariableContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    const value = getVariableValue(variableName, context);
    // Return the original placeholder if value is empty (for visibility)
    return value || match;
  });
}

/**
 * Substitute variables in subject and body
 */
export function substituteEmailContent(
  subject: string,
  bodyHtml: string,
  bodyText: string | null,
  context: VariableContext
): { subject: string; bodyHtml: string; bodyText: string } {
  return {
    subject: substituteVariables(subject, context),
    bodyHtml: substituteVariables(bodyHtml, context),
    bodyText: bodyText ? substituteVariables(bodyText, context) : substituteVariables(bodyHtml, context).replace(/<[^>]+>/g, ''),
  };
}

/**
 * Validate that a template has no unsubstituted variables
 * (useful for preview/validation)
 */
export function findUnsubstitutedVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  return matches ? [...new Set(matches)] : [];
}
