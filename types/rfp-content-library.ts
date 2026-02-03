import type { Database } from './database';

export type ContentLibraryEntry = Database['public']['Tables']['rfp_content_library']['Row'];
export type ContentLibraryInsert = Database['public']['Tables']['rfp_content_library']['Insert'];
export type ContentLibraryUpdate = Database['public']['Tables']['rfp_content_library']['Update'];

export const CONTENT_CATEGORIES = [
  'security',
  'compliance',
  'technical',
  'company_overview',
  'pricing',
  'support',
  'implementation',
  'integration',
  'other',
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  security: 'Security',
  compliance: 'Compliance',
  technical: 'Technical',
  company_overview: 'Company Overview',
  pricing: 'Pricing',
  support: 'Support',
  implementation: 'Implementation',
  integration: 'Integration',
  other: 'Other',
};
