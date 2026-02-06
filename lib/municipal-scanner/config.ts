import type { ScannerConfig } from './types';

export const SCANNER_CONFIG: ScannerConfig = {
  // Project ID - update this to your actual project ID
  projectId: process.env.SCANNER_PROJECT_ID || '92352069-9031-4f9c-a89b-e09dc51d2d16',

  // Scan last 12 months of meeting minutes
  dateRangeMonths: 12,

  // Minimum AI confidence to insert RFP (0-100)
  confidenceThreshold: 70,

  // Delay between requests to be polite (milliseconds)
  requestDelayMs: 2000,

  // Maximum retries for failed requests
  maxRetries: 3,

  // Maximum tokens per AI call (to avoid hitting limits)
  chunkSizeTokens: 10000,
};

export const PROVINCES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
] as const;

export type Province = typeof PROVINCES[number];
