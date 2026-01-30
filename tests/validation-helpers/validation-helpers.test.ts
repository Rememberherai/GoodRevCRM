import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidEmail,
  isValidURL,
  isValidSlug,
  generateSlug,
  isValidPagination,
  isValidDateRange,
  isValidPercentage,
  isValidPhoneNumber,
  sanitizeString,
  truncateString,
  parseJSON,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  formatCurrency,
  formatPercentage,
  hasDuplicates,
  removeDuplicates,
} from '@/lib/validation-helpers';

describe('Validation Helpers', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@company.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidURL', () => {
    it('should return true for valid URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://localhost:3000')).toBe(true);
      expect(isValidURL('https://api.domain.com/path?query=value')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidURL('not-a-url')).toBe(false);
      expect(isValidURL('')).toBe(false);
    });
  });

  describe('isValidSlug', () => {
    it('should return true for valid slugs', () => {
      expect(isValidSlug('my-project')).toBe(true);
      expect(isValidSlug('project123')).toBe(true);
      expect(isValidSlug('my-awesome-project-2024')).toBe(true);
    });

    it('should return false for invalid slugs', () => {
      expect(isValidSlug('My Project')).toBe(false);
      expect(isValidSlug('project_name')).toBe(false);
      expect(isValidSlug('-start-dash')).toBe(false);
      expect(isValidSlug('end-dash-')).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('should generate valid slugs', () => {
      expect(generateSlug('My Project Name')).toBe('my-project-name');
      expect(generateSlug('Hello World!')).toBe('hello-world');
      expect(generateSlug('Test   Multiple   Spaces')).toBe('test-multiple-spaces');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Project @#$% Test')).toBe('project-test');
      expect(generateSlug('  Trimmed  ')).toBe('trimmed');
    });
  });

  describe('isValidPagination', () => {
    it('should return true for valid pagination', () => {
      expect(isValidPagination(10, 0)).toBe(true);
      expect(isValidPagination(50, 100)).toBe(true);
      expect(isValidPagination(100, 0)).toBe(true);
    });

    it('should return false for invalid pagination', () => {
      expect(isValidPagination(0, 0)).toBe(false);
      expect(isValidPagination(101, 0)).toBe(false);
      expect(isValidPagination(10, -1)).toBe(false);
      expect(isValidPagination(10, 1.5)).toBe(false);
    });

    it('should respect custom maxLimit', () => {
      expect(isValidPagination(200, 0, 250)).toBe(true);
      expect(isValidPagination(200, 0, 100)).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('should return true for valid date ranges', () => {
      expect(isValidDateRange('2024-01-01', '2024-12-31')).toBe(true);
      expect(isValidDateRange(new Date('2024-01-01'), new Date('2024-12-31'))).toBe(true);
      expect(isValidDateRange('2024-06-15', '2024-06-15')).toBe(true);
    });

    it('should return false for invalid date ranges', () => {
      expect(isValidDateRange('2024-12-31', '2024-01-01')).toBe(false);
      expect(isValidDateRange('invalid', '2024-01-01')).toBe(false);
    });
  });

  describe('isValidPercentage', () => {
    it('should return true for valid percentages', () => {
      expect(isValidPercentage(0)).toBe(true);
      expect(isValidPercentage(50)).toBe(true);
      expect(isValidPercentage(100)).toBe(true);
      expect(isValidPercentage(33.33)).toBe(true);
    });

    it('should return false for invalid percentages', () => {
      expect(isValidPercentage(-1)).toBe(false);
      expect(isValidPercentage(101)).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidPhoneNumber('+1 (555) 123-4567')).toBe(true);
      expect(isValidPhoneNumber('555-123-4567')).toBe(true);
      expect(isValidPhoneNumber('1234567890')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhoneNumber('abc')).toBe(false);
      expect(isValidPhoneNumber('123')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeString('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
      expect(sanitizeString('Hello & Goodbye')).toBe('Hello &amp; Goodbye');
    });

    it('should handle normal strings', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });
  });

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      expect(truncateString('Hello World', 8)).toBe('Hello...');
      expect(truncateString('Short', 10)).toBe('Short');
    });

    it('should use custom suffix', () => {
      expect(truncateString('Hello World', 8, '…')).toBe('Hello W…');
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      expect(parseJSON('{"key": "value"}')).toEqual({ key: 'value' });
      expect(parseJSON('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should return null for invalid JSON', () => {
      expect(parseJSON('not json')).toBeNull();
      expect(parseJSON('')).toBeNull();
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  hello  ')).toBe(true);
    });

    it('should return false for empty or non-string values', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.5)).toBe(true);
      expect(isPositiveNumber(1000000)).toBe(true);
    });

    it('should return false for non-positive values', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('1' as unknown as number)).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('should return true for non-negative numbers', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(1)).toBe(true);
      expect(isNonNegativeNumber(0.5)).toBe(true);
    });

    it('should return false for negative values', () => {
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber(NaN)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency values', () => {
      expect(formatCurrency(1000, 'USD', 'en-US')).toBe('$1,000.00');
      expect(formatCurrency(99.99, 'USD', 'en-US')).toBe('$99.99');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage values', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(33.333, 2)).toBe('33.33%');
    });
  });

  describe('hasDuplicates', () => {
    it('should detect duplicates', () => {
      expect(hasDuplicates([1, 2, 3, 2])).toBe(true);
      expect(hasDuplicates(['a', 'b', 'a'])).toBe(true);
    });

    it('should return false for unique arrays', () => {
      expect(hasDuplicates([1, 2, 3])).toBe(false);
      expect(hasDuplicates(['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicates', () => {
      expect(removeDuplicates([1, 2, 3, 2, 1])).toEqual([1, 2, 3]);
      expect(removeDuplicates(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('should preserve order of first occurrence', () => {
      expect(removeDuplicates([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });
  });
});
