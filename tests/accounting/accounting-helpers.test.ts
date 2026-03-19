import { describe, expect, it } from 'vitest';
import { getSignedBalance } from '@/lib/accounting/helpers';

describe('getSignedBalance', () => {
  it('uses debit-minus-credit for debit-normal accounts', () => {
    expect(getSignedBalance('debit', 125, 40)).toBe(85);
  });

  it('uses credit-minus-debit for credit-normal accounts', () => {
    expect(getSignedBalance('credit', 40, 125)).toBe(85);
    expect(getSignedBalance('credit', 125, 40)).toBe(-85);
  });

  it('defaults unknown normal balances to debit-style math', () => {
    expect(getSignedBalance(undefined, 90, 20)).toBe(70);
  });
});
