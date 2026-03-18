import type { Database } from './database';

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const UNIT_TYPE_OPTIONS = [
  { value: 'unit', label: 'Unit' },
  { value: 'hour', label: 'Hour' },
  { value: 'month', label: 'Month' },
  { value: 'license', label: 'License' },
  { value: 'seat', label: 'Seat' },
  { value: 'project', label: 'Project' },
  { value: 'flat', label: 'Flat Fee' },
] as const;
