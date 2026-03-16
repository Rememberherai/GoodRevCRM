// Shared constants for deduplication

export const FREE_EMAIL_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'live.com',
  'msn.com',
  'me.com',
  'mac.com',
  'comcast.net',
  'att.net',
  'sbcglobal.net',
  'verizon.net',
  'cox.net',
  'charter.net',
  'earthlink.net',
  'optonline.net',
  'fastmail.com',
  'tutanota.com',
  'hushmail.com',
] as const;

export const ORG_NAME_SUFFIXES = [
  'inc',
  'inc.',
  'incorporated',
  'llc',
  'llc.',
  'ltd',
  'ltd.',
  'limited',
  'corp',
  'corp.',
  'corporation',
  'company',
  'co',
  'co.',
  'plc',
  'plc.',
  'gmbh',
  'ag',
  'sa',
  'srl',
  'pty',
  'pvt',
  'lp',
  'llp',
  'pllc',
] as const;

// Weights for person field matching
export const PERSON_WEIGHTS = {
  email: 0.50,
  linkedin_url: 0.45,
  phone: 0.30,
  name: 0.25,
  domain_name: 0.35, // same company domain + similar name
} as const;

// Weights for organization field matching
export const ORG_WEIGHTS = {
  domain: 0.60,
  linkedin_url: 0.50,
  name: 0.40,
  website: 0.35,
} as const;

// Default thresholds
export const DEFAULT_MIN_THRESHOLD = 0.60;
export const DEFAULT_AUTO_MERGE_THRESHOLD = 0.95;

// Fuzzy matching threshold for Jaro-Winkler
export const FUZZY_NAME_THRESHOLD = 0.85;
