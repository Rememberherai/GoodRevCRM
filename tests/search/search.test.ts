import { describe, it, expect } from 'vitest';
import { globalSearchSchema } from '@/lib/validators/search';

describe('Search Validators', () => {
  describe('globalSearchSchema', () => {
    it('should validate a valid search query', () => {
      const validSearch = {
        query: 'john doe',
        types: ['person', 'organization'],
        limit: '20',
      };

      const result = globalSearchSchema.safeParse(validSearch);
      expect(result.success).toBe(true);
    });

    it('should require query', () => {
      const invalidSearch = {
        types: ['person'],
      };

      const result = globalSearchSchema.safeParse(invalidSearch);
      expect(result.success).toBe(false);
    });

    it('should reject empty query', () => {
      const invalidSearch = {
        query: '',
      };

      const result = globalSearchSchema.safeParse(invalidSearch);
      expect(result.success).toBe(false);
    });

    it('should validate type enum values', () => {
      const validTypes = ['person', 'organization', 'opportunity', 'rfp', 'task', 'note'];

      for (const type of validTypes) {
        const result = globalSearchSchema.safeParse({
          query: 'test',
          types: [type],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid type values', () => {
      const invalidSearch = {
        query: 'test',
        types: ['invalid_type'],
      };

      const result = globalSearchSchema.safeParse(invalidSearch);
      expect(result.success).toBe(false);
    });

    it('should use default limit', () => {
      const search = {
        query: 'test',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
      }
    });

    it('should parse limit from string', () => {
      const search = {
        query: 'test',
        limit: '50',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit > 100', () => {
      const search = {
        query: 'test',
        limit: '200',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(false);
    });

    it('should accept limit at 100', () => {
      const search = {
        query: 'test',
        limit: '100',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should accept types as undefined (search all)', () => {
      const search = {
        query: 'test',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toBeUndefined();
      }
    });

    it('should accept multiple types', () => {
      const search = {
        query: 'test',
        types: ['person', 'organization', 'opportunity'],
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toHaveLength(3);
      }
    });

    it('should trim query whitespace', () => {
      const search = {
        query: '  test  ',
      };

      const result = globalSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('test');
      }
    });
  });
});
