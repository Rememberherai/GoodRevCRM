import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBill } from '@/lib/assistant/accounting-bridge';
import { createAdminClient } from '@/lib/supabase/admin';
import { createQBBill } from '@/lib/assistant/quickbooks';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/assistant/quickbooks', () => ({
  createQBBill: vi.fn(),
}));

function createMockAdminClient(config: {
  accountingTarget: 'goodrev' | 'quickbooks' | 'none';
  accountingCompanyId?: string | null;
  expenseAccountId?: string;
  billId?: string;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: config.billId ?? 'bill-1', error: null });

  const from = vi.fn((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn((columns: string) => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data:
                columns === 'accounting_target'
                  ? { accounting_target: config.accountingTarget }
                  : columns === 'name'
                    ? { name: 'Community Hub' }
                    : { accounting_company_id: config.accountingCompanyId ?? null },
              error: null,
            }),
          })),
        })),
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      };
    }

    if (table === 'chart_of_accounts') {
      const activeFilter = {
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: config.expenseAccountId ?? 'acct-1' }, error: null }),
      };

      const deletedFilter = {
        eq: vi.fn(() => activeFilter),
      };

      const accountTypeFilter = {
        is: vi.fn(() => deletedFilter),
      };

      const accountCodeFilter = {
        eq: vi.fn(() => accountTypeFilter),
      };

      const companyFilter = {
        eq: vi.fn(() => accountCodeFilter),
      };

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => companyFilter),
        })),
      };
    }

    if (table === 'project_memberships') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
            })),
          })),
        })),
      };
    }

    return {
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'company-1' }, error: null }) })) })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    };
  });

  return { from, rpc };
}

describe('accounting bridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('routes to QuickBooks when the project target is quickbooks', async () => {
    vi.mocked(createAdminClient).mockReturnValue(createMockAdminClient({
      accountingTarget: 'quickbooks',
    }) as never);
    vi.mocked(createQBBill).mockResolvedValue({ id: 'qb-bill-1', raw: { Bill: { Id: 'qb-bill-1' } } });

    const result = await createBill({
      projectId: 'project-1',
      userId: 'user-1',
      vendor: 'Home Depot',
      amount: 47.23,
      receiptDate: '2026-03-18',
      description: 'Garden supplies',
      accountCode: '5400',
      className: 'Youth Programs',
      imageUrl: 'storage://contracts/project-1/receipt.png',
    });

    expect(createQBBill).toHaveBeenCalled();
    expect(result.provider).toBe('quickbooks');
    expect(result.externalBillId).toBe('qb-bill-1');
  });

  it('creates a GoodRev bill when the project target is goodrev', async () => {
    const admin = createMockAdminClient({
      accountingTarget: 'goodrev',
      accountingCompanyId: 'company-1',
      expenseAccountId: 'acct-1',
      billId: 'bill-99',
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const result = await createBill({
      projectId: 'project-1',
      userId: 'user-1',
      vendor: 'Home Depot',
      amount: 47.23,
      receiptDate: '2026-03-18',
      description: 'Garden supplies',
      accountCode: '5400',
      className: 'Youth Programs',
      imageUrl: 'storage://contracts/project-1/receipt.png',
    });

    expect(admin.rpc).toHaveBeenCalledWith('create_bill', expect.objectContaining({
      p_company_id: 'company-1',
      p_vendor_name: 'Home Depot',
    }));
    expect(result.provider).toBe('goodrev');
    expect(result.externalBillId).toBe('bill-99');
  });
});
