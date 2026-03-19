import { describe, it, expect } from 'vitest';
import {
  createProductSchema,
  productSchema,
  updateProductSchema,
} from '@/lib/validators/product';
import { UNIT_TYPE_OPTIONS } from '@/types/product';

describe('Product Validators', () => {
  describe('productSchema', () => {
    it('validates a complete product payload', () => {
      const result = productSchema.safeParse({
        name: 'Annual License',
        description: 'Full platform access for one year',
        sku: 'LIC-ANNUAL',
        default_price: 1200,
        unit_type: 'license',
        is_active: true,
      });

      expect(result.success).toBe(true);
    });

    it('allows nullable optional fields', () => {
      const result = productSchema.safeParse({
        name: 'Custom Service',
        description: null,
        sku: null,
        default_price: null,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative pricing', () => {
      const result = productSchema.safeParse({
        name: 'Broken Product',
        default_price: -1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createProductSchema', () => {
    it('requires a name', () => {
      expect(createProductSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('updateProductSchema', () => {
    it('allows partial updates', () => {
      const result = updateProductSchema.safeParse({
        is_active: false,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Product Unit Options', () => {
  it('includes the supported unit types used by the catalog UI', () => {
    const values = UNIT_TYPE_OPTIONS.map((option) => option.value);

    expect(values).toEqual(
      expect.arrayContaining(['unit', 'hour', 'month', 'license', 'seat', 'project', 'flat'])
    );
  });
});
