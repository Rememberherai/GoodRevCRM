import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type AccountingRole = Database['public']['Enums']['accounting_role'];
type AccountingCompany = Database['public']['Tables']['accounting_companies']['Row'];

interface AccountingContext {
  companyId: string;
  role: AccountingRole;
  userId: string;
}

type AccountingMembership = AccountingContext;

interface AccountingMembershipWithCompany extends AccountingMembership {
  company: AccountingCompany | null;
}

interface ValidateCompanyAccountIdsOptions {
  requireActive?: boolean;
}

interface CompanyAccountRecord {
  id: string;
  account_type: string;
  parent_id?: string | null;
}

async function resolveAccountingMembershipForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountingMembership | null> {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('selected_accounting_company_id')
    .eq('user_id', userId)
    .maybeSingle();

  const preferredCompanyId = settings?.selected_accounting_company_id ?? null;

  if (preferredCompanyId) {
    const { data: preferred } = await supabase
      .from('accounting_company_memberships')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('company_id', preferredCompanyId)
      .maybeSingle();

    if (preferred) {
      return { companyId: preferred.company_id, role: preferred.role, userId };
    }
  }

  const { data: membership } = await supabase
    .from('accounting_company_memberships')
    .select('company_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return {
    companyId: membership.company_id,
    role: membership.role,
    userId,
  };
}

export async function getAccountingMembershipForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountingMembership | null> {
  return resolveAccountingMembershipForUser(supabase, userId);
}

export async function getAccountingMembershipWithCompanyForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountingMembershipWithCompany | null> {
  const membership = await resolveAccountingMembershipForUser(supabase, userId);

  if (!membership) {
    return null;
  }

  const { data: company } = await supabase
    .from('accounting_companies')
    .select('*')
    .eq('id', membership.companyId)
    .maybeSingle();

  return {
    ...membership,
    company: company ?? null,
  };
}

/**
 * Get the current user's accounting company context.
 * Respects the user's selected_accounting_company_id preference from user_settings.
 * Falls back to the oldest membership if no preference is set or it is invalid.
 * Returns null if user has no accounting company membership.
 */
export async function getAccountingContext(
  supabase: SupabaseClient<Database>,
): Promise<AccountingContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return resolveAccountingMembershipForUser(supabase, user.id);
}

const ROLE_HIERARCHY: Record<AccountingRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Check if a role meets the minimum required level.
 */
export function hasMinRole(userRole: AccountingRole, requiredRole: AccountingRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Convert debit/credit totals into a signed balance using the account's normal balance.
 */
export function getSignedBalance(
  normalBalance: string | null | undefined,
  debitAmount: number,
  creditAmount: number,
): number {
  return normalBalance === 'credit'
    ? creditAmount - debitAmount
    : debitAmount - creditAmount;
}

/**
 * Validate that all provided account IDs belong to the current company.
 * By default only active, non-deleted accounts are considered valid.
 */
export async function validateCompanyAccountIds(
  supabase: SupabaseClient<Database>,
  companyId: string,
  accountIds: string[],
  options: ValidateCompanyAccountIdsOptions = {},
): Promise<boolean> {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return true;
  }

  let query = supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('company_id', companyId)
    .in('id', uniqueIds)
    .is('deleted_at', null);

  if (options.requireActive !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error validating company account IDs:', error);
    return false;
  }

  return (data?.length ?? 0) === uniqueIds.length;
}

/**
 * Load a company account by id, optionally requiring it to be active.
 */
export async function getCompanyAccount(
  supabase: SupabaseClient<Database>,
  companyId: string,
  accountId: string,
  options: ValidateCompanyAccountIdsOptions = {},
): Promise<CompanyAccountRecord | null> {
  let query = supabase
    .from('chart_of_accounts')
    .select('id, account_type, parent_id')
    .eq('company_id', companyId)
    .eq('id', accountId)
    .is('deleted_at', null);

  if (options.requireActive !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error loading company account:', error);
    return null;
  }

  return data;
}

/**
 * Returns true when assigning `parentAccountId` to `accountId` would create a cycle.
 */
export async function wouldCreateAccountCycle(
  supabase: SupabaseClient<Database>,
  companyId: string,
  accountId: string,
  parentAccountId: string | null,
): Promise<boolean> {
  if (!parentAccountId) {
    return false;
  }

  if (accountId === parentAccountId) {
    return true;
  }

  const visited = new Set<string>();
  let currentParentId: string | null = parentAccountId;
  // BUG-Q fix: cap traversal to prevent unbounded N+1 queries on a corrupted hierarchy.
  // If depth limit is hit, treat as a cycle (refuse assignment) — safer than a false negative.
  const MAX_DEPTH = 100;

  while (currentParentId) {
    if (visited.size >= MAX_DEPTH) {
      return true; // depth limit hit — refuse to allow assignment
    }
    if (visited.has(currentParentId)) {
      return true;
    }
    visited.add(currentParentId);

    if (currentParentId === accountId) {
      return true;
    }

    const parent = await getCompanyAccount(
      supabase,
      companyId,
      currentParentId,
      { requireActive: false },
    );

    if (!parent) {
      return false;
    }

    currentParentId = parent.parent_id ?? null;
  }

  return false;
}
