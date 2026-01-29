import type { Database } from './database';
import type { Organization } from './organization';
import type { Opportunity } from './opportunity';

export type Rfp = Database['public']['Tables']['rfps']['Row'];
export type RfpInsert = Database['public']['Tables']['rfps']['Insert'];
export type RfpUpdate = Database['public']['Tables']['rfps']['Update'];

export type RfpStatus = Database['public']['Enums']['rfp_status'];

export const RFP_STATUSES: RfpStatus[] = [
  'identified',
  'reviewing',
  'preparing',
  'submitted',
  'won',
  'lost',
  'no_bid',
];

export const STATUS_LABELS: Record<RfpStatus, string> = {
  identified: 'Identified',
  reviewing: 'Reviewing',
  preparing: 'Preparing',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
  no_bid: 'No Bid',
};

export const GO_NO_GO_OPTIONS = ['go', 'no_go', 'pending'] as const;
export type GoNoGoDecision = (typeof GO_NO_GO_OPTIONS)[number];

export const SUBMISSION_METHODS = ['email', 'portal', 'physical', 'other'] as const;
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number];

export interface RfpWithRelations extends Rfp {
  organization?: Organization | null;
  opportunity?: Opportunity | null;
}
