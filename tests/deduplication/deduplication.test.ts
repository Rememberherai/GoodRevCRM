import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  normalizeOrgName,
  extractLinkedInId,
  extractDomainFromEmail,
  extractDomainFromUrl,
  jaroWinkler,
  scorePersonMatch,
  scoreOrganizationMatch,
} from '@/lib/deduplication/detector';
import {
  FREE_EMAIL_PROVIDERS,
  ORG_NAME_SUFFIXES,
  PERSON_WEIGHTS,
  ORG_WEIGHTS,
  DEFAULT_MIN_THRESHOLD,
  FUZZY_NAME_THRESHOLD,
} from '@/lib/deduplication/constants';

// --- normalizeEmail ---
describe('normalizeEmail', () => {
  it('should lowercase and trim email', () => {
    expect(normalizeEmail('  John@ACME.com  ')).toBe('john@acme.com');
  });

  it('should handle already normalized email', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });
});

// --- normalizePhone ---
describe('normalizePhone', () => {
  it('should strip formatting and return last 10 digits', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('555.123.4567')).toBe('5551234567');
    expect(normalizePhone('+1-555-123-4567')).toBe('5551234567');
  });

  it('should handle international numbers with country code', () => {
    // +44 7911 123456 -> digits: 447911123456 (12 digits) -> last 10: 7911123456
    expect(normalizePhone('+44 7911 123456')).toBe('7911123456');
  });

  it('should return short numbers as-is', () => {
    expect(normalizePhone('1234567')).toBe('1234567');
  });
});

// --- normalizeOrgName ---
describe('normalizeOrgName', () => {
  it('should remove common suffixes', () => {
    expect(normalizeOrgName('Acme Inc')).toBe('acme');
    expect(normalizeOrgName('Acme Inc.')).toBe('acme');
    expect(normalizeOrgName('Tesla Corporation')).toBe('tesla');
    expect(normalizeOrgName('Widgets LLC')).toBe('widgets');
    expect(normalizeOrgName('Widgets, LLC')).toBe('widgets');
  });

  it('should lowercase and trim', () => {
    expect(normalizeOrgName('  ACME CORP  ')).toBe('acme');
  });

  it('should not strip partial matches', () => {
    // "Incorporate" should not be stripped since "incorporated" is the suffix
    expect(normalizeOrgName('Incorporate Design')).toBe('incorporate design');
  });

  it('should handle names with no suffix', () => {
    expect(normalizeOrgName('Google')).toBe('google');
  });
});

// --- extractLinkedInId ---
describe('extractLinkedInId', () => {
  it('should extract person profile ID', () => {
    expect(extractLinkedInId('https://www.linkedin.com/in/johndoe')).toBe('johndoe');
    expect(extractLinkedInId('https://linkedin.com/in/johndoe/')).toBe('johndoe');
    expect(extractLinkedInId('https://linkedin.com/in/john-doe-123abc')).toBe('john-doe-123abc');
  });

  it('should extract company profile ID', () => {
    expect(extractLinkedInId('https://www.linkedin.com/company/acme-corp')).toBe('acme-corp');
  });

  it('should return null for invalid URLs', () => {
    expect(extractLinkedInId('not-a-url')).toBeNull();
    expect(extractLinkedInId('https://example.com')).toBeNull();
  });

  it('should handle URLs with query params', () => {
    expect(extractLinkedInId('https://linkedin.com/in/johndoe?trk=abc')).toBe('johndoe');
  });
});

// --- extractDomainFromEmail ---
describe('extractDomainFromEmail', () => {
  it('should extract company domain', () => {
    expect(extractDomainFromEmail('john@acme.com')).toBe('acme.com');
    expect(extractDomainFromEmail('user@company.co.uk')).toBe('company.co.uk');
  });

  it('should return null for free email providers', () => {
    expect(extractDomainFromEmail('user@gmail.com')).toBeNull();
    expect(extractDomainFromEmail('user@yahoo.com')).toBeNull();
    expect(extractDomainFromEmail('user@hotmail.com')).toBeNull();
    expect(extractDomainFromEmail('user@outlook.com')).toBeNull();
  });

  it('should return null for invalid emails', () => {
    expect(extractDomainFromEmail('not-an-email')).toBeNull();
  });
});

// --- extractDomainFromUrl ---
describe('extractDomainFromUrl', () => {
  it('should extract domain from full URL', () => {
    expect(extractDomainFromUrl('https://www.acme.com/about')).toBe('acme.com');
    expect(extractDomainFromUrl('http://acme.com')).toBe('acme.com');
  });

  it('should handle URLs without protocol', () => {
    expect(extractDomainFromUrl('acme.com')).toBe('acme.com');
    expect(extractDomainFromUrl('www.acme.com')).toBe('acme.com');
  });

  it('should return null for invalid URLs', () => {
    expect(extractDomainFromUrl('')).toBeNull();
  });
});

// --- jaroWinkler ---
describe('jaroWinkler', () => {
  it('should return 1.0 for identical strings', () => {
    expect(jaroWinkler('John', 'John')).toBe(1.0);
    expect(jaroWinkler('', '')).toBe(1.0);
  });

  it('should return 0 for completely different strings', () => {
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });

  it('should return high score for similar names', () => {
    const score = jaroWinkler('John', 'Jon');
    expect(score).toBeGreaterThan(0.85);
  });

  it('should return high score for Johnathan vs John', () => {
    const score = jaroWinkler('Johnathan Smith', 'John Smith');
    expect(score).toBeGreaterThan(0.85);
  });

  it('should return lower score for dissimilar names', () => {
    const score = jaroWinkler('Alice Johnson', 'Bob Williams');
    expect(score).toBeLessThan(0.6);
  });

  it('should be case insensitive', () => {
    expect(jaroWinkler('JOHN', 'john')).toBe(1.0);
  });

  it('should handle empty vs non-empty', () => {
    expect(jaroWinkler('', 'John')).toBe(0);
    expect(jaroWinkler('John', '')).toBe(0);
  });

  it('should boost score for common prefix (Winkler modification)', () => {
    // "John" vs "Joan" share "Jo" prefix — Winkler should boost
    const jaro = jaroWinkler('john', 'joan');
    expect(jaro).toBeGreaterThan(0.8);
  });
});

// --- scorePersonMatch ---
describe('scorePersonMatch', () => {
  it('should score exact email match at 0.50', () => {
    const { score, reasons } = scorePersonMatch(
      { email: 'john@acme.com' },
      { email: 'john@acme.com' }
    );
    expect(score).toBeCloseTo(PERSON_WEIGHTS.email, 2);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]!.field).toBe('email');
    expect(reasons[0]!.match_type).toBe('exact');
  });

  it('should match emails case-insensitively', () => {
    const { score } = scorePersonMatch(
      { email: 'John@ACME.com' },
      { email: 'john@acme.com' }
    );
    expect(score).toBeCloseTo(PERSON_WEIGHTS.email, 2);
  });

  it('should score LinkedIn match', () => {
    const { score, reasons } = scorePersonMatch(
      { linkedin_url: 'https://linkedin.com/in/johndoe' },
      { linkedin_url: 'https://www.linkedin.com/in/johndoe/' }
    );
    expect(score).toBeCloseTo(PERSON_WEIGHTS.linkedin_url, 2);
    expect(reasons[0]!.field).toBe('linkedin_url');
  });

  it('should score phone match (different formats)', () => {
    const { score, reasons } = scorePersonMatch(
      { phone: '(555) 123-4567' },
      { phone: '555.123.4567' }
    );
    expect(score).toBeCloseTo(PERSON_WEIGHTS.phone, 2);
    expect(reasons[0]!.field).toBe('phone');
  });

  it('should match mobile to phone cross-field', () => {
    const { score } = scorePersonMatch(
      { mobile_phone: '5551234567' },
      { phone: '(555) 123-4567' }
    );
    expect(score).toBeCloseTo(PERSON_WEIGHTS.phone, 2);
  });

  it('should score fuzzy name match', () => {
    const { score, reasons } = scorePersonMatch(
      { first_name: 'Johnathan', last_name: 'Smith' },
      { first_name: 'John', last_name: 'Smith' }
    );
    expect(score).toBeGreaterThanOrEqual(PERSON_WEIGHTS.name);
    const nameReason = reasons.find(r => r.field === 'name');
    expect(nameReason).toBeDefined();
    expect(nameReason!.match_type).toBe('fuzzy');
  });

  it('should score domain+name combo', () => {
    const { score, reasons } = scorePersonMatch(
      { email: 'john.smith@acme.com', first_name: 'John', last_name: 'Smith' },
      { email: 'jsmith@acme.com', first_name: 'J', last_name: 'Smith' }
    );
    // Should include email (only if exact match), name, and potentially domain+name
    // Email won't match exactly (different local parts), but domain+name should fire
    const domainNameReason = reasons.find(r => r.field === 'domain+name');
    expect(domainNameReason).toBeDefined();
    expect(score).toBeGreaterThanOrEqual(PERSON_WEIGHTS.domain_name);
  });

  it('should combine multiple match signals', () => {
    const { score } = scorePersonMatch(
      { email: 'john@acme.com', first_name: 'John', last_name: 'Smith', phone: '5551234567' },
      { email: 'john@acme.com', first_name: 'John', last_name: 'Smith', phone: '(555) 123-4567' }
    );
    // email (0.50) + phone (0.30) + name (0.25) = 1.05, capped at 1.0
    expect(score).toBe(1.0);
  });

  it('should return 0 for completely different records', () => {
    const { score, reasons } = scorePersonMatch(
      { email: 'alice@company.com', first_name: 'Alice', last_name: 'Johnson' },
      { email: 'bob@other.com', first_name: 'Bob', last_name: 'Williams' }
    );
    expect(score).toBe(0);
    expect(reasons).toHaveLength(0);
  });

  it('should not match on free email domain + name', () => {
    const { reasons } = scorePersonMatch(
      { email: 'john@gmail.com', first_name: 'John', last_name: 'Smith' },
      { email: 'john@gmail.com', first_name: 'John', last_name: 'Smith' }
    );
    // Email should match exactly, but domain+name should NOT fire (gmail is free)
    const domainNameReason = reasons.find(r => r.field === 'domain+name');
    expect(domainNameReason).toBeUndefined();
  });
});

// --- scoreOrganizationMatch ---
describe('scoreOrganizationMatch', () => {
  it('should score exact domain match at 0.60', () => {
    const { score, reasons } = scoreOrganizationMatch(
      { domain: 'acme.com' },
      { domain: 'acme.com' }
    );
    expect(score).toBeCloseTo(ORG_WEIGHTS.domain, 2);
    expect(reasons[0]!.field).toBe('domain');
  });

  it('should match domain case-insensitively', () => {
    const { score } = scoreOrganizationMatch(
      { domain: 'ACME.COM' },
      { domain: 'acme.com' }
    );
    expect(score).toBeCloseTo(ORG_WEIGHTS.domain, 2);
  });

  it('should match website domain to domain field', () => {
    const { score, reasons } = scoreOrganizationMatch(
      { website: 'https://www.acme.com/about' },
      { domain: 'acme.com' }
    );
    // Domain doesn't directly match (incoming has no domain field), but website→domain should
    expect(score).toBeGreaterThan(0);
    const websiteReason = reasons.find(r => r.field === 'website');
    expect(websiteReason).toBeDefined();
  });

  it('should score LinkedIn company match', () => {
    const { score, reasons } = scoreOrganizationMatch(
      { linkedin_url: 'https://linkedin.com/company/acme-inc' },
      { linkedin_url: 'https://www.linkedin.com/company/acme-inc/' }
    );
    expect(score).toBeCloseTo(ORG_WEIGHTS.linkedin_url, 2);
    expect(reasons[0]!.field).toBe('linkedin_url');
  });

  it('should score fuzzy name match (strip suffixes)', () => {
    const { score, reasons } = scoreOrganizationMatch(
      { name: 'Acme Inc.' },
      { name: 'Acme Corporation' }
    );
    expect(score).toBeGreaterThanOrEqual(ORG_WEIGHTS.name);
    expect(reasons[0]!.field).toBe('name');
    expect(reasons[0]!.match_type).toBe('fuzzy');
  });

  it('should combine domain + name match', () => {
    const { score } = scoreOrganizationMatch(
      { name: 'Acme Inc', domain: 'acme.com' },
      { name: 'Acme Corporation', domain: 'acme.com' }
    );
    expect(score).toBeGreaterThanOrEqual(ORG_WEIGHTS.domain + ORG_WEIGHTS.name);
  });

  it('should return 0 for completely different orgs', () => {
    const { score } = scoreOrganizationMatch(
      { name: 'Google', domain: 'google.com' },
      { name: 'Microsoft', domain: 'microsoft.com' }
    );
    expect(score).toBe(0);
  });
});

// --- Constants validation ---
describe('Constants', () => {
  it('should have expected free email providers', () => {
    expect(FREE_EMAIL_PROVIDERS).toContain('gmail.com');
    expect(FREE_EMAIL_PROVIDERS).toContain('yahoo.com');
    expect(FREE_EMAIL_PROVIDERS).toContain('outlook.com');
    expect(FREE_EMAIL_PROVIDERS.length).toBeGreaterThan(10);
  });

  it('should have expected org suffixes', () => {
    expect(ORG_NAME_SUFFIXES).toContain('inc');
    expect(ORG_NAME_SUFFIXES).toContain('llc');
    expect(ORG_NAME_SUFFIXES).toContain('corp');
    expect(ORG_NAME_SUFFIXES).toContain('limited');
  });

  it('should have valid thresholds', () => {
    expect(DEFAULT_MIN_THRESHOLD).toBe(0.60);
    expect(FUZZY_NAME_THRESHOLD).toBe(0.85);
    expect(PERSON_WEIGHTS.email).toBe(0.50);
    expect(ORG_WEIGHTS.domain).toBe(0.60);
  });
});

// --- Edge cases ---
describe('Edge cases', () => {
  it('should handle null/undefined fields gracefully in scoring', () => {
    const { score } = scorePersonMatch(
      { email: null, first_name: null, last_name: null },
      { email: null, first_name: 'John', last_name: 'Smith' }
    );
    expect(score).toBe(0);
  });

  it('should handle empty strings', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizePhone('')).toBe('');
    expect(normalizeOrgName('')).toBe('');
  });

  it('should handle very long names without error', () => {
    const longName = 'A'.repeat(1000);
    const result = jaroWinkler(longName, longName);
    expect(result).toBe(1.0);
  });

  it('should handle special characters in org names', () => {
    expect(normalizeOrgName('O\'Brien & Associates, LLC')).toBe("o'brien & associates");
  });

  it('should handle LinkedIn URLs with fragments', () => {
    expect(extractLinkedInId('https://linkedin.com/in/johndoe#section')).toBe('johndoe');
  });
});
