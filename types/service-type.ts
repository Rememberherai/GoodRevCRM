import type { Database } from './database';
import { DISPOSITION_COLORS, DISPOSITION_COLOR_MAP } from './disposition';

export type ServiceTypeRow = Database['public']['Tables']['service_types']['Row'];
export type ServiceTypeInsert = Database['public']['Tables']['service_types']['Insert'];
export type ServiceTypeUpdate = Database['public']['Tables']['service_types']['Update'];

// Reuse the same color system as dispositions
export const SERVICE_TYPE_COLORS = DISPOSITION_COLORS;
export type ServiceTypeColor = (typeof SERVICE_TYPE_COLORS)[number];
export const SERVICE_TYPE_COLOR_MAP = DISPOSITION_COLOR_MAP;

/** Default service types seeded when user clicks "Initialize defaults" */
export const DEFAULT_SERVICE_TYPES: Array<{ name: string; color: ServiceTypeColor }> = [
  { name: 'Plumbing', color: 'blue' },
  { name: 'Electrical', color: 'yellow' },
  { name: 'HVAC', color: 'green' },
  { name: 'Roofing', color: 'red' },
  { name: 'Landscaping', color: 'green' },
  { name: 'Painting', color: 'purple' },
  { name: 'General Contracting', color: 'orange' },
  { name: 'Cleaning', color: 'pink' },
  { name: 'Flooring', color: 'gray' },
  { name: 'Demolition', color: 'red' },
];
