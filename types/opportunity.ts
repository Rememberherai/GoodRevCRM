import type { Database } from './database';
import type { Organization } from './organization';
import type { Person } from './person';

export type Opportunity = Database['public']['Tables']['opportunities']['Row'];
export type OpportunityInsert = Database['public']['Tables']['opportunities']['Insert'];
export type OpportunityUpdate = Database['public']['Tables']['opportunities']['Update'];

export type OpportunityStage = Database['public']['Enums']['opportunity_stage'];

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export interface OpportunityLinkedRfp {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  estimated_value: number | null;
}

export interface OpportunityWithRelations extends Opportunity {
  organization?: Organization | null;
  primary_contact?: Person | null;
  rfps?: OpportunityLinkedRfp[];
}
