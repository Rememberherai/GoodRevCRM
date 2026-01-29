import type { Database } from './database';
import type { Organization } from './organization';

export type Person = Database['public']['Tables']['people']['Row'];
export type PersonInsert = Database['public']['Tables']['people']['Insert'];
export type PersonUpdate = Database['public']['Tables']['people']['Update'];

export interface PersonWithRelations extends Person {
  organizations?: Organization[];
  organization_count?: number;
  opportunities_count?: number;
}

export interface PersonOrganization {
  id: string;
  person_id: string;
  organization_id: string;
  title: string | null;
  department: string | null;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  organization?: Organization;
}
