import { describe, it, expect } from 'vitest';
import {
  acceptQuoteSchema,
  bulkLineItemsSchema,
  createQuoteSchema,
  lineItemSchema,
  quoteStatuses,
  updateLineItemSchema,
  updateQuoteSchema,
} from '@/lib/validators/quote';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS } from '@/types/quote';

describe('Quote Validators', () => {
  describe('createQuoteSchema', () => {
    it('validates a complete quote payload', () => {
      const result = createQuoteSchema.safeParse({
        title: 'Enterprise Annual Renewal',
        quote_number: 'Q-2026-001',
        valid_until: '2026-12-31',
        notes: 'Includes implementation and support.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid valid_until format', () => {
      const result = createQuoteSchema.safeParse({
        title: 'Bad Date Quote',
        valid_until: '12/31/2026',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateQuoteSchema', () => {
    it('allows sent and expired status transitions only', () => {
      expect(updateQuoteSchema.safeParse({ status: 'sent' }).success).toBe(true);
      expect(updateQuoteSchema.safeParse({ status: 'expired' }).success).toBe(true);
    });

    it('rejects accepted and rejected status transitions through PATCH', () => {
      expect(updateQuoteSchema.safeParse({ status: 'accepted' }).success).toBe(false);
      expect(updateQuoteSchema.safeParse({ status: 'rejected' }).success).toBe(false);
    });
  });

  describe('lineItemSchema', () => {
    it('validates a catalog-backed line item and applies default discount', () => {
      const result = lineItemSchema.safeParse({
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Consulting Hours',
        quantity: 8,
        unit_price: 175,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discount_percent).toBe(0);
      }
    });

    it('rejects invalid quantity and discount values', () => {
      expect(
        lineItemSchema.safeParse({
          name: 'Invalid Quantity',
          quantity: 0,
          unit_price: 100,
        }).success
      ).toBe(false);

      expect(
        lineItemSchema.safeParse({
          name: 'Invalid Discount',
          quantity: 1,
          unit_price: 100,
          discount_percent: 101,
        }).success
      ).toBe(false);
    });
  });

  describe('updateLineItemSchema', () => {
    it('allows partial updates including clearing nullable fields', () => {
      const result = updateLineItemSchema.safeParse({
        product_id: null,
        description: null,
        quantity: 3,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('bulkLineItemsSchema', () => {
    it('accepts up to 100 line items', () => {
      const result = bulkLineItemsSchema.safeParse(
        Array.from({ length: 100 }, (_, idx) => ({
          name: `Item ${idx + 1}`,
          quantity: 1,
          unit_price: 10,
        }))
      );

      expect(result.success).toBe(true);
    });

    it('rejects more than 100 line items', () => {
      const result = bulkLineItemsSchema.safeParse(
        Array.from({ length: 101 }, (_, idx) => ({
          name: `Item ${idx + 1}`,
          quantity: 1,
          unit_price: 10,
        }))
      );

      expect(result.success).toBe(false);
    });
  });

  describe('acceptQuoteSchema', () => {
    it('defaults sync_amount to false', () => {
      const result = acceptQuoteSchema.parse({});
      expect(result.sync_amount).toBe(false);
    });
  });
});

describe('Quote Presentation Metadata', () => {
  it('has labels and colors for every quote status', () => {
    for (const status of quoteStatuses) {
      expect(QUOTE_STATUS_LABELS[status]).toBeTruthy();
      expect(QUOTE_STATUS_COLORS[status]).toBeTruthy();
    }
  });
});
