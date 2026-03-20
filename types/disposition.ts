import type { Database } from './database';

export type DispositionRow = Database['public']['Tables']['dispositions']['Row'];
export type DispositionInsert = Database['public']['Tables']['dispositions']['Insert'];
export type DispositionUpdate = Database['public']['Tables']['dispositions']['Update'];

export const DISPOSITION_COLORS = [
  'gray',
  'blue',
  'green',
  'red',
  'yellow',
  'purple',
  'orange',
  'pink',
] as const;

export type DispositionColor = (typeof DISPOSITION_COLORS)[number];

export const DISPOSITION_ENTITY_TYPES = ['organization', 'person'] as const;
export type DispositionEntityType = (typeof DISPOSITION_ENTITY_TYPES)[number];

/** Color map for rendering disposition badges */
export const DISPOSITION_COLOR_MAP: Record<DispositionColor, { bg: string; text: string; border: string }> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
};

/** Default dispositions seeded when user clicks "Initialize defaults" */
export const DEFAULT_DISPOSITIONS: Array<{ name: string; color: DispositionColor; is_default: boolean }> = [
  { name: 'Prospect', color: 'blue', is_default: true },
  { name: 'Customer', color: 'green', is_default: false },
  { name: 'Partner', color: 'purple', is_default: false },
  { name: 'Not a Fit', color: 'gray', is_default: false },
  { name: 'Former Customer', color: 'orange', is_default: false },
];
