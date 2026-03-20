import { describe, expect, it } from 'vitest';
import { createReceiptConfirmationSchema } from '@/lib/validators/community/receipts';

describe('Community Receipt Validators', () => {
  it('accepts a valid receipt confirmation payload', () => {
    const result = createReceiptConfirmationSchema.safeParse({
      vendor: 'Home Depot',
      amount: 47.23,
      receipt_date: '2026-03-18',
      accounting_target: 'quickbooks',
      image_url: 'https://example.com/receipt.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('rejects negative receipt amounts', () => {
    const result = createReceiptConfirmationSchema.safeParse({
      vendor: 'Home Depot',
      amount: -10,
      receipt_date: '2026-03-18',
      accounting_target: 'goodrev',
      image_url: 'https://example.com/receipt.jpg',
    });

    expect(result.success).toBe(false);
  });
});
