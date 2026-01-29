import type { Database } from './database';

export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];

export interface OrganizationWithRelations extends Organization {
  people_count?: number;
  opportunities_count?: number;
}
